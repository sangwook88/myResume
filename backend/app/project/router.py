"""be/project FastAPI 라우터(티켓 §5).

경로 선언 순서 주의: 카탈로그(`""`)와 단건(`/{slug}`)은 충돌하지 않지만,
be/point와 동일하게 고정 경로를 먼저 둔다.
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from app.project import service
from app.project.models import ProjectIndex, ProjectSummary

router = APIRouter(prefix="/api/projects", tags=["project"])


@router.get("", response_model=list[ProjectSummary])
def get_projects() -> list[ProjectSummary]:
    """카탈로그: 모든 프로젝트 요약(published 포인트 0개는 후순위). 없으면 []."""
    return service.list_projects()


@router.get("/{slug}", response_model=ProjectIndex)
def get_project(slug: str):
    """프로젝트인덱스: 표지 6요소 + 파생 포인트 목록.

    없거나 노출 불가 slug면 랜딩('/')으로 302 리다이렉트(draft 존재 비노출).
    """
    index = service.get_index(slug)
    if index is None:
        return RedirectResponse(url="/", status_code=302)
    return index
