"""be/project 서비스(TS): 표지 조회·포인트목록 조립 + 관리자 표지·도식 쓰기.

후속 wave(be/chat load-all 코퍼스·fe/browse)가 계약으로 쓰는 공개 시그니처:
- list_projects() -> list[ProjectSummary]
- get_index(slug: str) -> ProjectIndex | None
- update_project_admin(slug: str, content: str) -> ProjectIndex
- set_diagram_admin(slug: str, svg: bytes) -> ProjectIndex

관리자 조회는 공개 경로와 물리적으로 분리해 draft 포인트를 포함한다:
- list_all_admin() -> list[ProjectSummary]
- get_index_admin(slug: str) -> ProjectIndex | None

포인트 목록은 저장하지 않고 be/point service.list_by_project(slug)로 파생한다
(데이터.md §7.3 · 티켓 §5·§8). be/point 내부는 읽기 호출만 한다.
"""

from __future__ import annotations

from xml.etree import ElementTree

import yaml

from app.point import service as point_service
from app.project import repository
from app.project.models import ProjectIndex, ProjectSummary

MAX_DIAGRAM_SVG_BYTES = 2 * 1024 * 1024


class ProjectNotFoundError(LookupError):
    """관리자 쓰기 대상 프로젝트가 존재하지 않음."""


class InvalidProjectError(ValueError):
    """관리자 편집 원문이 프로젝트 표지 규약을 충족하지 않음."""


class InvalidDiagramError(ValueError):
    """업로드 도식이 SVG 계약을 충족하지 않음."""


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


def list_all_admin() -> list[ProjectSummary]:
    """관리자 카탈로그용 프로젝트 전량. published 포인트 유무로 재정렬하지 않는다."""
    return [_to_summary(raw) for raw in repository.iter_raw()]


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


def get_index_admin(slug: str) -> ProjectIndex | None:
    """관리자용 표지 + draft·published 포인트 목록. 없는 slug면 None."""
    raw = repository.find_raw_by_slug(slug)
    if raw is None:
        return None
    points = [point for point in point_service.list_all_admin() if point.project == slug]
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


def get_raw_admin(slug: str) -> str | None:
    """관리자 편집기 프리필용 index.md 원문. 없으면 None."""
    path = repository.index_path_of_slug(slug)
    if path is None:
        return None
    with path.open("r", encoding="utf-8", newline="") as file:
        return file.read()


def update_project_admin(slug: str, content: str) -> ProjectIndex:
    """전체 index.md 원문을 검증·원자적 저장하고 관리자 인덱스를 재조회한다."""
    if not content.strip():
        raise InvalidProjectError("content가 비어 있습니다.")

    if repository.index_path_of_slug(slug) is None:
        raise ProjectNotFoundError(slug)

    try:
        frontmatter, _ = repository._split_frontmatter(content)
    except (TypeError, ValueError, yaml.YAMLError) as exc:
        raise InvalidProjectError(f"마크다운 파싱 실패: {exc}") from exc

    frontmatter_slug = frontmatter.get("slug")
    if frontmatter_slug is not None and frontmatter_slug != slug:
        raise InvalidProjectError("frontmatter slug가 URL slug와 일치하지 않습니다.")

    try:
        repository.save_index_markdown(slug, content)
    except FileNotFoundError as exc:
        raise ProjectNotFoundError(slug) from exc

    updated = get_index_admin(slug)
    if updated is None:
        raise ProjectNotFoundError(slug)
    return updated


def _validate_diagram_svg(svg: bytes) -> None:
    """빈 값·크기·XML 파싱·SVG 루트 태그를 저장 전에 검증."""
    if not svg:
        raise InvalidDiagramError("SVG 본문이 비어 있습니다.")
    if len(svg) > MAX_DIAGRAM_SVG_BYTES:
        raise InvalidDiagramError("SVG는 2 MiB 이하여야 합니다.")

    try:
        root = ElementTree.fromstring(svg)
    except (ElementTree.ParseError, ValueError) as exc:
        raise InvalidDiagramError("올바른 XML 형식의 SVG가 아닙니다.") from exc

    # 표준 SVG 네임스페이스 또는 xmlns 없는 최소 SVG만 허용한다.
    if root.tag not in ("svg", "{http://www.w3.org/2000/svg}svg"):
        raise InvalidDiagramError("XML 루트 요소가 <svg>여야 합니다.")


def set_diagram_admin(slug: str, svg: bytes) -> ProjectIndex:
    """관리자 SVG 업로드를 검증·원자적 저장하고 갱신 인덱스를 반환."""
    # 존재 검증을 입력 검증보다 먼저 해 없는/path traversal slug는 일관되게 404 처리한다.
    if not repository.project_exists(slug):
        raise ProjectNotFoundError(slug)
    _validate_diagram_svg(svg)

    try:
        repository.save_diagram_svg(slug, svg)
    except FileNotFoundError as exc:  # 존재 확인과 저장 사이 삭제된 경우도 404로 수렴.
        raise ProjectNotFoundError(slug) from exc

    index = get_index(slug)
    if index is None:  # 저장 직후 표지가 사라진 극단적 경쟁 조건.
        raise ProjectNotFoundError(slug)
    return index
