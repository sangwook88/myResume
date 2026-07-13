"""be/project FastAPI 라우터(티켓 §5).

경로 선언 순서 주의: 카탈로그(`""`)와 단건(`/{slug}`)은 충돌하지 않지만,
be/point와 동일하게 고정 경로를 먼저 둔다.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse

from app.admin import require_admin
from app.project import repository, service
from app.project.models import ProjectIndex, ProjectSummary

router = APIRouter(prefix="/api/projects", tags=["project"])


@router.get("", response_model=list[ProjectSummary])
def get_projects() -> list[ProjectSummary]:
    """카탈로그: 모든 프로젝트 요약(published 포인트 0개는 후순위). 없으면 []."""
    return service.list_projects()


# 관리자 조회(draft 포함) — 반드시 `/{slug}` 보다 먼저 선언("admin" catch 방지).
@router.get("/admin", response_model=list[ProjectSummary])
def get_admin_projects(request: Request) -> list[ProjectSummary]:
    """모든 프로젝트 요약(관리자). CHAT_ADMIN_TOKEN + Bearer 필요."""
    require_admin(request)
    return service.list_all_admin()


@router.get("/admin/{slug}", response_model=ProjectIndex)
def get_admin_project(slug: str, request: Request):
    """draft 포함 포인트를 조립한 프로젝트 인덱스(관리자). 없으면 404."""
    require_admin(request)
    index = service.get_index_admin(slug)
    if index is None:
        raise HTTPException(status_code=404)
    return index


@router.get("/{slug}/architecture.svg")
def get_architecture_svg(slug: str):
    """컴파일된 아키텍처 도식 SVG 를 정적으로 내보낸다(ARCHITECTURE §v4-C).

    slug 는 단일 디렉토리 세그먼트만 허용(경로 탈출·와일드카드 차단) — wiki 의 다른 파일
    (`.md` 포인트·`.code.md` invidence 사이드카)은 절대 노출하지 않는다. 없으면 404.
    """
    if not slug or "/" in slug or "\\" in slug or slug in (".", ".."):
        raise HTTPException(status_code=404)
    svg = repository.WIKI_ROOT / slug / "architecture.svg"
    if not svg.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(str(svg), media_type="image/svg+xml")


@router.get("/{slug}", response_model=ProjectIndex)
def get_project(slug: str):
    """프로젝트인덱스: 표지 6요소 + 파생 포인트 목록.

    없거나 노출 불가 slug면 랜딩('/')으로 302 리다이렉트(draft 존재 비노출).
    """
    index = service.get_index(slug)
    if index is None:
        return RedirectResponse(url="/", status_code=302)
    return index
