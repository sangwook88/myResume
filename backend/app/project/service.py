"""be/project 서비스(TS): 표지 조회 + 포인트목록 조립.

후속 wave(be/chat load-all 코퍼스·fe/browse)가 계약으로 쓰는 공개 시그니처:
- list_projects() -> list[ProjectSummary]
- get_index(slug: str) -> ProjectIndex | None

포인트 목록은 저장하지 않고 be/point service.list_by_project(slug)로 파생한다
(데이터.md §7.3 · 티켓 §5·§8). be/point 내부는 읽기 호출만 한다.
"""

from __future__ import annotations

from app.point import service as point_service
from app.project import repository
from app.project.models import ProjectIndex, ProjectSummary


def _to_summary(raw: dict) -> ProjectSummary:
    return ProjectSummary(slug=raw["slug"], name=raw["name"], summary=raw["summary"])


def list_projects() -> list[ProjectSummary]:
    """카탈로그용 요약 목록. 모든 프로젝트 노출, published 포인트 0개는 후순위(티켓 §5).

    같은 순위군 정렬은 구현 기본(리포지토리의 slug 순 유지). 프로젝트 0개면 [].
    """
    with_points: list[ProjectSummary] = []
    without_points: list[ProjectSummary] = []
    for raw in repository.iter_raw():
        summary = _to_summary(raw)
        if point_service.list_by_project(raw["slug"]):
            with_points.append(summary)
        else:
            without_points.append(summary)
    return with_points + without_points


def get_index(slug: str) -> ProjectIndex | None:
    """표지 6요소 + be/point에서 조립한 published 포인트 목록. 없는 slug면 None.

    표지에 published 포인트가 없으면 points=[](FE가 슬롯 숨김 — 티켓 §6).
    """
    raw = repository.find_raw_by_slug(slug)
    if raw is None:
        return None
    points = point_service.list_by_project(slug)
    return ProjectIndex(
        slug=raw["slug"],
        name=raw["name"],
        summary=raw["summary"],
        role=raw["role"],
        period=raw["period"],
        team_size=raw["team_size"],
        tech_stack=raw["tech_stack"],
        architecture=raw["architecture"],
        architecture_diagram=raw.get("architecture_diagram"),
        highlights=raw["highlights"],
        points=points,
    )
