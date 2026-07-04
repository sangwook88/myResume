"""be/point 리포지토리: wiki/<project>/<id>.md 마크다운을 파싱해 raw dict로 로드.

파일 구조 (데이터.md):
- frontmatter YAML: id·title·project·status·tags·commits·updated
- 본문 9섹션(H2 헤딩): 제목·요약 / 배경 / 문제 / 고려한 옵션(표) / 결정과 근거 /
  실행 / 결과 / 회고 / Evidence(표)

be/project 소유인 `index.md`는 이 도메인 대상이 아니므로 스캔에서 제외한다.
콘텐츠 루트는 리포 루트의 `wiki/` (WIKI_ROOT 환경변수로 재정의 가능 — 검증용).

이 모듈은 순수 파싱만 한다(Pydantic 미의존). DTO 조립은 service가 담당하고,
발행 게이트(publish_errors)는 scripts/publish.py가 재사용한다.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Iterator

import yaml

# repository.py = backend/app/point/repository.py → parents[3] = 리포 루트
_DEFAULT_WIKI = Path(__file__).resolve().parents[3] / "wiki"
WIKI_ROOT = Path(os.environ.get("WIKI_ROOT", str(_DEFAULT_WIKI)))

# 본문 텍스트 섹션(표가 아닌 것). options/evidence는 표라 별도 처리.
_TEXT_SECTIONS = ("background", "problem", "decision", "execution", "result", "retrospective")

# 표 컬럼 → DTO 필드 키워드 매핑(부분일치, 앞 항목 우선).
_OPTION_COLS = [
    ("옵션", "option"),
    ("장점", "pros"),
    ("단점", "cons"),
    ("비용", "cost"),
    ("리스크", "cost"),
    ("채택", "adopted"),
]
_EVIDENCE_COLS = [
    ("kind", "kind"),
    ("종류", "kind"),
    ("label", "label"),
    ("라벨", "label"),
    ("url", "url"),
    ("링크", "url"),
]


def _canonical_heading(text: str) -> str | None:
    """헤딩 문자열 → 9섹션 정규 키(부분일치). 인식 못 하면 None."""
    t = text.strip()
    tl = t.lower()
    if "evidence" in tl:
        return "evidence"
    if "결정" in t:  # 결정과 근거 (주의: '근거' 단독으로 매칭하면 Evidence와 충돌)
        return "decision"
    if "요약" in t:  # 제목·요약 / 요약
        return "summary"
    if "배경" in t:
        return "background"
    if "고려" in t or "옵션" in t:  # 고려한 옵션
        return "options"
    if "문제" in t:
        return "problem"
    if "실행" in t:
        return "execution"
    if "결과" in t:
        return "result"
    if "회고" in t:
        return "retrospective"
    return None


def _split_frontmatter(text: str) -> tuple[dict, str]:
    """'---' 로 감싼 frontmatter YAML과 본문을 분리."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", text, re.DOTALL)
    if not m:
        raise ValueError("frontmatter('---' 블록)를 찾을 수 없음")
    fm = yaml.safe_load(m.group(1)) or {}
    if not isinstance(fm, dict):
        raise ValueError("frontmatter가 매핑(YAML dict)이 아님")
    return fm, m.group(2)


def _parse_sections(body: str) -> dict[str, str]:
    """본문을 헤딩 기준으로 섹션 정규키 → 원문 블록(텍스트)으로 분할."""
    sections: dict[str, str] = {}
    current: str | None = None
    buf: list[str] = []
    for line in body.splitlines():
        h = re.match(r"^#{1,6}\s+(.*)$", line)
        if h:
            if current is not None:
                sections[current] = "\n".join(buf).strip()
            current = _canonical_heading(h.group(1))
            buf = []
        elif current is not None:
            buf.append(line)
    if current is not None:
        sections[current] = "\n".join(buf).strip()
    sections.pop(None, None)  # 인식 못 한 헤딩 아래 내용은 버림
    return sections


def _split_row(line: str) -> list[str]:
    """마크다운 표 한 줄 → 셀 리스트."""
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _map_col(header_cell: str, colmap: list[tuple[str, str]]) -> str | None:
    h = header_cell.strip().lower()
    for kw, key in colmap:
        if kw.lower() in h:
            return key
    return None


def _parse_table(block: str, colmap: list[tuple[str, str]]) -> list[dict]:
    """마크다운 표 블록 → 행 dict 리스트(헤더 컬럼을 DTO 키로 매핑)."""
    if not block:
        return []
    lines = [l for l in block.splitlines() if l.strip().startswith("|")]
    if len(lines) < 2:
        return []
    keys = [_map_col(c, colmap) for c in _split_row(lines[0])]
    rows: list[dict] = []
    for line in lines[2:]:  # [1]은 구분선(---)
        cells = _split_row(line)
        if not any(c for c in cells):
            continue
        row = {k: c for k, c in zip(keys, cells) if k}
        if row:
            rows.append(row)
    return rows


def load_raw(path: Path) -> dict:
    """마크다운 파일 1개 → raw dict(status 포함). 파싱 실패는 예외로 전파."""
    text = path.read_text(encoding="utf-8")
    fm, body = _split_frontmatter(text)
    parsed = _parse_sections(body)

    updated = fm.get("updated")
    if hasattr(updated, "isoformat"):  # yaml이 date로 파싱한 경우
        updated = updated.isoformat()

    tags = fm.get("tags") or []
    if isinstance(tags, str):
        tags = [tags]

    sections: dict = {}
    for key in _TEXT_SECTIONS:
        val = parsed.get(key)
        if val:
            sections[key] = val
    options = _parse_table(parsed.get("options", ""), _OPTION_COLS)
    if options:
        sections["options"] = options

    evidence = _parse_table(parsed.get("evidence", ""), _EVIDENCE_COLS)

    return {
        "id": fm.get("id"),
        "title": fm.get("title"),
        "project": fm.get("project"),
        "status": fm.get("status") or "draft",
        "tags": list(tags),
        "commits": fm.get("commits"),
        "updated": updated,
        "summary": parsed.get("summary"),
        "sections": sections,
        "evidence": evidence,
        "_path": str(path),
    }


def iter_raw() -> Iterator[dict]:
    """wiki/ 하위 모든 포인트 마크다운을 로드(index.md 제외).

    v1 서빙 모델 = load-all. 파싱 실패는 전파되어 라우터에서 표준 5xx로 이어진다(§6).
    """
    if not WIKI_ROOT.exists():
        return
    for path in sorted(WIKI_ROOT.rglob("*.md")):
        if path.name == "index.md":  # be/project 소유
            continue
        yield load_raw(path)


def find_raw_by_id(point_id: str) -> dict | None:
    """id로 단건 raw 조회(status 무관). 없으면 None."""
    for raw in iter_raw():
        if raw.get("id") == point_id:
            return raw
    return None


def publish_errors(raw: dict) -> list[str]:
    """발행 게이트 검증: Evidence≥1 + 핵심 섹션(1 제목·요약 / 3 문제 / 5 결정과 근거 / 9 Evidence).

    반환 = 위반 사유 리스트(빈 리스트면 발행 가능). scripts/publish.py가 사용.
    """
    errs: list[str] = []
    if not (raw.get("title") or "").strip():
        errs.append("제목(title) 비어 있음")
    if not (raw.get("summary") or "").strip():
        errs.append("요약(섹션 1 제목·요약) 비어 있음")
    sections = raw.get("sections") or {}
    if not (sections.get("problem") or "").strip():
        errs.append("문제(섹션 3) 비어 있음")
    if not (sections.get("decision") or "").strip():
        errs.append("결정과 근거(섹션 5) 비어 있음")
    if not raw.get("evidence"):
        errs.append("Evidence(섹션 9) 최소 1개 필요")
    return errs
