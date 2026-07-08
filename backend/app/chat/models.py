"""be/chat DTO (Pydantic). API 직렬화 키 케이스 = camelCase (ARCHITECTURE §5).

계약 근거: tickets/be/0003-be-chat.md §5 · docs/be/chat/데이터.md.
- Citation = { kind, label, url }              (be/point evidence.kind 재사용)
- Turn     = { role, text, citations[] }
- ChatRequest = { question, context?: pointId }
- Session  = { sessionId, context, turns[], createdAt, expiresAt }  (내부 저장용)

camelCase 직렬화 규약(CamelModel)은 be/point 공개 모델을 그대로 재사용한다
(단일 API 계약 유지 — 읽기 재사용, be/point 내부는 수정하지 않는다).
"""

from __future__ import annotations

from app.point.models import CamelModel


class Citation(CamelModel):
    """답변이 인용한 근거 1건. be/point Evidence(kind·label·url)를 그대로 참조한다."""

    kind: str  # commit | pr | swagger | file | link (be/point evidence.kind 재사용)
    label: str
    url: str


class Turn(CamelModel):
    """대화 한 턴. assistant 턴만 citations 를 채운다(user 턴은 빈 배열)."""

    role: str  # user | assistant
    text: str
    citations: list[Citation] = []


class ChatRequest(CamelModel):
    """POST /api/chat 요청 바디. session_id 는 세션 쿠키로 별도 수신(바디에 없음)."""

    question: str
    context: str | None = None  # 진입 맥락 = 보던 포인트 id 또는 null(무맥락)
    mode: str = "technical"  # 답변 눈높이(v2 모드 토글): "technical" | "hr". 미지 값은 technical 폴백


class Session(CamelModel):
    """대화 세션 1묶음(데이터.md#대화세션). Redis 에 JSON 으로 직렬화 저장한다.

    expires_at 은 표시·감사용이며 실제 만료는 Redis TTL(sliding)이 강제한다.
    """

    session_id: str
    context: str | None = None
    turns: list[Turn] = []
    created_at: str
    expires_at: str
