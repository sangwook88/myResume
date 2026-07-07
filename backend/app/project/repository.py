"""be/project 리포지토리: wiki/<slug>/index.md 표지 마크다운을 파싱해 raw dict로 로드.

파일 구조 (데이터.md · ARCHITECTURE §5):
- frontmatter YAML: slug·summary·role·period·teamSize·techStack·architecture·highlights
- architecture는 길면 frontmatter 대신 본문 마크다운으로 둘 수 있어,
  frontmatter에 없으면 본문 전체(있으면)로 보완한다.

slug 정본은 디렉토리 이름(`wiki/<slug>/`)이다 — 포인트의 `project` frontmatter와 매칭되는 값.
이 모듈은 순수 파싱만 한다(Pydantic 미의존). DTO 조립은 service가 담당한다.

콘텐츠 루트는 be/point와 동일하게 리포 루트의 `wiki/`(검증용 WIKI_ROOT로 재정의 가능).
be/point 리포지토리를 import하지 않고 같은 환경변수만 공유한다(도메인 내부 비침범).
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Iterator

import yaml

# repository.py = backend/app/project/repository.py → parents[3] = 리포 루트
_DEFAULT_WIKI = Path(__file__).resolve().parents[3] / "wiki"
WIKI_ROOT = Path(os.environ.get("WIKI_ROOT", str(_DEFAULT_WIKI)))


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

    return {
        "slug": path.parent.name,  # 디렉토리 이름이 정본 slug
        "name": str(fm.get("name") or path.parent.name),  # 표시 이름(없으면 slug 폴백)
        "summary": str(fm.get("summary") or ""),
        "role": str(fm.get("role") or ""),
        "period": str(fm.get("period") or ""),
        "team_size": str(fm.get("teamSize") or ""),
        "tech_stack": _as_list(fm.get("techStack")),
        "architecture": str(architecture or ""),
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
