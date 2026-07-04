"""FastAPI 앱 팩토리·엔트리포인트.

실행: `cd backend && uvicorn app.main:app --reload`
도메인 라우터를 여기서 등록한다(be/point·be/project·be/chat).
"""

from __future__ import annotations

from fastapi import FastAPI

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


def create_app() -> FastAPI:
    app = FastAPI(
        title="근거기반 포트폴리오 API",
        version="0.1.0",
        description=API_DESCRIPTION,
        openapi_tags=OPENAPI_TAGS,
    )
    app.include_router(point_router)
    app.include_router(project_router)
    app.include_router(chat_router)
    return app


app = create_app()
