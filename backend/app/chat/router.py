"""be/chat FastAPI 라우터 (티켓 §5, ARCHITECTURE §5 SSE).

- POST /api/chat            : SSE 스트리밍 답변. session_id 는 세션 쿠키로 수신,
                             최초 요청이면 서버가 발급해 Set-Cookie 로 내려준다.
- GET  /api/chat/suggestions?point=<id> : 맥락 제안질문 3개(없는/비공개면 []).

SSE 이벤트(fe/chat 계약):
  event: token      / data: {"text": "..."}       (0..N회, 답변 토큰)
  event: citations  / data: [{"kind","label","url"}, ...]  (1회, 답변 끝 인용)
  event: error      / data: {"message": "..."}     (생성 실패·30초 타임아웃)
  event: done       / data: {}                      (정상 종료)
"""

from __future__ import annotations

import json
import os
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.chat import service
from app.chat.guard import ChatGuard
from app.chat.models import ChatRequest, Turn
from app.chat.session import new_session_id

router = APIRouter(prefix="/api/chat", tags=["chat"])

# 세션 쿠키명(데이터.md — 서버 발급 불투명 session_id). arch §8 쿠키 속성 확정.
COOKIE_NAME = "session_id"
COOKIE_MAX_AGE = 86400  # 1일(세션 TTL 과 정렬)

# 남용 방지 + 질문 로깅(Redis). 모듈 싱글턴 — 클라이언트는 최초 사용 시 지연 생성.
_guard = ChatGuard()


def _client_ip(request: Request) -> str:
    """레이트리밋 식별자. 프록시 뒤면(CHAT_TRUST_PROXY) X-Forwarded-For 첫 홉을 신뢰."""
    if os.environ.get("CHAT_TRUST_PROXY", "").lower() in ("1", "true", "yes"):
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _require_admin(request: Request) -> None:
    """관리자 조회 게이트. env CHAT_ADMIN_TOKEN 미설정이면 기능 자체를 숨긴다(404)."""
    token = os.environ.get("CHAT_ADMIN_TOKEN")
    if not token:
        raise HTTPException(status_code=404)
    if request.headers.get("authorization", "") != f"Bearer {token}":
        raise HTTPException(status_code=403, detail="관리자 토큰이 올바르지 않습니다.")


def _sse(event: str, data) -> str:
    """이벤트 dict → SSE 프레임 문자열."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _format(ev: dict) -> str:
    kind = ev["type"]
    if kind == "token":
        return _sse("token", {"text": ev["text"]})
    if kind == "citations":
        return _sse("citations", ev["citations"])
    if kind == "points":
        return _sse("points", ev["points"])
    if kind == "error":
        return _sse("error", {"message": ev["message"]})
    return _sse("done", {})


@router.post("")
async def post_chat(req: ChatRequest, request: Request) -> StreamingResponse:
    """질문을 받아 SSE 로 답변을 스트리밍한다.

    세션 식별: FE 가 바디로 준 session_id 우선(다중 채팅) → 없으면 쿠키 폴백 →
    그것도 없으면 서버가 새로 발급. 활성 세션은 쿠키로도 내려 구버전·no-JS 경로를 지킨다.
    """
    session_id = req.session_id or request.cookies.get(COOKIE_NAME) or new_session_id()

    # 남용 방지: LLM 호출 전에 IP 단위로 검사(요금 폭탄·스팸 차단). 차단이면 근거 없이
    # error 이벤트만 스트리밍한다(FE 는 기존 error 렌더 재사용, LLM 미호출 → 비용 0).
    ip = _client_ip(request)
    decision = _guard.evaluate(ip, req.question)
    if not decision.allowed:
        async def blocked_stream() -> AsyncIterator[str]:
            yield _sse("error", {"message": decision.message})

        blocked = StreamingResponse(blocked_stream(), media_type="text/event-stream")
        blocked.headers["Cache-Control"] = "no-cache"
        blocked.headers["X-Accel-Buffering"] = "no"
        if decision.retry_after:
            blocked.headers["Retry-After"] = str(decision.retry_after)
        return blocked

    # 허용: 분석용으로 질문 적재(무엇이 들어오는지) 후 스트리밍 답변.
    _guard.log_question(ip, session_id, req.context, req.question, req.mode)

    async def event_stream() -> AsyncIterator[str]:
        # 답변 토큰을 모아, 최종이 "근거 못 찾음" 거부 카피인지로 오프토픽 여부를 판정한다.
        # 포트폴리오와 무관한 질문 → 거부 → 연속 누적, OFFTOPIC_LIMIT 회면 다음 요청부터 밴.
        parts: list[str] = []
        saw_error = False
        async for ev in service.answer_stream(session_id, req.question, req.context, mode=req.mode):
            if ev["type"] == "token":
                parts.append(ev["text"])
            elif ev["type"] == "error":
                saw_error = True
            yield _format(ev)
        if not saw_error:
            _guard.note_answer(ip, "".join(parts).strip() == service.REFUSAL)

    response = StreamingResponse(event_stream(), media_type="text/event-stream")
    # 스트리밍 중 프록시 버퍼링 방지 + 세션 쿠키(sliding TTL 은 서버 Redis 가 강제).
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    response.set_cookie(
        COOKIE_NAME,
        session_id,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/history", response_model=list[Turn])
async def get_history(
    session: str = Query(..., description="복원할 대화 세션 id(FE 소유)"),
) -> list[Turn]:
    """세션의 대화 이력(turns)을 반환한다. 없는/만료된 세션이면 빈 배열.

    FE 가 재오픈·새로고침·세션 전환 시 로그를 복원하는 데 쓴다(로컬 저장 없음, #5).
    """
    return service.history(session)


@router.get("/suggestions", response_model=list[str])
async def get_suggestions(point: str = Query(..., description="맥락 포인트 id")) -> list[str]:
    """포인트 맥락 제안질문 3개. 없는/비공개 포인트면 빈 배열(FE 정적 폴백)."""
    return await service.suggest(point)


@router.get("/admin/questions")
async def admin_questions(
    request: Request,
    limit: int = Query(100, ge=1, le=1000, description="최근 N개"),
) -> list[dict]:
    """최근 들어온 질문 로그(신규순). env CHAT_ADMIN_TOKEN + Bearer 필요."""
    _require_admin(request)
    return _guard.recent(limit)


@router.get("/admin/top")
async def admin_top(
    request: Request,
    limit: int = Query(50, ge=1, le=500, description="상위 N개"),
) -> list[dict]:
    """가장 많이 들어온 질문 랭킹. env CHAT_ADMIN_TOKEN + Bearer 필요."""
    _require_admin(request)
    return _guard.top(limit)
