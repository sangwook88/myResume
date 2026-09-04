"""be/chat 남용 방지 + 질문 로깅 (Redis).

두 가지를 Redis(세션 이력과 같은 인스턴스)로 처리한다 — 관계형 DB·새 의존성 없이
(ARCHITECTURE §1, requirements 주석의 "관계형 DB 금지"):

  1) 질문 로깅: 들어온 질문을 분석용으로 적재한다.
     - ``chat:qlog``  : 최근 질문 레코드(JSON) 리스트, QLOG_CAP 개로 트림.
     - ``chat:qfreq`` : 정규화 질문 → 누적 횟수 zset(빈도 랭킹). 상위 QFREQ_CAP 개로 트림.
  2) 레이트리밋/밴: IP 단위 분·일 윈도우 카운터 + 동일 질문 반복(스팸) 탐지.
     초과하면 일시 밴(``chat:ban:{ip}``, TTL). LLM 호출 **전에** 차단해 비용을 아낀다.

가용성 우선: Redis 오류는 삼켜 fail-open(허용)한다 — 세션/이력과 같은 정책. 임계값은
모두 env 로 조정 가능(기본값은 1인 셀프호스팅에 넉넉하되 폭주는 막는 선).
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ── 튜너블(env) ──
WINDOW_SECONDS = int(os.environ.get("CHAT_RATE_WINDOW", "60"))      # 분 윈도우 길이(초)
MAX_PER_WINDOW = int(os.environ.get("CHAT_RATE_PER_MIN", "20"))     # 윈도우당 허용 질문
MAX_PER_DAY = int(os.environ.get("CHAT_RATE_PER_DAY", "300"))       # 하루 허용 질문(비용 상한)
DUP_THRESHOLD = int(os.environ.get("CHAT_DUP_THRESHOLD", "3"))      # 같은 질문 N회째 반복 시 밴
OFFTOPIC_LIMIT = int(os.environ.get("CHAT_OFFTOPIC_LIMIT", "5"))    # 근거없음(거부) 답변 N회 연속 시 밴
BAN_SECONDS = int(os.environ.get("CHAT_BAN_SECONDS", "3600"))       # 밴 지속(초)
MIN_Q_LEN = int(os.environ.get("CHAT_MIN_Q_LEN", "2"))             # 최소 질문 길이
MAX_Q_LEN = int(os.environ.get("CHAT_MAX_Q_LEN", "1000"))          # 최대 질문 길이
QLOG_CAP = int(os.environ.get("CHAT_QLOG_CAP", "5000"))            # 최근 질문 보관 개수
QFREQ_CAP = int(os.environ.get("CHAT_QFREQ_CAP", "10000"))         # 빈도 랭킹 상한(상위 N 유지)

_BAN = "chat:ban:{ip}"
_MIN = "chat:rate:min:{ip}"
_DAY = "chat:rate:day:{ip}"
_DUP = "chat:dup:{ip}:{h}"
_OFF = "chat:offtopic:{ip}"
_QLOG = "chat:qlog"
_QFREQ = "chat:qfreq"


@dataclass
class Decision:
    """검사 결과. allowed=False 면 message 를 사용자에게 노출한다."""

    allowed: bool
    reason: str | None = None       # banned | rate | rate_day | spam | invalid
    message: str | None = None      # 사용자 노출 메시지
    retry_after: int | None = None  # 초


_OK = Decision(True)


def _norm(q: str) -> str:
    """빈도 집계·중복 판정용 정규화(공백 접기 + 소문자)."""
    return " ".join(q.strip().lower().split())


def _hash(q: str) -> str:
    return hashlib.sha1(_norm(q).encode("utf-8")).hexdigest()[:16]


class ChatGuard:
    """레이트리밋·밴·질문 로깅. Redis 클라이언트는 세션 스토어와 동일 설정을 재사용."""

    def __init__(self, client=None) -> None:
        self._client = client

    @property
    def client(self):
        if self._client is None:
            from app.chat.session import _default_client  # noqa: PLC0415 — 동일 Redis 재사용

            self._client = _default_client()
        return self._client

    def _ban(self, ip: str, reason: str) -> None:
        try:
            self.client.set(_BAN.format(ip=ip), reason, ex=BAN_SECONDS)
            logger.warning("chat guard: IP %s 일시 밴(%s, %ss)", ip, reason, BAN_SECONDS)
        except Exception as exc:  # noqa: BLE001
            logger.warning("밴 기록 실패(%s)", type(exc).__name__)

    def evaluate(self, ip: str, question: str) -> Decision:
        """LLM 호출 전 검사. 차단이면 allowed=False + 사용자 메시지를 담아 반환한다."""
        q = question.strip()
        # 입력 유효성 — 빈/과길이 질문은 LLM 낭비 전에 컷.
        if len(q) < MIN_Q_LEN:
            return Decision(False, "invalid", "질문을 조금 더 구체적으로 입력해 주세요.")
        if len(q) > MAX_Q_LEN:
            return Decision(False, "invalid", "질문이 너무 깁니다. 더 짧게 나눠 물어봐 주세요.")

        try:
            c = self.client

            # 이미 밴?
            ban_key = _BAN.format(ip=ip)
            if c.exists(ban_key):
                ttl = c.ttl(ban_key)
                return Decision(
                    False, "banned",
                    "반복적·무의미한 요청으로 일시적으로 차단되었습니다. 잠시 후 다시 시도해 주세요.",
                    retry_after=ttl if isinstance(ttl, int) and ttl > 0 else BAN_SECONDS,
                )

            # 분 윈도우
            kmin = _MIN.format(ip=ip)
            n_min = c.incr(kmin)
            if n_min == 1:
                c.expire(kmin, WINDOW_SECONDS)
            if n_min > MAX_PER_WINDOW * 2:  # 폭주 → 즉시 밴
                self._ban(ip, "flood")
                return Decision(
                    False, "banned", "요청이 비정상적으로 많아 일시 차단되었습니다.",
                    retry_after=BAN_SECONDS,
                )
            if n_min > MAX_PER_WINDOW:
                return Decision(
                    False, "rate", "질문이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
                    retry_after=WINDOW_SECONDS,
                )

            # 일 윈도우(비용 상한)
            kday = _DAY.format(ip=ip)
            n_day = c.incr(kday)
            if n_day == 1:
                c.expire(kday, 86400)
            if n_day > MAX_PER_DAY:
                return Decision(
                    False, "rate_day", "오늘 이용 한도를 초과했습니다. 내일 다시 이용해 주세요.",
                    retry_after=86400,
                )

            # 동일 질문 반복(스팸) → DUP_THRESHOLD 회째에 밴
            kdup = _DUP.format(ip=ip, h=_hash(q))
            n_dup = c.incr(kdup)
            if n_dup == 1:
                c.expire(kdup, WINDOW_SECONDS * 5)  # 반복 관측 창
            if n_dup >= DUP_THRESHOLD:
                self._ban(ip, "dup-spam")
                return Decision(
                    False, "spam",
                    "같은 질문을 반복해 일시적으로 차단되었습니다. 잠시 후 다시 시도해 주세요.",
                    retry_after=BAN_SECONDS,
                )
        except Exception as exc:  # noqa: BLE001 — Redis 장애는 허용(가용성 우선)
            # Redis 미가용은 예상 가능한 운영 상태다. 매 요청 트레이스백 대신 한 줄 경고.
            logger.warning("레이트리밋 검사 실패(%s) — 허용(fail-open).", type(exc).__name__)
            return _OK

        return _OK

    def note_answer(self, ip: str, was_refusal: bool) -> None:
        """답변 직후 호출. 포트폴리오와 무관해 근거를 못 찾은(거부) 답변이 OFFTOPIC_LIMIT
        회 **연속**되면 밴한다. 근거 있는 정상 답변이 나오면 연속 카운터를 리셋한다.
        (거부 판정은 라우터가 최종 답변이 REFUSAL 카피인지로 내린다.)"""
        try:
            key = _OFF.format(ip=ip)
            if not was_refusal:
                self.client.delete(key)  # 정상 답변 → 연속성 끊김
                return
            n = self.client.incr(key)
            if n == 1:
                self.client.expire(key, 86400)
            if n >= OFFTOPIC_LIMIT:
                self._ban(ip, "offtopic")
        except Exception as exc:  # noqa: BLE001
            logger.warning("오프토픽 카운트 실패(%s) — 무시.", type(exc).__name__)

    def log_question(
        self, ip: str, session_id: str, context: str | None, question: str, mode: str
    ) -> None:
        """허용된 질문을 분석용으로 적재(최근 목록 + 빈도 랭킹). 실패는 무시(가용성 우선)."""
        try:
            rec = json.dumps(
                {
                    "ts": int(time.time()),
                    "ip": ip,
                    "session": session_id,
                    "context": context,
                    "mode": mode,
                    "question": question.strip(),
                },
                ensure_ascii=False,
            )
            pipe = self.client.pipeline()
            pipe.lpush(_QLOG, rec)
            pipe.ltrim(_QLOG, 0, QLOG_CAP - 1)
            pipe.zincrby(_QFREQ, 1, _norm(question))
            # 빈도 zset 은 서로 다른 질문마다 멤버가 늘어 무한 증가 가능 → 매 적재마다 하위
            # (저빈도) 멤버를 잘라 상위 QFREQ_CAP 개만 유지(메모리 상한). 상한 미만이면 no-op.
            pipe.zremrangebyrank(_QFREQ, 0, -QFREQ_CAP - 1)
            pipe.execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("질문 로깅 실패(%s) — 무시.", type(exc).__name__)

    def recent(self, limit: int = 100) -> list[dict]:
        """최근 질문 레코드(신규순). 관리자 조회용."""
        try:
            raw = self.client.lrange(_QLOG, 0, limit - 1)
            return [json.loads(r) for r in raw]
        except Exception:  # noqa: BLE001
            logger.exception("질문 로그 조회 실패")
            return []

    def top(self, limit: int = 50) -> list[dict]:
        """가장 많이 들어온 질문 랭킹. 관리자 조회용."""
        try:
            rows = self.client.zrevrange(_QFREQ, 0, limit - 1, withscores=True)
            return [{"question": q, "count": int(s)} for q, s in rows]
        except Exception:  # noqa: BLE001
            logger.exception("질문 빈도 조회 실패")
            return []
