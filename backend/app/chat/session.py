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

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from app.chat.models import Session, Turn

logger = logging.getLogger(__name__)

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
    # 타임아웃은 **서버리스에서 필수**다. 지정하지 않으면 redis-py 는 무한정 기다리는데,
    # Redis 가 느리거나 연결이 막히면 요청이 그 자리에서 멈춘 채 Lambda 슬롯을 함수
    # 타임아웃까지 붙잡는다. 그게 쌓이면 계정 동시 실행 한도를 채워
    # ConcurrentInvocationLimitExceeded 로 **서비스 전체가 죽는다**(실제로 겪음).
    # 짧은 타임아웃을 두면 예외가 나고, load/save 의 fail-open 이 받아 답변은 계속된다
    # — 멈추면 예외가 안 나서 fail-open 이 아예 동작하지 못한다.
    return redis.Redis.from_url(
        url,
        decode_responses=True,
        socket_connect_timeout=float(os.environ.get("REDIS_CONNECT_TIMEOUT", "2")),
        socket_timeout=float(os.environ.get("REDIS_TIMEOUT", "2")),
        retry_on_timeout=False,
    )


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
        """세션 로드. 없거나 만료면 None. 존재하면 TTL 을 갱신(sliding)한다.

        Redis 장애·손상 세션은 삼켜 None(=새 세션)으로 폴백한다 — list_sessions 와
        같은 가용성 우선 정책. load 는 **답변 스트림 제너레이터 안에서** 호출되므로
        여기서 예외가 나가면 SSE 가 중간에 끊겨 답변 자체가 실패한다. 이력을 잃더라도
        답변은 계속하는 편이 낫다(멀티턴 기억만 없는 단발 대화로 degrade).
        """
        key = self._key(session_id)
        try:
            raw = self.client.get(key)
            if raw is None:
                return None
            self.client.expire(key, self._ttl)  # 로드도 활동 → sliding 갱신
            return Session.model_validate_json(raw)
        except Exception as exc:  # noqa: BLE001 — Redis 장애/손상은 새 세션으로 폴백
            # Redis 미가용은 **예상 가능한 운영 상태**(예: 서버리스에서 캐시 미연결)다.
            # 매 요청마다 트레이스백을 쏟으면 로그가 무의미해지고 스트리밍 응답의
            # 지연·백프레셔 원인이 되므로 한 줄 경고로 줄인다.
            logger.warning("세션 로드 실패(%s) — 새 세션으로 폴백.", type(exc).__name__)
            return None

    def save(self, session: Session) -> None:
        """세션 통째 저장 + TTL(1일) 설정. expires_at 은 마지막 활동 + TTL 로 기록."""
        session.expires_at = _iso(_now() + timedelta(seconds=self._ttl))
        try:
            self.client.set(
                self._key(session.session_id),
                session.model_dump_json(by_alias=True),
                ex=self._ttl,
            )
        except Exception as exc:  # noqa: BLE001 — 저장 실패해도 답변은 이미 나갔다
            logger.warning("세션 저장 실패(%s) — 이번 턴은 기억되지 않음.", type(exc).__name__)

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

    def list_sessions(self, limit: int = 200) -> list[Session]:
        """모든 ``chat:session:*`` 를 SCAN 해 세션을 로드한다(관리자 감사 조회).

        - TTL 은 갱신하지 않는다 — 조회가 세션 수명을 늘리면 안 되므로 load() 대신 get() 사용.
        - 손상·역직렬화 실패 세션은 건너뛴다. 최근 생성순 정렬 후 limit 개까지.
        - Redis 오류는 삼켜 빈 리스트(가용성 우선 — 세션/이력과 동일 정책).
        """
        sessions: list[Session] = []
        try:
            for key in self.client.scan_iter(match=f"{_KEY_PREFIX}*", count=100):
                raw = self.client.get(key)
                if raw is None:
                    continue
                try:
                    sessions.append(Session.model_validate_json(raw))
                except Exception:  # noqa: BLE001 — 손상 세션은 건너뜀
                    logger.warning("세션 역직렬화 실패, 건너뜀: %s", key)
                if len(sessions) >= limit:
                    break
        except Exception:  # noqa: BLE001 — Redis 장애는 빈 리스트로 폴백
            logger.exception("세션 스캔 실패 — 빈 리스트 반환.")
            return []
        sessions.sort(key=lambda s: s.created_at or "", reverse=True)
        return sessions
