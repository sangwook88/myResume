"""be/point FastAPI 라우터.

공개 조회·이미지 서빙과 관리자 조회·편집·이미지 업로드를 제공한다.
관리자 경로는 require_admin으로 보호한다.

경로 선언 순서 주의: `/recommended`를 `/{point_id}` 보다 먼저 선언해야
"recommended"가 id로 잡히지 않는다.
"""

from __future__ import annotations

from email.parser import BytesParser
from email.policy import default as email_policy

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, RedirectResponse

from app.admin import require_admin
from app.point import repository, service
from app.point.models import AdminPointSummary, Point, PointEdit, PointPage, PointSummary

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


async def _read_body_limited(request: Request, limit: int) -> bytes:
    """요청 본문을 상한까지만 읽고 과대 업로드를 즉시 거부한다."""
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > limit:
            raise service.InvalidImageError("이미지는 5 MiB 이하여야 합니다.")
        body.extend(chunk)
    return bytes(body)


async def _image_payload(request: Request) -> tuple[bytes, str]:
    """raw 이미지 또는 multipart의 단일 ``file`` 필드에서 바이트와 타입을 꺼낸다."""
    content_type = request.headers.get("content-type", "")
    media_type = content_type.partition(";")[0].strip().lower()

    if media_type in service._ALLOWED_IMAGE_TYPES:
        return await _read_body_limited(request, service.MAX_IMAGE_BYTES), media_type

    if media_type != "multipart/form-data":
        raise service.InvalidImageError(
            "Content-Type은 지원 이미지 타입 또는 multipart/form-data여야 합니다."
        )

    body = await _read_body_limited(request, service.MAX_IMAGE_BYTES + 64 * 1024)
    try:
        header = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("latin-1")
        message = BytesParser(policy=email_policy).parsebytes(header + body)
    except (UnicodeEncodeError, ValueError) as exc:
        raise service.InvalidImageError("multipart 본문을 해석할 수 없습니다.") from exc

    if not message.is_multipart():
        raise service.InvalidImageError("multipart 본문을 해석할 수 없습니다.")

    files: list[tuple[bytes, str]] = []
    for part in message.iter_parts():
        if part.get_content_disposition() != "form-data":
            continue
        if part.get_param("name", header="content-disposition") != "file":
            continue
        payload = part.get_payload(decode=True)
        if isinstance(payload, bytes):
            files.append((payload, part.get_content_type().lower()))

    if len(files) != 1:
        raise service.InvalidImageError("multipart file 필드가 정확히 하나 필요합니다.")
    return files[0]


@router.post("/admin/{point_id}/images", response_model=dict[str, str])
async def upload_point_image(point_id: str, request: Request) -> dict[str, str]:
    """포인트 단락에 첨부할 래스터 이미지를 저장한다. Bearer 필요."""
    require_admin(request)
    try:
        data, content_type = await _image_payload(request)
        return service.save_point_image_admin(point_id, data, content_type)
    except service.PointNotFoundError as exc:
        raise HTTPException(status_code=404) from exc
    except service.InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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


@router.get("/assets/{project}/{filename}")
def get_point_image(project: str, filename: str):
    """업로드된 래스터 이미지를 공개 서빙한다(인증 불필요)."""
    path = repository.image_path(project, filename)
    if path is None:
        raise HTTPException(status_code=404)
    return FileResponse(str(path))


@router.get("/{point_id}/page", response_model=PointPage, response_model_exclude_none=True)
def get_point_page(point_id: str):
    """published 단건과 같은 프로젝트의 형제 요약. 없거나 draft면 랜딩으로 리다이렉트."""
    page = service.get_published_page(point_id)
    if page is None:
        return RedirectResponse(url="/", status_code=302)
    return page


@router.get("/{point_id}", response_model=Point, response_model_exclude_none=True)
def get_point(point_id: str):
    """published 단건. 없거나 draft면 랜딩('/')으로 302 리다이렉트(draft 존재 비노출)."""
    point = service.get_published(point_id)
    if point is None:
        return RedirectResponse(url="/", status_code=302)
    return point
