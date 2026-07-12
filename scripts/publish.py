#!/usr/bin/env python
"""발행 게이트 CLI: 포폴 포인트를 draft → published 로 승격.

사용법: python scripts/publish.py <id>

게이트(데이터.md#enum · 티켓 §5): Evidence ≥1개 AND 핵심 섹션
(1 제목·요약 / 3 문제 / 5 결정과 근거 / 9 Evidence) 채워짐.
- 통과: frontmatter `status: published` 로 기록(0 종료).
- 미충족/미발견: status 불변 + 사유 출력 후 비영(non-zero) 종료.

frontmatter 재작성은 status 줄만 치환해 저작 포맷을 보존한다.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]

# backend 패키지의 repository(파싱·게이트)를 단일 소스로 재사용.
_BACKEND = _REPO_ROOT / "backend"
sys.path.insert(0, str(_BACKEND))

from app.point import repository  # noqa: E402

# invidence.code 추출(ARCHITECTURE §v4-A). kind 가 아래인 Evidence 만 대상.
_CODE_KINDS = ("commit", "pr")
# 추출 hunk 크기 상한(문자). 초과 시 앞부분만 남기고 잘림 표시. 수치는 구현 튜닝(env).
_CODE_MAX_CHARS = int(os.environ.get("POINT_CODE_MAX_CHARS", "8000"))
_TRUNCATED_MARK = "\n…(잘림)"
# 커밋이 사는 git 저장소(기본 = 이 리포). 포크가 소스 프로젝트를 가리키게 재정의 가능.
_GIT_DIR = Path(os.environ.get("POINT_CODE_GIT_DIR", str(_REPO_ROOT)))

_SHA_IN_URL_RE = re.compile(r"/commit/([0-9a-f]{7,40})")
_SHA_TAIL_RE = re.compile(r"([0-9a-f]{7,40})$")


def _set_status_published(path: Path) -> None:
    """frontmatter 블록 안의 status 값만 published로 치환(없으면 추가)."""
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^(---\s*\n)(.*?\n)(---\s*\n?)(.*)$", text, re.DOTALL)
    if not m:
        raise ValueError("frontmatter('---' 블록) 파싱 실패")
    head, fm, close, body = m.groups()
    if re.search(r"(?m)^status:\s*.*$", fm):
        fm = re.sub(r"(?m)^status:\s*.*$", "status: published", fm)
    else:
        fm = fm + "status: published\n"
    path.write_text(head + fm + close + body, encoding="utf-8")


def _git_diff(args: list[str]) -> str | None:
    """git diff/show 실행 → 출력(문자열). 실패(미설치·미존재 ref)면 None."""
    try:
        out = subprocess.run(
            ["git", "-C", str(_GIT_DIR), *args],
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return out.stdout


def _extract_hunk(kind: str, url: str, commits: str | None) -> str | None:
    """Evidence 1건의 변경 hunk 텍스트를 git 으로 추출. 실패하면 None(발행 안 막음).

    - commit: url 의 커밋 해시로 `git show --format=`(커밋 메타 제외, diff 만).
    - pr: frontmatter `commits`(a..b range)로 `git diff a..b`. range 없으면 None.
    """
    if kind == "commit":
        m = _SHA_IN_URL_RE.search(url) or _SHA_TAIL_RE.search(url or "")
        if not m:
            return None
        diff = _git_diff(["show", "--no-color", "--format=", m.group(1)])
    elif kind == "pr":
        if not commits or ".." not in commits:
            return None
        diff = _git_diff(["diff", "--no-color", commits])
    else:
        return None
    if not diff or not diff.strip():
        return None
    diff = diff.strip()
    if len(diff) > _CODE_MAX_CHARS:
        diff = diff[:_CODE_MAX_CHARS].rstrip() + _TRUNCATED_MARK
    return diff


def _extract_code(raw: dict) -> None:
    """commit·pr Evidence 의 hunk 를 사이드카 `<id>.code.md` 에 `## [[E{n}]]` 블록으로 기록.

    재발행 시 덮어씀(버전 누적 안 함). 아무 code 도 못 뽑으면 사이드카를 만들지 않는다.
    개별 ref 해석 실패는 그 Evidence 만 건너뛰고 발행을 계속한다(ARCHITECTURE §v4-A).
    """
    commits = raw.get("commits")
    blocks: list[str] = []
    for i, ev in enumerate(raw.get("evidence", []), start=1):
        if (ev.get("kind") or "").strip().lower() not in _CODE_KINDS:
            continue
        hunk = _extract_hunk(ev["kind"].strip().lower(), ev.get("url") or "", commits)
        if hunk:
            blocks.append(f"## [[E{i}]]\n{hunk}")

    sidecar = repository._code_sidecar_path(Path(raw["_path"]))
    if not blocks:
        return
    header = "<!-- 자동 생성(scripts/publish.py) — 챗봇 코퍼스 전용 invidence.code. 직접 편집 금지. -->"
    sidecar.write_text(header + "\n\n" + "\n\n".join(blocks) + "\n", encoding="utf-8")
    print(f"[코드추출] {sidecar.name} ({len(blocks)}개 Evidence)")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("사용법: python scripts/publish.py <id>", file=sys.stderr)
        return 2

    point_id = argv[1]
    raw = repository.find_raw_by_id(point_id)
    if raw is None:
        print(f"[거부] id '{point_id}' 포인트를 찾을 수 없습니다.", file=sys.stderr)
        return 1

    errors = repository.publish_errors(raw)
    if errors:
        print(f"[거부] '{point_id}' 발행 게이트 미충족:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    # invidence.code 추출(발행 게이트 통과 뒤 1회). 이미 published 여도 재추출해 갱신.
    _extract_code(raw)

    if raw.get("status") == "published":
        print(f"[정보] '{point_id}' 는 이미 published 입니다.")
        return 0

    _set_status_published(Path(raw["_path"]))
    print(f"[발행] '{point_id}' → published")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
