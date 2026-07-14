"""be/project 리포지토리: wiki/<slug>/index.md 표지 마크다운을 파싱해 raw dict로 로드.

파일 구조 (데이터.md · ARCHITECTURE §5):
- frontmatter YAML: slug·summary·role·period·teamSize·techStack·architecture·highlights
- architecture는 길면 frontmatter 대신 본문 마크다운으로 둘 수 있어,
  frontmatter에 없으면 본문 전체(있으면)로 보완한다.

slug 정본은 디렉토리 이름(`wiki/<slug>/`)이다 — 포인트의 `project` frontmatter와 매칭되는 값.
이 모듈은 파일 파싱과 관리자 표지·도식의 원자적 파일 저장만 담당한다(Pydantic 미의존).
DTO 조립과 입력 검증은 service가 담당한다.

콘텐츠 루트는 be/point와 동일하게 리포 루트의 `wiki/`(검증용 WIKI_ROOT로 재정의 가능).
be/point 리포지토리를 import하지 않고 같은 환경변수만 공유한다(도메인 내부 비침범).
"""

from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path
from typing import Iterator

import yaml

# repository.py = backend/app/project/repository.py → parents[3] = 리포 루트
_DEFAULT_WIKI = Path(__file__).resolve().parents[3] / "wiki"
WIKI_ROOT = Path(os.environ.get("WIKI_ROOT", str(_DEFAULT_WIKI)))


def _find_project_dir(slug: str) -> Path | None:
    """실존 ``wiki/<slug>/index.md``의 디렉터리를 정확 일치로 찾는다.

    사용자 입력을 경로에 직접 붙이지 않고 한 단계 아래의 표지만 스캔하므로
    ``../``·절대경로 같은 slug는 wiki 밖 파일과 매칭될 수 없다.
    """
    if not WIKI_ROOT.is_dir():
        return None
    for index_path in WIKI_ROOT.glob("*/index.md"):
        if index_path.is_file() and index_path.parent.name == slug:
            return index_path.parent
    return None


def project_exists(slug: str) -> bool:
    """실존 프로젝트 표지가 있는 안전한 단일-segment slug인지 반환."""
    return _find_project_dir(slug) is not None


def index_path_of_slug(slug: str) -> Path | None:
    """실존 프로젝트를 스캔해 정확히 일치하는 ``index.md`` 경로를 반환한다."""
    project_dir = _find_project_dir(slug)
    if project_dir is None:
        return None
    return project_dir / "index.md"


def save_index_markdown(slug: str, text: str) -> None:
    """프로젝트 표지 원문을 같은 디렉터리의 임시 파일로 원자적 교체한다."""
    target = index_path_of_slug(slug)
    if target is None:
        raise FileNotFoundError(slug)

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            dir=target.parent,
            prefix=f".{target.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(text)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_path, target)
    except BaseException:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise


def save_diagram_svg(slug: str, svg_bytes: bytes) -> None:
    """완성된 SVG를 프로젝트의 ``architecture.svg``로 원자적 저장한다.

    프로젝트 표지가 없거나 slug가 경로 탈출 입력이면 ``FileNotFoundError``.
    검증은 service 책임이며, 이 함수는 같은 디렉터리의 고유 임시 파일을 완전히
    쓴 다음 ``os.replace``해 기존 도식의 부분 쓰기를 방지한다.
    """
    project_dir = _find_project_dir(slug)
    if project_dir is None:
        raise FileNotFoundError(slug)

    target = project_dir / "architecture.svg"
    fd, temp_name = tempfile.mkstemp(
        dir=project_dir,
        prefix=".architecture.svg.",
        suffix=".tmp",
    )
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "wb") as temp_file:
            temp_file.write(svg_bytes)
        os.replace(temp_path, target)
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise


def _split_frontmatter(text: str) -> tuple[dict, str]:
    """'---' 로 감싼 frontmatter YAML과 본문을 분리."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", text, re.DOTALL)
    if not m:
        raise ValueError("frontmatter('---' 블록)를 찾을 수 없음")
    fm = yaml.safe_load(m.group(1)) or {}
    if not isinstance(fm, dict):
        raise ValueError("frontmatter가 매핑(YAML dict)이 아님")
    return fm, m.group(2)


def _as_list(val: object) -> list[str]:
    """string[] 필드 정규화: 단일 문자열은 1원소 리스트, None은 빈 리스트."""
    if val is None:
        return []
    if isinstance(val, str):
        return [val]
    return [str(v) for v in val]


def load_raw(path: Path) -> dict:
    """표지 마크다운 1개 → raw dict. 파싱 실패는 예외로 전파(라우터에서 표준 5xx)."""
    text = path.read_text(encoding="utf-8")
    fm, body = _split_frontmatter(text)

    architecture = fm.get("architecture")
    if not architecture and body.strip():
        architecture = body.strip()

    # 아키텍처 도식(ARCHITECTURE §v4-C): 컴파일된 SVG 존재를 단일 진실원으로 파생.
    # 있으면 그 SVG 를 내보내는 API 경로(브라우저가 <img> 로 바로 쓸 수 있는 URL path),
    # 없으면 None(도식 optional). 실제 서빙은 router 의 architecture.svg 전용 라우트.
    svg = path.parent / "architecture.svg"
    slug = path.parent.name
    architecture_diagram = f"/api/projects/{slug}/architecture.svg" if svg.is_file() else None

    return {
        "slug": path.parent.name,  # 디렉토리 이름이 정본 slug
        "name": str(fm.get("name") or path.parent.name),  # 표시 이름(없으면 slug 폴백)
        "summary": str(fm.get("summary") or ""),
        "role": str(fm.get("role") or ""),
        "period": str(fm.get("period") or ""),
        "team_size": str(fm.get("teamSize") or ""),
        "tech_stack": _as_list(fm.get("techStack")),
        "architecture": str(architecture or ""),
        "architecture_diagram": architecture_diagram,
        "highlights": _as_list(fm.get("highlights")),
        "_path": str(path),
    }


def iter_raw() -> Iterator[dict]:
    """wiki/<slug>/index.md 표지 전부를 slug 순으로 로드(포인트 파일 제외)."""
    if not WIKI_ROOT.exists():
        return
    for path in sorted(WIKI_ROOT.glob("*/index.md")):
        yield load_raw(path)


def find_raw_by_slug(slug: str) -> dict | None:
    """slug로 표지 단건 조회. 없으면 None(라우터가 302 처리)."""
    path = WIKI_ROOT / slug / "index.md"
    if not path.is_file():
        return None
    return load_raw(path)
