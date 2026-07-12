#!/usr/bin/env python
"""도식컴파일(ARCHITECTURE §v4-C): typst 아키텍처 도식 소스 → 정적 SVG.

사용법:
  python scripts/compile_diagrams.py            # 전체 프로젝트
  python scripts/compile_diagrams.py <slug>     # 한 프로젝트
  python scripts/compile_diagrams.py [-y|--yes] # 실패 시 자동으로 '비우고 진행'

빌드/발행 시 1회 실행하는 빌드타임 유틸 — 서빙 런타임은 이 스크립트도 typst 도 부르지
않고 정적 SVG 만 낸다. 각 `wiki/<slug>/architecture.typ` 를 `architecture.svg` 로 컴파일한다.
- 소스(`.typ`) 없으면 스킵(그 프로젝트는 architectureDiagram=null 로 노출).
- 컴파일 실패(typst 미설치·문법오류): 사람에게 물어 '도식 비우고 진행 / 중단'. 기본=진행.
  비대화(-y 또는 파이프)면 기본(진행)으로 간다.

typst 는 발행 전용 의존(requirements-publish.txt) — 발행 안 하는 포크엔 없어도 된다.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_WIKI = _REPO_ROOT / "wiki"
WIKI_ROOT = Path(os.environ.get("WIKI_ROOT", str(_DEFAULT_WIKI)))


def _confirm_skip(slug: str, reason: str, assume_yes: bool) -> bool:
    """도식 없이 진행할지 사람에게 묻는다. True=비우고 진행, False=중단.

    비대화(assume_yes 또는 비-tty)면 기본 제안(진행)으로.
    """
    msg = f"[도식] '{slug}' 컴파일 실패: {reason}"
    print(msg, file=sys.stderr)
    if assume_yes or not sys.stdin.isatty():
        print("  → 비대화 모드: 도식 비우고 진행(architectureDiagram=null).", file=sys.stderr)
        return True
    ans = input("  도식 비우고 발행할까요? [Y=진행 / n=중단]: ").strip().lower()
    return ans in ("", "y", "yes")


def compile_one(slug_dir: Path, assume_yes: bool) -> str:
    """프로젝트 1개 컴파일. 반환: 'compiled' | 'skipped' | 'failed-skip'. 중단이면 SystemExit."""
    src = slug_dir / "architecture.typ"
    out = slug_dir / "architecture.svg"
    if not src.is_file():
        return "skipped"  # 소스 없음 → SVG 손대지 않음

    try:
        import typst  # noqa: PLC0415 (발행 전용 지연 임포트)

        typst.compile(str(src), output=str(out), format="svg")
    except ImportError:
        if _confirm_skip(slug_dir.name, "typst 미설치(pip install -r requirements-publish.txt)", assume_yes):
            return "failed-skip"
        raise SystemExit(f"[중단] '{slug_dir.name}' 도식 컴파일 불가로 발행 중단.")
    except Exception as exc:  # noqa: BLE001 — 문법오류 등 모든 컴파일 실패를 한 규칙으로
        if _confirm_skip(slug_dir.name, f"{type(exc).__name__}: {exc}", assume_yes):
            return "failed-skip"
        raise SystemExit(f"[중단] '{slug_dir.name}' 도식 컴파일 실패로 발행 중단.")

    print(f"[도식] {slug_dir.name}/architecture.svg 생성")
    return "compiled"


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith("-")]
    assume_yes = any(a in ("-y", "--yes") for a in argv[1:])

    if not WIKI_ROOT.exists():
        print(f"[도식] WIKI_ROOT 없음: {WIKI_ROOT}", file=sys.stderr)
        return 0

    if args:
        targets = [WIKI_ROOT / args[0]]
    else:
        targets = sorted(p.parent for p in WIKI_ROOT.glob("*/index.md"))

    stats = {"compiled": 0, "skipped": 0, "failed-skip": 0}
    for slug_dir in targets:
        if not slug_dir.is_dir():
            print(f"[도식] 프로젝트 디렉토리 없음: {slug_dir}", file=sys.stderr)
            continue
        stats[compile_one(slug_dir, assume_yes)] += 1

    print(f"[도식] 완료 — 컴파일 {stats['compiled']} / 소스없음 {stats['skipped']} / 실패-스킵 {stats['failed-skip']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
