"""세션 이력 관리 (기능_세션이력관리.md).

session_id 기준으로 대화 이력을 Redis 에 로드/저장하고 **TTL 1일 sliding** 으로
만료시킨다(활동마다 갱신, 만료 자동 삭제). 세션에는 turns 와 함께 assistant 턴의
citations 도 보관한다(데이터.md#turn).

구현 세부(Redis 연결·키 스키마)는 ARCHITECTURE §8 미결 슬롯이었다 → 여기서 확정:
- 키 스키마: ``chat:session:{session_id}`` (JSON 문자열 1개, 세션 통째).
- TTL: 86400초(1일). load/save 모두에서 EXPIRE 로 갱신(sliding).
- redis 는 지연 임포트한다(패키지 미설치·미접속 환경에서도 앱 임포트는 성공하도록).

만료·없는 세션 로드는 빈 이력으로 취급한다(예외 대신 None → 호출측이 새 세션 시작).
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

from app.chat.models import Session, Turn

TTL_SECONDS = 86400  # 1일 sliding
_KEY_PREFIX = "chat:session:"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def new_session_id() -> str:
    """불투명한 세션 식별자 발급(서버 발급, 인증 없음 — 데이터.md)."""
    return secrets.token_urlsafe(32)


def _default_client():
    """환경변수 REDIS_URL(기본 redis://localhost:6379/0)로 Redis 클라이언트 생성.

    지연 임포트 — redis 미설치/미접속이어도 이 모듈 임포트 자체는 실패하지 않는다.
    """
    import redis  # noqa: PLC0415 (의도적 지연 임포트)

    url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    return redis.Redis.from_url(url, decode_responses=True)


class SessionStore:
    """Redis 백엔드 세션 스토어. 테스트는 호환 client(예: fakeredis)를 주입한다."""

    def __init__(self, client=None) -> None:
        self._client = client
        self._ttl = TTL_SECONDS

    @property
    def client(self):
        if self._client is None:
            self._client = _default_client()
        return self._client

    def _key(self, session_id: str) -> str:
        return f"{_KEY_PREFIX}{session_id}"

    def load(self, session_id: str) -> Session | None:
        """세션 로드. 없거나 만료면 None. 존재하면 TTL 을 갱신(sliding)한다."""
        key = self._key(session_id)
        raw = self.client.get(key)
        if raw is None:
            return None
        self.client.expire(key, self._ttl)  # 로드도 활동 → sliding 갱신
        return Session.model_validate_json(raw)

    def save(self, session: Session) -> None:
        """세션 통째 저장 + TTL(1일) 설정. expires_at 은 마지막 활동 + TTL 로 기록."""
        session.expires_at = _iso(_now() + timedelta(seconds=self._ttl))
        self.client.set(
            self._key(session.session_id),
            session.model_dump_json(by_alias=True),
            ex=self._ttl,
        )

    def get_or_create(self, session_id: str, context: str | None) -> Session:
        """세션 로드, 없으면 새로 생성(createdAt·expiresAt 설정). 저장은 하지 않는다."""
        existing = self.load(session_id)
        if existing is not None:
            return existing
        now = _now()
        return Session(
            session_id=session_id,
            context=context,
            turns=[],
            created_at=_iso(now),
            expires_at=_iso(now + timedelta(seconds=self._ttl)),
        )

    def append_turn(self, session_id: str, turn: Turn, context: str | None = None) -> Session:
        """세션에 Turn 을 append 하고 저장(신규면 생성). 갱신된 세션 반환."""
        session = self.get_or_create(session_id, context)
        session.turns.append(turn)
        self.save(session)
        return session
