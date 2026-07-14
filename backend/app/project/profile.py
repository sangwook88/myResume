"""be/project 사이트 프로필 저장·조회와 프로필 사진 애셋 관리.

사이트 단위 콘텐츠는 ``wiki/profile.md``에, 사진은 ``wiki/profile/``에 둔다.
프로필 문서와 사진은 같은 디렉터리의 임시 파일을 거쳐 원자적으로 교체한다.
"""

from __future__ import annotations

import os
import secrets
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import yaml

from app.project import repository

MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024
_ALLOWED_IMAGE_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
}
_IMAGE_EXTENSIONS = frozenset(_ALLOWED_IMAGE_TYPES.values())
_STRING_FIELDS = ("name", "headline", "github", "phone", "email")


class InvalidProfileImageError(ValueError):
    """업로드 사진이 MIME 타입·크기 계약을 충족하지 않음."""


def _empty_profile() -> dict[str, str | None]:
    return {
        "name": "",
        "headline": "",
        "photo": None,
        "github": "",
        "phone": "",
        "email": "",
        "intro": "",
    }


def _profile_path() -> Path:
    return repository.WIKI_ROOT / "profile.md"


def load_profile() -> dict[str, str | None]:
    """사이트 프로필을 읽는다. 아직 없으면 빈 기본 프로필을 반환한다."""
    path = _profile_path()
    if not path.is_file():
        return _empty_profile()

    text = path.read_text(encoding="utf-8")
    frontmatter, body = repository._split_frontmatter(text)
    loaded = _empty_profile()
    for field in _STRING_FIELDS:
        loaded[field] = str(frontmatter.get(field) or "")
    photo = frontmatter.get("photo")
    loaded["photo"] = None if photo is None else str(photo)
    loaded["intro"] = body
    return loaded


def _atomic_write(path: Path, data: bytes) -> None:
    """대상과 같은 디렉터리에서 완전히 쓴 뒤 원자적으로 교체한다."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "wb") as temp_file:
            temp_file.write(data)
            temp_file.flush()
            os.fsync(temp_file.fileno())
        os.replace(temp_path, path)
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise


def save_profile(edit: dict) -> dict[str, str | None]:
    """구조화 입력을 ``wiki/profile.md``로 직렬화하고 갱신 값을 반환한다."""
    frontmatter = {field: str(edit.get(field) or "") for field in _STRING_FIELDS}
    if edit.get("photo") is not None:
        frontmatter["photo"] = str(edit["photo"])
    yaml_text = yaml.safe_dump(
        frontmatter,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
    )
    document = f"---\n{yaml_text}---\n{edit.get('intro') or ''}"
    _atomic_write(_profile_path(), document.encode("utf-8"))
    return load_profile()


def _profile_image_dir() -> Path:
    return repository.WIKI_ROOT / "profile"


def _resolved_profile_image_dir(*, create: bool) -> Path:
    image_dir = _profile_image_dir()
    if create:
        repository.WIKI_ROOT.mkdir(parents=True, exist_ok=True)
        image_dir.mkdir(exist_ok=True)
    if not image_dir.is_dir():
        raise FileNotFoundError(image_dir)

    resolved_root = repository.WIKI_ROOT.resolve()
    resolved_dir = image_dir.resolve()
    if resolved_dir.parent != resolved_root:
        raise ValueError("프로필 사진 경로가 wiki 디렉터리를 벗어납니다.")
    return resolved_dir


def save_profile_image(data: bytes, content_type: str) -> dict[str, str]:
    """래스터 사진을 서버 생성 파일명으로 저장하고 공개 URL을 반환한다."""
    media_type = content_type.partition(";")[0].strip().lower()
    ext = _ALLOWED_IMAGE_TYPES.get(media_type)
    if ext is None:
        raise InvalidProfileImageError("PNG·JPEG·GIF·WebP 이미지만 업로드할 수 있습니다.")
    if not data:
        raise InvalidProfileImageError("이미지 본문이 비어 있습니다.")
    if len(data) > MAX_PROFILE_IMAGE_BYTES:
        raise InvalidProfileImageError("이미지는 5 MiB 이하여야 합니다.")

    try:
        image_dir = _resolved_profile_image_dir(create=True)
    except ValueError as exc:
        raise InvalidProfileImageError(str(exc)) from exc

    while True:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        filename = f"{timestamp}-{secrets.token_hex(6)}.{ext}"
        target = image_dir / filename
        if not target.exists():
            break

    _atomic_write(target, data)
    return {"url": f"/api/profile/assets/{filename}", "filename": filename}


def _is_single_segment(value: str) -> bool:
    return bool(value) and value not in {".", ".."} and not any(
        char in value for char in ("/", "\\", ":", "\0")
    )


def profile_image_path(filename: str) -> Path | None:
    """공개 가능한 실존 프로필 사진 경로만 반환한다."""
    if not _is_single_segment(filename):
        return None
    if Path(filename).suffix.lower().lstrip(".") not in _IMAGE_EXTENSIONS:
        return None
    try:
        image_dir = _resolved_profile_image_dir(create=False)
        candidate = (image_dir / filename).resolve(strict=True)
    except (FileNotFoundError, OSError, RuntimeError, ValueError):
        return None
    if candidate.parent != image_dir or not candidate.is_file():
        return None
    return candidate
