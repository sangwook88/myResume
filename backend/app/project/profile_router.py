"""사이트 프로필 공개 조회·사진 서빙과 관리자 편집·사진 업로드 라우터."""

from __future__ import annotations

from email.parser import BytesParser
from email.policy import default as email_policy

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from app.admin import require_admin
from app.project import profile
from app.project.models import Profile, ProfileEdit

router = APIRouter(prefix="/api/profile", tags=["project"])


@router.get("", response_model=Profile)
def get_profile() -> Profile:
    """랜딩용 사이트 프로필. 파일이 없으면 빈 기본값을 반환한다."""
    return Profile(**profile.load_profile())


@router.put("/admin", response_model=Profile)
def update_profile(edit: ProfileEdit, request: Request) -> Profile:
    """사이트 프로필 전체 필드를 저장한다. Bearer 관리자 토큰 필요."""
    require_admin(request)
    return Profile(**profile.save_profile(edit.model_dump()))


async def _read_body_limited(request: Request, limit: int) -> bytes:
    """요청 본문을 상한까지만 읽고 과대 업로드를 즉시 거부한다."""
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > limit:
            raise profile.InvalidProfileImageError("이미지는 5 MiB 이하여야 합니다.")
        body.extend(chunk)
    return bytes(body)


async def _image_payload(request: Request) -> tuple[bytes, str]:
    """raw 이미지 또는 multipart의 단일 ``file`` 필드에서 바이트와 타입을 꺼낸다."""
    content_type = request.headers.get("content-type", "")
    media_type = content_type.partition(";")[0].strip().lower()

    if media_type in profile._ALLOWED_IMAGE_TYPES:
        return await _read_body_limited(request, profile.MAX_PROFILE_IMAGE_BYTES), media_type

    if media_type != "multipart/form-data":
        raise profile.InvalidProfileImageError(
            "Content-Type은 지원 이미지 타입 또는 multipart/form-data여야 합니다."
        )

    body = await _read_body_limited(request, profile.MAX_PROFILE_IMAGE_BYTES + 64 * 1024)
    try:
        header = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("latin-1")
        message = BytesParser(policy=email_policy).parsebytes(header + body)
    except (UnicodeEncodeError, ValueError) as exc:
        raise profile.InvalidProfileImageError("multipart 본문을 해석할 수 없습니다.") from exc

    if not message.is_multipart():
        raise profile.InvalidProfileImageError("multipart 본문을 해석할 수 없습니다.")

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
        raise profile.InvalidProfileImageError("multipart file 필드가 정확히 하나 필요합니다.")
    return files[0]


@router.post("/admin/image", response_model=dict[str, str])
async def upload_profile_image(request: Request) -> dict[str, str]:
    """프로필에 사용할 래스터 사진을 저장한다. Bearer 관리자 토큰 필요."""
    require_admin(request)
    try:
        data, content_type = await _image_payload(request)
        return profile.save_profile_image(data, content_type)
    except profile.InvalidProfileImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/assets/{filename}")
def get_profile_image(filename: str):
    """업로드된 프로필 사진을 공개 서빙한다."""
    path = profile.profile_image_path(filename)
    if path is None:
        raise HTTPException(status_code=404)
    return FileResponse(str(path))
