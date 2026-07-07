"""FastAPI 앱 팩토리·엔트리포인트.

실행: `cd backend && uvicorn app.main:app --reload`
도메인 라우터를 여기서 등록한다(be/point·be/project·be/chat).
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.chat.router import router as chat_router
from app.point.router import router as point_router
from app.project.router import router as project_router

# Swagger UI(/docs) 상단에 표시되는 API 개요. 계약은 바꾸지 않고 설명만 제공한다.
API_DESCRIPTION = """
근거기반 포트폴리오 백엔드 API — 채용자가 published 위키를 둘러보고 챗봇에 물을 수 있게 한다.

**핵심 규약**
- **콘텐츠 저장소**: 관계형 DB 없음. git 마크다운(`wiki/<project>/index.md` = 표지, `wiki/<project>/<id>.md` = 포인트).
- **응답 키 케이스**: camelCase.
- **없는/draft 단건**: `302 → /`(draft 존재 비노출).
- **챗봇**: published 포인트를 load-all 해 Claude 로 SSE 스트리밍 답변 + 근거(Evidence) 인용.

이 화면에서 각 엔드포인트의 **Try it out** 버튼으로 실제 호출해볼 수 있다.
"""

# 태그별 묶음 설명(좌측 그룹 헤더에 표시).
OPENAPI_TAGS = [
    {"name": "point", "description": "포폴 포인트(2계층) — STAR+ADR 9섹션 + 근거(Evidence). published 만 노출."},
    {"name": "project", "description": "프로젝트 인덱스(1계층 표지 6요소) + 카탈로그 목록."},
    {"name": "chat", "description": "근거기반 챗봇 — published load-all + Claude 스트리밍(SSE), 근거 인용. 세션은 쿠키."},
]


# fe/chat 은 브라우저 클라이언트 island 가 직접 POST/SSE 로 호출하는 교차출처 요청이라
# CORS 프리플라이트를 통과해야 한다(페이지 GET 은 Next 서버 컴포넌트가 서버측에서 부르므로 무관).
# 세션 쿠키를 동봉하므로 allow_credentials=True → 오리진은 명시(와일드카드 불가). dev 기본값 제공.
_DEFAULT_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
CORS_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", _DEFAULT_ORIGINS).split(",") if o.strip()
]


def create_app() -> FastAPI:
    app = FastAPI(
        title="근거기반 포트폴리오 API",
        version="0.1.0",
        description=API_DESCRIPTION,
        openapi_tags=OPENAPI_TAGS,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(point_router)
    app.include_router(project_router)
    app.include_router(chat_router)
    return app


app = create_app()
