"""be/point FastAPI 라우터.

공개 조회는 published만 노출하고, 관리자 조회·편집은 require_admin으로 보호한다.

경로 선언 순서 주의: `/recommended`를 `/{point_id}` 보다 먼저 선언해야
"recommended"가 id로 잡히지 않는다.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.admin import require_admin
from app.point import service
from app.point.models import AdminPointSummary, Point, PointEdit, PointSummary

router = APIRouter(prefix="/api/points", tags=["point"])


@router.get("/recommended", response_model=list[PointSummary])
def get_recommended() -> list[PointSummary]:
    """랜딩 추천 포인트 상위 3(featured 우선·동점 최신순). published 0개면 []."""
    return service.list_recommended()


@router.get("", response_model=list[PointSummary])
def get_by_project(project: str = Query(..., description="프로젝트 slug")) -> list[PointSummary]:
    """한 프로젝트의 published 포인트 요약 목록. 없는 project/0개면 []."""
    return service.list_by_project(project)


# 관리자 조회(draft 포함) — 반드시 `/{point_id}` 보다 먼저 선언(안 그러면 "admin"이 id로 잡힘).
@router.get("/admin", response_model=list[AdminPointSummary])
def get_admin_points(request: Request) -> list[AdminPointSummary]:
    """draft 포함 전체 포인트 요약(관리자). CHAT_ADMIN_TOKEN + Bearer 필요."""
    require_admin(request)
    return service.list_all_admin()


@router.get("/admin/{point_id}", response_model=Point, response_model_exclude_none=True)
def get_admin_point(point_id: str, request: Request):
    """draft 포함 단건 전문(관리자 미리보기). 없으면 404. Bearer 필요."""
    require_admin(request)
    point = service.get_any_admin(point_id)
    if point is None:
        raise HTTPException(status_code=404)
    return point


@router.get("/admin/{point_id}/raw", response_model=dict[str, str])
def get_admin_point_raw(point_id: str, request: Request) -> dict[str, str]:
    """관리자 편집기 프리필용 전체 마크다운 원문. Bearer 필요."""
    require_admin(request)
    content = service.get_raw_markdown_admin(point_id)
    if content is None:
        raise HTTPException(status_code=404)
    return {"content": content}


@router.put("/admin/{point_id}", response_model=Point, response_model_exclude_none=True)
def update_admin_point(point_id: str, edit: PointEdit, request: Request) -> Point:
    """기존 포인트의 전체 마크다운 원문을 검증 후 저장한다. Bearer 필요."""
    require_admin(request)
    try:
        return service.update_point_admin(point_id, edit.content)
    except service.PointNotFoundError as exc:
        raise HTTPException(status_code=404) from exc
    except service.PointValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{point_id}", response_model=Point, response_model_exclude_none=True)
def get_point(point_id: str):
    """published 단건. 없거나 draft면 랜딩('/')으로 302 리다이렉트(draft 존재 비노출)."""
    point = service.get_published(point_id)
    if point is None:
        return RedirectResponse(url="/", status_code=302)
    return point
