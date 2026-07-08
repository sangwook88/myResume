"""load-all 코퍼스 조립 (기능_답변생성.md).

published 포인트 전문(9섹션 본문 + Evidence)과 프로젝트 표지를 be/point·be/project의
**공개 서비스 시그니처로만** 읽어(내부 수정 없음) 하나의 안정적인 prefix 컨텍스트
문자열로 조립한다. 이 prefix 는 크고 안정적이므로 프롬프트 캐싱(cache_control)의
캐시 대상이 된다(ARCHITECTURE §1 load-all 비용 대책).

RAG 아님 — v1 은 전부 로드한다. 컨텍스트 예산 초과 시 로그 경고만 남기고 그대로
시도한다(티켓 §6, 초과는 RAG(v3) 도입 신호).

전체 published 열거 경로(공개 계약만 사용):
  project_service.list_projects() → 각 slug 의 표지 get_index()
  → point_service.list_by_project(slug) → 각 id 의 전문 get_published()
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.chat.models import Citation
from app.point import service as point_service
from app.point.models import Point
from app.project import service as project_service
from app.project.models import ProjectIndex

logger = logging.getLogger(__name__)

# v1 load-all 예산 경고 임계치(대략 문자 수). 초과해도 막지 않고 경고만(티켓 §6).
_BUDGET_WARN_CHARS = 400_000


@dataclass
class CorpusBundle:
    """조립된 코퍼스와 인용 매핑.

    - text: LLM system prefix 로 넣을 전체 컨텍스트 문자열.
    - evidence: 인용 토큰(E1, E2 …) → Citation. 모델이 사용한 토큰을 되돌려 인용을 만든다.
    - point_count: 포함된 published 포인트 수. 0 이면 빈 코퍼스(근거 없음).
    """

    text: str
    evidence: dict[str, Citation] = field(default_factory=dict)
    point_of_token: dict[str, dict] = field(default_factory=dict)  # E토큰 → 출처 포인트{id,title}(v2 딥링크)
    point_count: int = 0

    @property
    def has_content(self) -> bool:
        """답변 근거가 될 published 포인트가 하나라도 있는가."""
        return self.point_count > 0


def _render_cover(idx: ProjectIndex) -> str:
    lines = [
        f"## 프로젝트: {idx.slug}",
        f"- 한줄요약: {idx.summary}",
        f"- 역할: {idx.role}",
        f"- 기간: {idx.period}",
        f"- 팀 규모: {idx.team_size}",
        f"- 기술 스택: {', '.join(idx.tech_stack)}",
        f"- 아키텍처: {idx.architecture}",
    ]
    if idx.highlights:
        lines.append("- 핵심 성과:")
        lines.extend(f"  - {h}" for h in idx.highlights)
    return "\n".join(lines)


def _render_point(
    point: Point,
    evidence: dict[str, Citation],
    point_of_token: dict[str, dict],
    counter: list[int],
) -> str:
    """포인트 1건을 코퍼스 블록으로. Evidence 는 인용 토큰을 부여해 registry 에 등록하고,
    그 토큰이 어느 포인트에서 왔는지도 기록한다(v2 인용→포인트 딥링크)."""
    lines = [f"### 포인트 [{point.id}]: {point.title} (프로젝트: {point.project})"]
    if point.tags:
        lines.append(f"- 태그: {', '.join(point.tags)}")
    if point.summary:
        lines.append(f"- 요약: {point.summary}")

    sec = point.sections
    labeled = [
        ("배경", sec.background),
        ("문제", sec.problem),
        ("결정과 근거", sec.decision),
        ("실행", sec.execution),
        ("결과", sec.result),
        ("회고", sec.retrospective),
    ]
    for title, body in labeled:
        if body:
            lines.append(f"- {title}: {body}")

    if sec.options:
        lines.append("- 고려한 옵션:")
        for o in sec.options:
            cells = [
                x for x in (o.option, o.pros, o.cons, o.cost, o.adopted) if x
            ]
            lines.append(f"  - {' | '.join(cells)}")

    if point.evidence:
        lines.append("- 근거(Evidence) — 인용 시 아래 토큰을 사용:")
        for ev in point.evidence:
            counter[0] += 1
            token = f"E{counter[0]}"
            evidence[token] = Citation(kind=ev.kind, label=ev.label, url=ev.url)
            point_of_token[token] = {"id": point.id, "title": point.title}
            lines.append(f"  - [[{token}]] kind={ev.kind} | {ev.label} | {ev.url}")

    return "\n".join(lines)


def build_corpus(context_point_id: str | None = None) -> CorpusBundle:
    """published 전체를 load-all 해 캐시 가능한 컨텍스트로 조립한다.

    context_point_id(진입 맥락)가 있으면 그 포인트를 코퍼스 맨 앞에 '가장 관련 있는
    포인트'로 우선 배치한다(기능_답변생성.md). 없는/비공개 맥락이면 무시한다.
    """
    evidence: dict[str, Citation] = {}
    point_of_token: dict[str, dict] = {}
    counter = [0]
    blocks: list[str] = []
    point_count = 0

    priority_id: str | None = None
    if context_point_id:
        priority = point_service.get_published(context_point_id)
        if priority is not None:
            priority_id = priority.id
            blocks.append("# 가장 관련 있는 포인트(진입 맥락)")
            blocks.append(_render_point(priority, evidence, point_of_token, counter))
            point_count += 1

    blocks.append("# 전체 포트폴리오 코퍼스")
    for proj in project_service.list_projects():
        idx = project_service.get_index(proj.slug)
        if idx is None:
            continue
        blocks.append(_render_cover(idx))
        for summ in point_service.list_by_project(proj.slug):
            if summ.id == priority_id:
                continue  # 맨 앞에 이미 넣음(중복 방지)
            point = point_service.get_published(summ.id)
            if point is None:
                continue
            blocks.append(_render_point(point, evidence, point_of_token, counter))
            point_count += 1

    text = "\n\n".join(blocks)
    if len(text) > _BUDGET_WARN_CHARS:
        logger.warning(
            "load-all 코퍼스가 예산 경고 임계치 초과(%d자) — v1 은 그대로 시도하되 "
            "RAG(v3) 도입 신호로 본다(티켓 §6).",
            len(text),
        )
    return CorpusBundle(
        text=text, evidence=evidence, point_of_token=point_of_token, point_count=point_count
    )


def build_point_context(point_id: str) -> str | None:
    """제안질문 생성용: 단일 포인트 핵심 섹션(제목·요약·문제·결정과 근거) 컨텍스트.

    없거나 비공개(published 아님)면 None(호출측이 빈 배열로 폴백).
    """
    point = point_service.get_published(point_id)
    if point is None:
        return None
    lines = [f"제목: {point.title}"]
    if point.summary:
        lines.append(f"요약: {point.summary}")
    if point.sections.problem:
        lines.append(f"문제: {point.sections.problem}")
    if point.sections.decision:
        lines.append(f"결정과 근거: {point.sections.decision}")
    return "\n".join(lines)
