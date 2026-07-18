"""be/project DTO (Pydantic). API 직렬화 키 케이스 = camelCase (ARCHITECTURE §5).

계약 근거: tickets/be/0002-be-project.md §5, tickets/be/0011-be-project-profile.md §5.
- Profile/ProfileEdit = 사이트 프로필 조회·관리자 편집 DTO
- ProjectSummary = { slug, summary }
- ProjectIndex = ProjectSummary + { role, period, teamSize, techStack,
  architecture, highlights, points: PointSummary[] }

camelCase 직렬화 규약(CamelModel)과 포인트 요약(PointSummary)은 be/point의
공개 모델을 그대로 재사용한다(읽기 재사용 — 단일 API 계약 유지). 포인트 목록은
표지에 저장하지 않고 be/point에서 파생한다(데이터.md §7.3).
"""

from __future__ import annotations

from app.point.models import CamelModel, PointSummary


class Profile(CamelModel):
    """랜딩에 노출하는 사이트 단위 프로필."""

    name: str = ""
    headline: str = ""
    photo: str | None = None
    github: str = ""
    phone: str = ""
    email: str = ""
    intro: str = ""


class ProfileEdit(CamelModel):
    """관리자 프로필 편집 입력. 빈 값도 유효한 저장 값이다."""

    name: str = ""
    headline: str = ""
    photo: str | None = None
    github: str = ""
    phone: str = ""
    email: str = ""
    intro: str = ""


class ProjectSummary(CamelModel):
    """랜딩 카탈로그용 요약 카드."""

    slug: str
    name: str  # 사람이 읽는 표시 이름(frontmatter name, 없으면 slug 폴백)
    summary: str


class LandingProject(CamelModel):
    """랜딩 카드에 필요한 프로젝트 카탈로그 read model."""

    slug: str
    name: str
    summary: str
    tech_stack: list[str]


class ProjectEdit(CamelModel):
    """관리자 편집 입력. 서식 손실을 막기 위해 전체 index.md 원문을 받는다."""

    content: str


class ProjectIndex(ProjectSummary):
    """프로젝트인덱스 화면 본체: 표지 6요소 + 파생 포인트 목록."""

    role: str
    period: str
    team_size: str
    tech_stack: list[str]
    architecture: str
    # 압축 아키텍처 도식(컴파일된 SVG) 상대경로 — 없으면 None(도식 optional, ARCHITECTURE §v4-C).
    architecture_diagram: str | None = None
    highlights: list[str]
    points: list[PointSummary]
