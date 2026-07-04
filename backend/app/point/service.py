"""be/point 서비스(TS): 조회 3종. published만 노출한다.

후속 wave(be/project·be/chat)가 계약으로 쓰는 공개 시그니처:
- list_recommended() -> list[PointSummary]
- list_by_project(project: str) -> list[PointSummary]
- get_published(point_id: str) -> Point | None
"""

from __future__ import annotations

from app.point import repository
from app.point.models import Evidence, Option, Point, PointSummary, Sections

_FEATURED = "featured"


def _to_summary(raw: dict) -> PointSummary:
    return PointSummary(
        id=raw["id"],
        title=raw["title"],
        tags=raw.get("tags") or [],
        project=raw["project"],
    )


def _published(raws: list[dict]) -> list[dict]:
    return [r for r in raws if r.get("status") == "published"]


def list_recommended() -> list[PointSummary]:
    """추천 포인트 상위 3: `featured` 태그 우선 → 동점 `updated` 최신순."""
    pub = _published(list(repository.iter_raw()))
    # 안정 정렬: 먼저 updated 최신순, 그 위에 featured 우선(같은 그룹은 최신순 유지).
    pub.sort(key=lambda r: r.get("updated") or "", reverse=True)
    pub.sort(key=lambda r: 0 if _FEATURED in (r.get("tags") or []) else 1)
    return [_to_summary(r) for r in pub[:3]]


def list_by_project(project: str) -> list[PointSummary]:
    """해당 project의 published 요약 목록(없으면 빈 리스트). 정렬은 구현 기본(updated 최신순)."""
    pub = [r for r in _published(list(repository.iter_raw())) if r.get("project") == project]
    pub.sort(key=lambda r: r.get("updated") or "", reverse=True)
    return [_to_summary(r) for r in pub]


def get_published(point_id: str) -> Point | None:
    """id로 published 단건 조회. 없거나 draft면 None(라우터가 302 처리)."""
    raw = repository.find_raw_by_id(point_id)
    if raw is None or raw.get("status") != "published":
        return None

    sec = raw.get("sections") or {}
    options = [Option(**o) for o in sec.get("options", [])] if sec.get("options") else None
    sections = Sections(
        background=sec.get("background"),
        problem=sec.get("problem"),
        options=options,
        decision=sec.get("decision"),
        execution=sec.get("execution"),
        result=sec.get("result"),
        retrospective=sec.get("retrospective"),
    )
    evidence = [Evidence(**e) for e in raw.get("evidence", [])]
    return Point(
        id=raw["id"],
        title=raw["title"],
        tags=raw.get("tags") or [],
        project=raw["project"],
        summary=raw.get("summary") or "",
        sections=sections,
        evidence=evidence,
    )
