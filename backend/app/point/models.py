"""be/point DTO (Pydantic). API 직렬화 키 케이스 = camelCase (ARCHITECTURE §5).

계약 근거: tickets/be/0001-be-point.md §5.
- PointSummary = { id, title, tags, project, summary }
- Point = PointSummary + { sections{...}, evidence[] }
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """모든 DTO의 공통 설정: JSON 직렬화 키는 camelCase(별칭), 내부 필드는 snake_case."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Evidence(CamelModel):
    """근거 링크 1건 (데이터.md#evidence). 포인트당 1개 이상 필수(발행 게이트)."""

    kind: str  # commit | pr | swagger | file | link
    label: str
    url: str


class Option(CamelModel):
    """'고려한 옵션' 표의 한 행 (데이터.md §4, 고정 컬럼 옵션·장점·단점·비용/리스크·채택)."""

    option: str | None = None
    pros: str | None = None
    cons: str | None = None
    cost: str | None = None
    adopted: str | None = None


class Sections(CamelModel):
    """9섹션 본문 중 프론트매터·요약을 뺀 나머지. 선택 섹션은 비면 None(응답에서 생략)."""

    background: str | None = None
    problem: str | None = None
    options: list[Option] | None = None
    decision: str | None = None
    execution: str | None = None
    result: str | None = None
    retrospective: str | None = None


class PointSummary(CamelModel):
    """목록·추천용 요약 카드. 요약(summary)은 목록에서 '어떤 포인트인지'를 한 줄로
    보여주기 위해 포함한다(published 는 발행 게이트가 summary 를 보장)."""

    id: str
    title: str
    tags: list[str]
    project: str
    summary: str


class Point(PointSummary):
    """단건 조회 전체: 요약(PointSummary) + 9섹션 본문 + Evidence."""

    sections: Sections
    evidence: list[Evidence]


class ChatbotEvidence(Evidence):
    """챗봇 코퍼스 전용 Evidence — invidence(숨은 detail·code) 부착 (ARCHITECTURE §v4-A).

    detail = 사람이 쓴 숨은 섹션, code = 발행 시 git에서 뽑은 hunk. 공개 DTO(Evidence)엔
    없다 — 이 확장 모델은 get_chatbot_point 경로에서만 만들어진다(공개/비공개 물리 분리).
    invidence 는 인용(Citation) 대상이 아니다.
    """

    detail: str | None = None
    code: str | None = None


class ChatbotPoint(Point):
    """챗봇 코퍼스 전용 단건 — Evidence 를 ChatbotEvidence(invidence 포함)로 교체."""

    evidence: list[ChatbotEvidence]
