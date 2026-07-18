---
id: 0013
title: be/point — 공개 읽기 묶음으로 포인트 상세·프로젝트 존재 조회 단일 스캔화
branch: feat/be-point-read-bundles
base: main
domain: be/point
stage: C
pattern: TS
status: ready
engine: codex
created: 2026-07-17
---

# [0013] be/point — 공개 읽기 묶음으로 포인트 상세·프로젝트 존재 조회 단일 스캔화

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 추측하지 말고 멈추고 질문한다. 「범위 경계」 밖 파일은 건드리지 않는다.

## 1. 배경·목표

공개 랜딩은 프로젝트별 published 포인트 존재 여부를 알아야 하고, 포인트 상세는 현재 포인트와 같은 프로젝트의 다른 포인트 요약을 함께 보여 준다. 현 구현은 `list_by_project(slug)`가 호출될 때마다 전체 포인트 Markdown을 다시 스캔하고, 포인트 상세 FE도 단건·형제목록 API를 따로 호출한다.

이 티켓은 포인트 데이터 소유자인 `be/point`에 두 가지 읽기 계약을 추가한다.

- `be/project`가 프로젝트 전체의 published 포인트 존재 여부를 **한 번의 전체 스캔 결과**로 판단할 수 있는 내부 서비스 함수
- 포인트 상세 화면이 현재 포인트와 형제 요약 목록을 **한 HTTP 응답·한 전체 스캔**으로 받을 수 있는 공개 read model

콘텐츠 원천은 계속 `wiki/<project>/<id>.md`이고, 서버 간 영속 캐시·관계형 DB·새 의존은 도입하지 않는다. Next.js ISR은 이 API 응답을 호출자 쪽에서 재사용하는 별도 계층이며, 이 티켓은 캐시 미스 때의 반복 스캔/요청 구조를 줄인다.

- 근거: [be/point 포인트단건조회](../../docs/be/point/기능_포인트단건조회.md) · [포인트목록조회](../../docs/be/point/기능_포인트목록조회.md) · [ARCHITECTURE §1·§2·§4·§5](../../docs/arch/ARCHITECTURE.md)
- 관련 현행 코드: `backend/app/point/repository.py:253`의 load-all `iter_raw()`, `backend/app/point/service.py:73`·`:109`, `frontend/app/points/[id]/page.tsx`

## 2. 책임 도메인 분류

| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/point` |
| 단계 | C |
| 가로지르는 도메인 | `be/project → be/point` — 프로젝트 카탈로그 정렬을 위해 published 프로젝트 slug 집합을 읽는다. `fe/browse → be/point` — 포인트 상세 read model을 HTTP로 소비한다. |
| 분류 근거 | published 여부·포인트 단건·같은 프로젝트 포인트 요약은 모두 포인트 Markdown과 status를 소유한 `be/point`의 읽기 규칙이다. |

## 3. 구조 결정 (패턴 타협)

- 채택: **TS 유지** — Markdown load-all → published 필터 → DTO 조립의 얇은 읽기 절차다. 새 엔티티·불변식·상태 전이는 만들지 않는다.
- 공개 `GET /api/points/{point_id}`의 `Point` 계약과 `service.get_published()`는 그대로 둔다. 챗봇 등 기존 소비자를 깨지 않기 위해, 화면 조립 결과는 별도 `GET /api/points/{point_id}/page`·`PointPage`로 추가한다.
- `get_published_page()`는 `repository.iter_raw()`를 한 번 materialize한 뒤, 그 동일 컬렉션에서 target과 siblings를 조립한다. target을 찾은 뒤 `list_by_project()`를 다시 호출하면 안 된다.
- `list_published_project_slugs()`는 REST 엔드포인트가 아닌 `be/project` 전용 서비스 계약이다. published raw를 한 번 스캔해 `set[str]`를 반환한다. `be/project`가 포인트 repository를 직접 읽어서는 안 된다.

## 4. 변경 대상 (파일·경로 구체)

| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `backend/app/point/models.py` | camelCase Pydantic DTO `PointPage` 추가: `point: Point`, `siblings: list[PointSummary]`. |
| 수정 | `backend/app/point/service.py` | published raw를 한 번 수집하는 private helper 추가. `list_published_project_slugs() -> set[str]`, `get_published_page(point_id: str) -> PointPage | None` 구현. target·siblings 모두 같은 수집 결과로 조립. |
| 수정 | `backend/app/point/router.py` | `GET /api/points/{point_id}/page`를 `GET /api/points/{point_id}` 앞에 추가. published target이면 `PointPage`, 없거나 draft면 기존 공개 단건과 동일하게 302 `/`. |

## 5. 인터페이스·시그니처 (구체)

```py
class PointPage(CamelModel):
    point: Point
    siblings: list[PointSummary]

def list_published_project_slugs() -> set[str]: ...
def get_published_page(point_id: str) -> PointPage | None: ...
```

- `GET /api/points/{point_id}/page` → JSON camelCase `{ point: Point, siblings: PointSummary[] }`.
- `point`는 기존 `GET /api/points/{point_id}`와 필드·공개 범위가 동일하다. `_invidence`, draft, code sidecar는 어떤 경우에도 포함하지 않는다.
- `siblings`는 target과 같은 `project`의 published `PointSummary[]`이며 target 자신은 제외한다. 기존 `list_by_project()`와 같은 `updated` 내림차순을 적용한다.
- `list_published_project_slugs()`는 published 포인트가 하나 이상인 프로젝트 slug만 중복 없이 반환한다. `be/project` 외 도메인에 REST로 노출하지 않는다.
- 기존 `GET /api/points/recommended`, `GET /api/points?project=<slug>`, `GET /api/points/{point_id}`, `get_published()`, `list_by_project()`의 반환 shape와 의미는 변경하지 않는다.

## 6. 엣지 케이스

| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 위키에 포인트가 없음 | `list_published_project_slugs()`는 빈 set, page endpoint는 302 `/` | service / router |
| target id가 없음 또는 draft | `PointPage`를 만들지 않고 302 `/`; draft 존재 여부를 노출하지 않음 | service / router |
| target만 published이고 형제 없음 | `siblings: []`를 반환 | service |
| 같은 프로젝트에 draft 형제 존재 | draft는 `siblings`에서 제외 | service |
| target과 형제의 `updated` 동률 | 기존 목록과 동일한 안정 정렬 결과를 유지 | service |
| Markdown 파싱 실패 | 기존 load-all 정책대로 표준 5xx로 전파; 빈 응답으로 숨기지 않음 | repository / router |
| 챗봇이 기존 `get_published()` 호출 | 반환 `Point` 및 동작이 그대로여야 함 | service |

## 7. 수용 기준 — 결과문

- [ ] `GET /api/points/{id}/page`는 published 포인트 본문과 target을 제외한 published 형제 요약을 한 JSON 응답으로 반환한다.
- [ ] page endpoint 한 요청에서 `repository.iter_raw()` 전체 순회는 한 번만 일어난다.
- [ ] target id가 없거나 draft면 기존 단건과 동일하게 302 `/`이고, `_invidence`는 응답에 없다.
- [ ] `list_published_project_slugs()`는 전체 포인트 스캔 한 번으로 published 프로젝트 slug 집합을 반환한다.
- [ ] 기존 공개 포인트 API와 챗봇이 쓰는 `get_published()`의 계약은 바뀌지 않는다.
- [ ] §6 각 행이 적힌 기대 동작대로다.

## 8. 범위 경계 — 하지 말 것

- `be/project`·`be/chat`·`fe/browse` 구현 수정 금지. 다음 티켓이 새 계약을 소비한다.
- 관계형 DB, Redis, 프로세스 전역 캐시, 새 Python 의존 추가 금지.
- 포인트 Markdown 스키마·발행 게이트·추천 선정 규칙·기존 `GET /api/points/{id}` response shape 변경 금지.
- QA·검증 금지 — 구현만. 테스트 실행·수동 검증·수용 기준 판정은 하지 않는다(감독 Codex 몫).

## 9. 검증 방법

- 감독자는 임시 위키에 같은 프로젝트의 published 2개·draft 1개와 다른 프로젝트 published 1개를 두고 page endpoint 응답의 target·siblings·draft 제외·302을 확인한다.
- 감독자는 repository spy 또는 계측으로 page endpoint와 `list_published_project_slugs()` 각각의 `iter_raw()` 호출 횟수가 1회인지 확인한다.
- 기존 `GET /api/points/{id}`와 챗봇 포인트 조회 회귀를 확인한다.

## 10. 참조

- ARCHITECTURE §1·§2·§4·§5
- [be/point 데이터](../../docs/be/point/데이터.md) · [포인트단건조회](../../docs/be/point/기능_포인트단건조회.md) · [포인트목록조회](../../docs/be/point/기능_포인트목록조회.md)
- 선행 없음 · 후속 [be/0014](0014-be-project-landing-read-model.md), [fe/0010](../fe/0010-fe-browse-read-models.md)
