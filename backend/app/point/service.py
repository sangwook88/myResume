"""be/point 서비스(TS): 조회 3종. published만 노출한다.

후속 wave(be/project·be/chat)가 계약으로 쓰는 공개 시그니처:
- list_recommended() -> list[PointSummary]
- list_by_project(project: str) -> list[PointSummary]
- get_published(point_id: str) -> Point | None
"""

from __future__ import annotations

from app.point import repository
from app.point.models import (
    AdminPointSummary,
    ChatbotEvidence,
    ChatbotPoint,
    Evidence,
    Option,
    Point,
    PointSummary,
    Sections,
)

_FEATURED = "featured"


def _to_summary(raw: dict) -> PointSummary:
    return PointSummary(
        id=raw["id"],
        title=raw["title"],
        tags=raw.get("tags") or [],
        project=raw["project"],
        summary=raw.get("summary") or "",
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


def _sections_from_raw(raw: dict) -> Sections:
    """raw dict의 sections 블록 → Sections DTO(공개·챗봇 경로 공용)."""
    sec = raw.get("sections") or {}
    options = [Option(**o) for o in sec.get("options", [])] if sec.get("options") else None
    return Sections(
        background=sec.get("background"),
        problem=sec.get("problem"),
        options=options,
        decision=sec.get("decision"),
        execution=sec.get("execution"),
        result=sec.get("result"),
        retrospective=sec.get("retrospective"),
    )


def _to_point(raw: dict) -> Point:
    """raw dict → 공개 Point DTO(invidence 제외). status 필터는 호출측 책임."""
    evidence = [Evidence(**e) for e in raw.get("evidence", [])]
    return Point(
        id=raw["id"],
        title=raw["title"],
        tags=raw.get("tags") or [],
        project=raw["project"],
        summary=raw.get("summary") or "",
        sections=_sections_from_raw(raw),
        evidence=evidence,
    )


def get_published(point_id: str) -> Point | None:
    """id로 published 단건 조회. 없거나 draft면 None(라우터가 302 처리).

    **공개 경로 — invidence(숨은 detail·code)는 절대 포함하지 않는다**(ARCHITECTURE §v4-A).
    """
    raw = repository.find_raw_by_id(point_id)
    if raw is None or raw.get("status") != "published":
        return None
    return _to_point(raw)


# ── 관리자 조회 (draft 포함 — 라우터에서 require_admin 게이트) ──


def _to_admin_summary(raw: dict) -> AdminPointSummary:
    return AdminPointSummary(
        id=raw["id"],
        title=raw["title"],
        tags=raw.get("tags") or [],
        project=raw["project"],
        summary=raw.get("summary") or "",
        status=raw.get("status") or "draft",
        updated=raw.get("updated"),
    )


def list_all_admin() -> list[AdminPointSummary]:
    """draft·published 전량(관리자용). updated 최신순, status·updated 포함."""
    raws = list(repository.iter_raw())
    raws.sort(key=lambda r: r.get("updated") or "", reverse=True)
    return [_to_admin_summary(r) for r in raws]


def get_any_admin(point_id: str) -> Point | None:
    """id로 단건(draft 포함, 관리자용). 없으면 None. 공개 get_published 와 달리 status 무관.

    invidence 는 여기서도 싣지 않는다 — 관리자는 공개 렌더 그대로 미리보기(초안 검수)한다.
    """
    raw = repository.find_raw_by_id(point_id)
    if raw is None:
        return None
    return _to_point(raw)


def get_chatbot_point(point_id: str) -> ChatbotPoint | None:
    """be/chat 코퍼스 전용 접근자 — published 단건 + invidence 부착(ARCHITECTURE §v4-A).

    각 Evidence 에 순번(1-based) 매칭으로 숨은 detail·code 를 붙인다. 없거나 draft면 None.
    공개 조회(get_published)와 물리 분리 — 이 함수만 `_invidence` 를 읽는다.
    """
    raw = repository.find_raw_by_id(point_id)
    if raw is None or raw.get("status") != "published":
        return None

    invidence = raw.get("_invidence") or {}
    evidence: list[ChatbotEvidence] = []
    for i, e in enumerate(raw.get("evidence", []), start=1):
        inv = invidence.get(i) or invidence.get(str(i)) or {}
        evidence.append(ChatbotEvidence(**e, detail=inv.get("detail"), code=inv.get("code")))
    return ChatbotPoint(
        id=raw["id"],
        title=raw["title"],
        tags=raw.get("tags") or [],
        project=raw["project"],
        summary=raw.get("summary") or "",
        sections=_sections_from_raw(raw),
        evidence=evidence,
    )
