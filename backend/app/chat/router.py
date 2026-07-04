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
from typing import AsyncIterator

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.chat import service
from app.chat.models import ChatRequest
from app.chat.session import new_session_id

router = APIRouter(prefix="/api/chat", tags=["chat"])

# 세션 쿠키명(데이터.md — 서버 발급 불투명 session_id). arch §8 쿠키 속성 확정.
COOKIE_NAME = "session_id"
COOKIE_MAX_AGE = 86400  # 1일(세션 TTL 과 정렬)


def _sse(event: str, data) -> str:
    """이벤트 dict → SSE 프레임 문자열."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _format(ev: dict) -> str:
    kind = ev["type"]
    if kind == "token":
        return _sse("token", {"text": ev["text"]})
    if kind == "citations":
        return _sse("citations", ev["citations"])
    if kind == "error":
        return _sse("error", {"message": ev["message"]})
    return _sse("done", {})


@router.post("")
async def post_chat(req: ChatRequest, request: Request) -> StreamingResponse:
    """질문을 받아 SSE 로 답변을 스트리밍한다. 세션 쿠키가 없으면 새로 발급한다."""
    session_id = request.cookies.get(COOKIE_NAME)
    is_new = session_id is None
    if is_new:
        session_id = new_session_id()

    async def event_stream() -> AsyncIterator[str]:
        async for ev in service.answer_stream(session_id, req.question, req.context):
            yield _format(ev)

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


@router.get("/suggestions", response_model=list[str])
async def get_suggestions(point: str = Query(..., description="맥락 포인트 id")) -> list[str]:
    """포인트 맥락 제안질문 3개. 없는/비공개 포인트면 빈 배열(FE 정적 폴백)."""
    return await service.suggest(point)
