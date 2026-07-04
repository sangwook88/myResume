"""FastAPI 앱 팩토리·엔트리포인트.

실행: `cd backend && uvicorn app.main:app --reload`
도메인 라우터를 여기서 등록한다(be/point·be/project. 후속 wave에서 be/chat 추가).
"""

from __future__ import annotations

from fastapi import FastAPI

from app.point.router import router as point_router
from app.project.router import router as project_router


def create_app() -> FastAPI:
    app = FastAPI(title="근거기반 포트폴리오 API", version="0.1.0")
    app.include_router(point_router)
    app.include_router(project_router)
    return app


app = create_app()
