"""be/project FastAPI 라우터: 공개 조회 + 관리자 표지 편집·SVG 도식 업로드.

경로 선언 순서 주의: 카탈로그(`""`)와 단건(`/{slug}`)은 충돌하지 않지만,
be/point와 동일하게 고정 경로를 먼저 둔다.
"""

from __future__ import annotations

from email.parser import BytesParser
from email.policy import default as email_policy

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse

from app.admin import require_admin
from app.project import repository, service
from app.project.models import LandingProject, ProjectEdit, ProjectIndex, ProjectSummary

router = APIRouter(prefix="/api/projects", tags=["project"])


@router.get("", response_model=list[ProjectSummary])
def get_projects() -> list[ProjectSummary]:
    """카탈로그: 모든 프로젝트 요약(published 포인트 0개는 후순위). 없으면 []."""
    return service.list_projects()


@router.get("/landing", response_model=list[LandingProject])
def get_landing_projects() -> list[LandingProject]:
    """랜딩 카드용 카탈로그를 한 응답으로 반환한다."""
    return service.list_landing_projects()


# 관리자 조회(draft 포함) — 반드시 `/{slug}` 보다 먼저 선언("admin" catch 방지).
@router.get("/admin", response_model=list[ProjectSummary])
def get_admin_projects(request: Request) -> list[ProjectSummary]:
    """모든 프로젝트 요약(관리자). CHAT_ADMIN_TOKEN + Bearer 필요."""
    require_admin(request)
    return service.list_all_admin()


@router.get("/admin/{slug}/raw", response_model=dict[str, str])
def get_admin_project_raw(slug: str, request: Request) -> dict[str, str]:
    """관리자 편집기 프리필용 전체 index.md 원문. Bearer 필요."""
    require_admin(request)
    content = service.get_raw_admin(slug)
    if content is None:
        raise HTTPException(status_code=404)
    return {"content": content}


@router.get("/admin/{slug}", response_model=ProjectIndex)
def get_admin_project(slug: str, request: Request):
    """draft 포함 포인트를 조립한 프로젝트 인덱스(관리자). 없으면 404."""
    require_admin(request)
    index = service.get_index_admin(slug)
    if index is None:
        raise HTTPException(status_code=404)
    return index


@router.put("/admin/{slug}", response_model=ProjectIndex)
def update_admin_project(slug: str, edit: ProjectEdit, request: Request) -> ProjectIndex:
    """기존 프로젝트의 전체 index.md 원문을 검증 후 저장한다. Bearer 필요."""
    require_admin(request)
    try:
        return service.update_project_admin(slug, edit.content)
    except service.ProjectNotFoundError as exc:
        raise HTTPException(status_code=404) from exc
    except service.InvalidProjectError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


async def _read_body_limited(request: Request, limit: int) -> bytes:
    """요청 본문을 상한까지만 읽어 과대 업로드를 400으로 중단."""
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > limit:
            raise service.InvalidDiagramError("SVG는 2 MiB 이하여야 합니다.")
        body.extend(chunk)
    return bytes(body)


async def _diagram_payload(request: Request) -> bytes:
    """raw SVG 또는 multipart의 ``file`` 필드에서 바이트를 꺼낸다.

    multipart 파싱은 표준 라이브러리를 사용해 SVG 업로드만을 위한 새 런타임 의존을
    추가하지 않는다. multipart 봉투에는 파일 상한 외 64 KiB까지 허용한다.
    """
    content_type = request.headers.get("content-type", "")
    media_type = content_type.partition(";")[0].strip().lower()

    if media_type == "image/svg+xml":
        return await _read_body_limited(request, service.MAX_DIAGRAM_SVG_BYTES)

    if media_type != "multipart/form-data":
        raise service.InvalidDiagramError(
            "Content-Type은 image/svg+xml 또는 multipart/form-data여야 합니다."
        )

    body = await _read_body_limited(request, service.MAX_DIAGRAM_SVG_BYTES + 64 * 1024)
    try:
        header = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("latin-1")
        message = BytesParser(policy=email_policy).parsebytes(header + body)
    except (UnicodeEncodeError, ValueError) as exc:
        raise service.InvalidDiagramError("multipart 본문을 해석할 수 없습니다.") from exc

    if not message.is_multipart():
        raise service.InvalidDiagramError("multipart 본문을 해석할 수 없습니다.")

    files: list[bytes] = []
    for part in message.iter_parts():
        if part.get_content_disposition() != "form-data":
            continue
        if part.get_param("name", header="content-disposition") != "file":
            continue
        payload = part.get_payload(decode=True)
        if isinstance(payload, bytes):
            files.append(payload)

    if len(files) != 1:
        raise service.InvalidDiagramError("multipart file 필드가 정확히 하나 필요합니다.")
    return files[0]


# 관리자 쓰기 — 공개 ``/{slug}`` 계열보다 먼저 선언해 고정 경로 의도를 보존한다.
@router.put("/admin/{slug}/diagram", response_model=ProjectIndex)
async def put_architecture_diagram(slug: str, request: Request) -> ProjectIndex:
    """완성 SVG를 추가/교체한다. CHAT_ADMIN_TOKEN + Bearer 필요."""
    require_admin(request)
    try:
        svg = await _diagram_payload(request)
        return service.set_diagram_admin(slug, svg)
    except service.ProjectNotFoundError as exc:
        raise HTTPException(status_code=404) from exc
    except service.InvalidDiagramError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
