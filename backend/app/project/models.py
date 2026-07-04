"""be/project DTO (Pydantic). API 직렬화 키 케이스 = camelCase (ARCHITECTURE §5).

계약 근거: tickets/be/0002-be-project.md §5.
- ProjectSummary = { slug, summary }
- ProjectIndex = ProjectSummary + { role, period, teamSize, techStack,
  architecture, highlights, points: PointSummary[] }

camelCase 직렬화 규약(CamelModel)과 포인트 요약(PointSummary)은 be/point의
공개 모델을 그대로 재사용한다(읽기 재사용 — 단일 API 계약 유지). 포인트 목록은
표지에 저장하지 않고 be/point에서 파생한다(데이터.md §7.3).
"""

from __future__ import annotations

from app.point.models import CamelModel, PointSummary


class ProjectSummary(CamelModel):
    """랜딩 카탈로그용 요약 카드."""

    slug: str
    summary: str


class ProjectIndex(ProjectSummary):
    """프로젝트인덱스 화면 본체: 표지 6요소 + 파생 포인트 목록."""

    role: str
    period: str
    team_size: str
    tech_stack: list[str]
    architecture: str
    highlights: list[str]
    points: list[PointSummary]
