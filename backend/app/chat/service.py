"""be/chat 서비스(TS): load-all 답변 스트리밍 + 세션 append + 맥락 제안질문.

핵심 오케스트레이션(기능_답변생성.md · 기능_제안질문생성.md):
- answer_stream(): 세션 이력 로드 → load-all 코퍼스 → Sonnet 5 스트리밍 답변 + Citation
  → assistant Turn 세션 append. 근거 없으면 지어내지 않고 거부. 30초 타임아웃.
- suggest(): 포인트 맥락 3개 제안질문.

LLM 은 LLMClient 이음매 뒤에 둔다 — 서비스 로직(세션·코퍼스·인용 파싱·거부)은
가짜 LLM 을 주입해 네트워크 없이 단위 검증할 수 있다. 실제 구현(AnthropicLLM)은
LangChain(langchain-anthropic) 으로 Claude `claude-sonnet-5` 를 스트리밍하며,
system prefix(코퍼스)에 프롬프트 캐싱 cache_control 을 건다(ARCHITECTURE §1·§4).
langchain·anthropic 은 지연 임포트한다(미설치 환경에서도 앱 임포트는 성공).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import AsyncIterator, Protocol

from app.chat import corpus as corpus_mod
from app.chat.models import Citation, Turn
from app.chat.session import SessionStore

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-5"  # ARCHITECTURE §1
TIMEOUT_SECONDS = 30  # ARCHITECTURE §6 · 티켓 §5
# 출력 토큰 상한. 1024 는 상세한 한국어 답변(토큰이 무거움)을 문장 중간에서 자르고,
# 그 결과 답변 끝의 인용 구분자(###CITATIONS###)도 못 뱉어 인용까지 유실됐다. 근거기반
# 챗봇은 답변이 완결되고 인용이 붙는 게 핵심이라 상한을 넉넉히 잡는다. env 로 조정 가능.
MAX_TOKENS = int(os.environ.get("CHAT_MAX_TOKENS", "3072"))

# 근거를 못 찾았을 때의 거부 카피(환각 방지 — ARCHITECTURE §6, 기능_답변생성.md).
REFUSAL = "제공된 포트폴리오 근거에서 답변할 수 있는 내용을 찾지 못했습니다."

# 모델이 답변 끝에 사용한 인용 토큰을 나열하는 구분자. 사용자에게는 노출하지 않는다.
CITATION_SENTINEL = "\n###CITATIONS###\n"
_TOKEN_RE = re.compile(r"E\d+")

_ANSWER_SYSTEM = """\
너는 근거기반 포트폴리오 챗봇이다. 아래 <코퍼스> 안의 내용만을 근거로 답한다.

규칙:
- 코퍼스에 없는 사실은 절대 지어내지 않는다(일반 지식으로 추측 금지).
- 근거로 삼을 내용을 코퍼스에서 찾지 못하면 정확히 다음 문장만 답한다: "{refusal}"
- 답변에 사용한 근거가 있으면, 답변 본문을 모두 쓴 뒤 마지막 줄에
  "{sentinel_marker}" 를 출력하고 그 다음 줄에 사용한 근거 토큰(예: E1, E3)을
  쉼표로 나열한다. 근거 토큰이 없으면 이 구분자 자체를 출력하지 않는다.
- 근거 토큰은 코퍼스의 [[E숫자]] 표기에서만 가져온다.
- 한국어로, 채용 담당자가 이해하기 쉽게 간결히 답한다.
- 눈높이: {tone}

<코퍼스>
{corpus}
</코퍼스>
"""

# v2 모드 토글 — 답변 눈높이. 근거·거부 규칙은 그대로, 표현 수위만 바꾼다. 미지 값은 technical 폴백.
_MODE_TONE = {
    "technical": "상대는 개발자·기술 면접관이다. 기술 용어와 구현 디테일·트레이드오프를 살려 정확히 답한다.",
    "hr": "상대는 비개발 채용 담당자다. 코드·파일·함수·리포지토리 이름(예: be/point, scripts/publish.py)과 기술 전문용어는 쓰지 말고, 무엇을·왜·어떤 효과였는지 일상 언어로 풀어 역할·성과·영향 중심으로 답한다.",
}
_DEFAULT_MODE = "technical"

_SUGGEST_SYSTEM = """\
아래 포트폴리오 포인트를 근거로, 채용 담당자가 물어볼 만한 한국어 질문 3개를
만들어라. 반드시 JSON 배열(문자열 3개)만 출력한다. 다른 텍스트·설명은 금지.
예: ["질문1", "질문2", "질문3"]
"""


class LLMClient(Protocol):
    """LLM 이음매. 실제(AnthropicLLM)와 테스트용 가짜가 이 계약을 만족한다."""

    def stream_answer(
        self, system_text: str, messages: list[dict]
    ) -> AsyncIterator[str]: ...

    async def generate(self, system_text: str, user_text: str) -> str: ...


class AnthropicLLM:
    """LangChain(langchain-anthropic) 기반 Claude 스트리밍 클라이언트.

    - system prefix(코퍼스)에 cache_control=ephemeral 을 걸어 프롬프트 캐싱(§1).
    - 모델·타임아웃은 arch 규약을 따른다. API 키는 env ANTHROPIC_API_KEY.
    """

    def __init__(self) -> None:
        from langchain_anthropic import ChatAnthropic  # noqa: PLC0415 (지연 임포트)

        self._llm = ChatAnthropic(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            timeout=TIMEOUT_SECONDS,
            streaming=True,
        )

    @staticmethod
    def _to_lc_messages(system_text: str, messages: list[dict]):
        from langchain_core.messages import (  # noqa: PLC0415
            AIMessage,
            HumanMessage,
            SystemMessage,
        )

        # 코퍼스 prefix 에 캐시 브레이크포인트(cache_control) — 턴·사용자 간 재사용.
        lc = [
            SystemMessage(
                content=[
                    {
                        "type": "text",
                        "text": system_text,
                        "cache_control": {"type": "ephemeral"},
                    }
                ]
            )
        ]
        for m in messages:
            if m["role"] == "assistant":
                lc.append(AIMessage(content=m["content"]))
            else:
                lc.append(HumanMessage(content=m["content"]))
        return lc

    async def stream_answer(
        self, system_text: str, messages: list[dict]
    ) -> AsyncIterator[str]:
        lc = self._to_lc_messages(system_text, messages)
        async for chunk in self._llm.astream(lc):
            content = chunk.content
            if isinstance(content, list):  # content block 리스트일 수 있음
                content = "".join(
                    b.get("text", "") for b in content if isinstance(b, dict)
                )
            if content:
                yield content

    async def generate(self, system_text: str, user_text: str) -> str:
        lc = self._to_lc_messages(system_text, [{"role": "user", "content": user_text}])
        resp = await self._llm.ainvoke(lc)
        content = resp.content
        if isinstance(content, list):
            content = "".join(b.get("text", "") for b in content if isinstance(b, dict))
        return content or ""


def get_llm() -> LLMClient:
    """실제 LLM 클라이언트 팩토리(요청 시 지연 생성)."""
    return AnthropicLLM()


def _to_messages(turns: list[Turn]) -> list[dict]:
    """세션 이력 → LLM 메시지(role·content). 인용은 모델에 되돌리지 않는다."""
    return [{"role": t.role, "content": t.text} for t in turns]


class _CitationSplitter:
    """스트림에서 CITATION_SENTINEL 앞(사용자용 본문)과 뒤(인용 토큰)를 분리.

    구분자가 청크 경계에 걸쳐 쪼개져도 놓치지 않도록 tail buffer 를 유지한다.
    """

    def __init__(self, sentinel: str) -> None:
        self._sentinel = sentinel
        self._buf = ""
        self._seen = False
        self.citation_text = ""

    def feed(self, chunk: str) -> str:
        if self._seen:
            self.citation_text += chunk
            return ""
        self._buf += chunk
        i = self._buf.find(self._sentinel)
        if i != -1:
            visible = self._buf[:i]
            self.citation_text += self._buf[i + len(self._sentinel):]
            self._buf = ""
            self._seen = True
            return visible
        # 구분자가 경계에 걸쳐 쪼개졌을 수 있어 마지막 (len-1)자는 붙잡아 둔다.
        keep = len(self._sentinel) - 1
        if len(self._buf) > keep:
            emit = self._buf[:-keep]
            self._buf = self._buf[-keep:]
            return emit
        return ""

    def flush(self) -> str:
        if self._seen:
            return ""
        emit, self._buf = self._buf, ""
        return emit


def _resolve_citations(citation_text: str, registry: dict[str, Citation]) -> list[Citation]:
    """구분자 뒤 텍스트에서 E토큰을 뽑아 registry 의 Citation 으로 매핑(순서·중복 제거)."""
    result: list[Citation] = []
    seen: set[str] = set()
    for token in _TOKEN_RE.findall(citation_text):
        if token in seen:
            continue
        cit = registry.get(token)
        if cit is not None:
            seen.add(token)
            result.append(cit)
    return result


def _resolve_points(citation_text: str, point_of_token: dict[str, dict]) -> list[dict]:
    """인용된 E토큰이 어느 포인트에서 왔는지 → 중복 제거한 출처 포인트 목록(v2 딥링크)."""
    result: list[dict] = []
    seen: set[str] = set()
    for token in _TOKEN_RE.findall(citation_text):
        p = point_of_token.get(token)
        if p is not None and p["id"] not in seen:
            seen.add(p["id"])
            result.append(p)
    return result


async def answer_stream(
    session_id: str,
    question: str,
    context: str | None = None,
    mode: str = _DEFAULT_MODE,
    *,
    llm: LLMClient | None = None,
    store: SessionStore | None = None,
) -> AsyncIterator[dict]:
    """답변을 이벤트 dict 스트림으로 낸다(라우터가 SSE 로 직렬화).

    이벤트: {"type":"token","text":..} · {"type":"citations","citations":[..]}
           · {"type":"error","message":..} · {"type":"done"}

    성공 시에만 user·assistant Turn 을 세션에 append(실패 시 미보존 → 깨끗한 재시도).
    """
    llm = llm or get_llm()
    store = store or SessionStore()

    session = store.get_or_create(session_id, context)
    # v3: 질문 기반 RAG top-K 코퍼스. 인덱스 없음·작은 코퍼스·검색 실패 시 내부에서
    # load-all(build_corpus)로 자동 폴백한다(인용 토큰 계약은 두 경로 모두 보존).
    bundle = corpus_mod.build_corpus_rag(question, context)

    # 빈 코퍼스(published 0개) = 근거 없음: LLM 호출 없이 거부 카피 스트리밍.
    if not bundle.has_content:
        yield {"type": "token", "text": REFUSAL}
        yield {"type": "citations", "citations": []}
        session.turns.append(Turn(role="user", text=question))
        session.turns.append(Turn(role="assistant", text=REFUSAL, citations=[]))
        store.save(session)
        yield {"type": "done"}
        return

    system_text = _ANSWER_SYSTEM.format(
        refusal=REFUSAL,
        sentinel_marker=CITATION_SENTINEL.strip(),
        corpus=bundle.text,
        tone=_MODE_TONE.get(mode, _MODE_TONE[_DEFAULT_MODE]),
    )
    messages = _to_messages(session.turns)
    messages.append({"role": "user", "content": question})

    splitter = _CitationSplitter(CITATION_SENTINEL)
    answer_parts: list[str] = []

    try:
        async with asyncio.timeout(TIMEOUT_SECONDS):
            async for chunk in llm.stream_answer(system_text, messages):
                visible = splitter.feed(chunk)
                if visible:
                    answer_parts.append(visible)
                    yield {"type": "token", "text": visible}
            tail = splitter.flush()
            if tail:
                answer_parts.append(tail)
                yield {"type": "token", "text": tail}
    except asyncio.TimeoutError:
        logger.warning("답변 생성 30초 타임아웃 — 에러 반환(FE 재시도).")
        yield {"type": "error", "message": "응답 시간이 초과되었습니다. 다시 시도해 주세요."}
        return
    except Exception:  # noqa: BLE001 — 생성 실패는 표준 에러 이벤트로 전달(FE 재시도)
        logger.exception("답변 생성 실패")
        yield {"type": "error", "message": "답변 생성 중 오류가 발생했습니다."}
        return

    answer_text = "".join(answer_parts).strip()
    citations = _resolve_citations(splitter.citation_text, bundle.evidence)

    yield {"type": "citations", "citations": [c.model_dump(by_alias=True) for c in citations]}

    # v2 하이브리드: 인용된 근거가 나온 출처 포인트 → 둘러보기 딥링크(ask→browse 역방향).
    related = _resolve_points(splitter.citation_text, bundle.point_of_token)
    if related:
        yield {"type": "points", "points": related}

    # 성공: 이번 user 질문 + assistant 답변(+근거)을 세션에 보존(멀티턴).
    session.turns.append(Turn(role="user", text=question))
    session.turns.append(Turn(role="assistant", text=answer_text, citations=citations))
    store.save(session)

    yield {"type": "done"}


async def suggest(
    point_id: str,
    *,
    llm: LLMClient | None = None,
) -> list[str]:
    """포인트 맥락 제안질문 3개. 없는/비공개 포인트면 [](기능_제안질문생성.md)."""
    point_ctx = corpus_mod.build_point_context(point_id)
    if point_ctx is None:
        return []

    llm = llm or get_llm()
    try:
        async with asyncio.timeout(TIMEOUT_SECONDS):
            raw = await llm.generate(_SUGGEST_SYSTEM, point_ctx)
    except Exception:  # noqa: BLE001
        logger.exception("제안질문 생성 실패 — 빈 배열 반환(FE 정적 폴백).")
        return []

    return _parse_suggestions(raw)


def _parse_suggestions(raw: str) -> list[str]:
    """모델 출력에서 질문 3개를 뽑는다. JSON 배열 우선, 실패 시 줄 단위 폴백."""
    text = raw.strip()
    # 코드펜스 제거(```json ... ```)
    fence = re.search(r"\[.*\]", text, re.DOTALL)
    if fence:
        try:
            arr = json.loads(fence.group(0))
            items = [str(x).strip() for x in arr if str(x).strip()]
            if items:
                return items[:3]
        except (ValueError, TypeError):
            pass
    # 폴백: 줄 단위(번호·불릿 제거)
    lines = []
    for line in text.splitlines():
        s = re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", line).strip().strip('"')
        if s:
            lines.append(s)
    return lines[:3]
