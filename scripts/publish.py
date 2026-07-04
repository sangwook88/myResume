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

import re
import sys
from pathlib import Path

# backend 패키지의 repository(파싱·게이트)를 단일 소스로 재사용.
_BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(_BACKEND))

from app.point import repository  # noqa: E402


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

    if raw.get("status") == "published":
        print(f"[정보] '{point_id}' 는 이미 published 입니다.")
        return 0

    _set_status_published(Path(raw["_path"]))
    print(f"[발행] '{point_id}' → published")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
