"""관리자 조회 게이트 (공용).

be/chat·be/point 의 관리자 전용 엔드포인트가 공유한다. 인증은 단일 공유 시크릿 하나로,
관계형 DB·세션 로그인 없이 1인 셀프호스팅 관리자를 게이트한다(ARCHITECTURE 기조):

- env ``CHAT_ADMIN_TOKEN`` 미설정이면 기능 자체를 숨긴다(404) — 셀프호스팅 기본은 '꺼짐'.
- 설정 시 ``Authorization: Bearer <token>`` 이 정확히 일치해야 통과(불일치 403).

기존 be/chat 관리자 게이트(질문 로그·빈도)와 동일 시맨틱이며, 이 모듈로 단일화해
be/point 관리자 조회(draft 포함)도 같은 시크릿을 재사용한다.
"""

from __future__ import annotations

import os

from fastapi import HTTPException, Request

_ENV_TOKEN = "CHAT_ADMIN_TOKEN"


def require_admin(request: Request) -> None:
    """관리자 요청 검증. 토큰 미설정이면 404(기능 은닉), 불일치면 403."""
    token = os.environ.get(_ENV_TOKEN)
    if not token:
        raise HTTPException(status_code=404)
    if request.headers.get("authorization", "") != f"Bearer {token}":
        raise HTTPException(status_code=403, detail="관리자 토큰이 올바르지 않습니다.")
