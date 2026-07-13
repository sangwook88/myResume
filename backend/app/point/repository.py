"""be/point 리포지토리: wiki/<project>/<id>.md 마크다운을 파싱해 raw dict로 로드.

파일 구조 (데이터.md):
- frontmatter YAML: id·title·project·status·tags·commits·updated
- 본문 9섹션(H2 헤딩): 제목·요약 / 배경 / 문제 / 고려한 옵션(표) / 결정과 근거 /
  실행 / 결과 / 회고 / Evidence(표)

be/project 소유인 `index.md`는 이 도메인 대상이 아니므로 스캔에서 제외한다.
콘텐츠 루트는 리포 루트의 `wiki/` (WIKI_ROOT 환경변수로 재정의 가능 — 검증용).

이 모듈은 파싱과 기존 문서의 원자적 저장을 담당한다(Pydantic 미의존).
DTO 조립·편집 검증은 service가 담당하고, 발행 게이트(publish_errors)는
scripts/publish.py가 재사용한다.
"""

from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path
from typing import Iterator

import yaml

# repository.py = backend/app/point/repository.py → parents[3] = 리포 루트
_DEFAULT_WIKI = Path(__file__).resolve().parents[3] / "wiki"
WIKI_ROOT = Path(os.environ.get("WIKI_ROOT", str(_DEFAULT_WIKI)))

# 본문 텍스트 섹션(표가 아닌 것). options/evidence는 표라 별도 처리.
_TEXT_SECTIONS = ("background", "problem", "decision", "execution", "result", "retrospective")

# invidence(챗봇 전용 숨은 층 — ARCHITECTURE §v4-A) 헤딩.
# 본문 숨은 섹션: `## 챗봇전용 [[E{n}]]` (n = 이 포인트 Evidence 배열의 1-based 순번).
# 사이드카 <id>.code.md: `## [[E{n}]]`. 둘 다 공개 파싱(_canonical_heading)에선 무시된다.
_INVIDENCE_DETAIL_RE = re.compile(r"^#{1,6}\s+챗봇전용\s+\[\[E(\d+)\]\]\s*$")
_INVIDENCE_CODE_RE = re.compile(r"^#{1,6}\s+\[\[E(\d+)\]\]\s*$")

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


def _parse_keyed_blocks(text: str, heading_re: re.Pattern[str]) -> dict[int, str]:
    """헤딩이 `heading_re`(E{n} 캡처)에 맞는 블록만 {n: 블록텍스트}로 분할.

    invidence detail(본문 숨은 섹션)·code(사이드카) 파싱에 공용. 다른 헤딩이 나오면
    현재 블록을 닫는다(누수 방지) — 공개 섹션 사이에 끼어 있어도 안전.
    """
    result: dict[int, str] = {}
    current: int | None = None
    buf: list[str] = []
    for line in text.splitlines():
        h = re.match(r"^#{1,6}\s+", line)
        if h:
            if current is not None:
                result[current] = "\n".join(buf).strip()
            m = heading_re.match(line)
            current = int(m.group(1)) if m else None
            buf = []
        elif current is not None:
            buf.append(line)
    if current is not None:
        result[current] = "\n".join(buf).strip()
    return result


def _code_sidecar_path(md_path: Path) -> Path:
    """`wiki/<project>/<id>.md` → 형제 사이드카 `<id>.code.md`."""
    return md_path.with_name(md_path.stem + ".code.md")


def _load_invidence(body: str, md_path: Path) -> dict[int, dict]:
    """숨은 섹션 detail + 사이드카 code를 Evidence 순번(1-based)별로 합친다.

    공개 조회에는 절대 실리지 않는다(load_raw의 `_invidence` 내부 키로만).
    """
    detail = _parse_keyed_blocks(body, _INVIDENCE_DETAIL_RE)
    code: dict[int, str] = {}
    sidecar = _code_sidecar_path(md_path)
    if sidecar.exists():
        code = _parse_keyed_blocks(sidecar.read_text(encoding="utf-8"), _INVIDENCE_CODE_RE)
    merged: dict[int, dict] = {}
    for n in set(detail) | set(code):
        entry: dict = {}
        if detail.get(n):
            entry["detail"] = detail[n]
        if code.get(n):
            entry["code"] = code[n]
        if entry:
            merged[n] = entry
    return merged


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


def parse_markdown(text: str, path: Path) -> dict:
    """마크다운 원문 → raw dict(status 포함).

    ``path``는 invidence.code 사이드카 위치와 내부 ``_path``를 정하는 기준이다.
    저장 전 편집 원문도 실제 대상 경로를 기준으로 같은 파서를 거친다.
    """
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
        # 챗봇 전용 숨은 층(ARCHITECTURE §v4-A). 공개 DTO/서비스엔 절대 노출 안 함 —
        # get_chatbot_point 접근자만 읽는다. {n(1-based): {detail?, code?}}.
        "_invidence": _load_invidence(body, path),
        "_path": str(path),
    }


def load_raw(path: Path) -> dict:
    """마크다운 파일 1개 → raw dict(status 포함). 파싱 실패는 예외로 전파."""
    with path.open("r", encoding="utf-8", newline="") as file:
        return parse_markdown(file.read(), path)


def iter_raw() -> Iterator[dict]:
    """wiki/ 하위 모든 포인트 마크다운을 로드(index.md 제외).

    v1 서빙 모델 = load-all. 파싱 실패는 전파되어 라우터에서 표준 5xx로 이어진다(§6).
    """
    if not WIKI_ROOT.exists():
        return
    for path in sorted(WIKI_ROOT.rglob("*.md")):
        if path.name == "index.md":  # be/project 소유
            continue
        if path.name.endswith(".code.md"):  # invidence.code 사이드카(포인트 아님)
            continue
        yield load_raw(path)


def find_raw_by_id(point_id: str) -> dict | None:
    """id로 단건 raw 조회(status 무관). 없으면 None."""
    for raw in iter_raw():
        if raw.get("id") == point_id:
            return raw
    return None


def path_of_id(point_id: str) -> Path | None:
    """실존 포인트를 스캔해 id가 일치하는 파일 경로만 반환한다.

    사용자 입력으로 경로를 조합하지 않으므로 ``../``·절대경로 형태의 id도
    실존 문서 frontmatter와 일치하지 않으면 경로가 만들어지지 않는다.
    """
    for raw in iter_raw():
        if raw.get("id") == point_id:
            return Path(raw["_path"])
    return None


def save_markdown(path: Path, text: str) -> None:
    """마크다운 원문을 같은 디렉토리의 임시 파일을 거쳐 원자적으로 교체한다."""
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(text)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_path, path)
    except BaseException:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise


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
