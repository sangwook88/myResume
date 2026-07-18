---
id: 0014
title: be/project — 랜딩 카탈로그 read model로 프로젝트별 상세 호출 제거
branch: feat/be-project-landing-read-model
base: main
domain: be/project
stage: C
pattern: TS
status: ready
engine: codex
created: 2026-07-17
---

# [0014] be/project — 랜딩 카탈로그 read model로 프로젝트별 상세 호출 제거

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 추측하지 말고 멈추고 질문한다. 「범위 경계」 밖 파일은 건드리지 않는다.

## 1. 배경·목표

랜딩은 프로젝트 카드의 `slug`·`name`·`summary`·`techStack`을 모두 필요로 한다. 현 `GET /api/projects`는 앞 세 필드만 반환하므로, FE가 목록을 받은 뒤 각 slug의 `GET /api/projects/{slug}`를 병렬 호출한다. 이는 캐시 미스·재검증 때 `목록 1 + 프로젝트 수 N` HTTP 호출을 만든다.

이 티켓은 `be/project`가 랜딩 전용 read model을 한 응답으로 반환하게 한다. 포인트 존재 여부에 따른 기존 카탈로그 정렬은 유지하되, `be/point`의 batch slug 집합을 한 번만 읽는다.

- 근거: [be/project 프로젝트목록조회](../../docs/be/project/기능_프로젝트목록조회.md) · [데이터](../../docs/be/project/데이터.md) · [ARCHITECTURE §2·§3·§4·§5](../../docs/arch/ARCHITECTURE.md)
- 전제: **be/0013 완료 후** `point_service.list_published_project_slugs()`를 소비한다.

## 2. 책임 도메인 분류

| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/project` |
| 단계 | C |
| 가로지르는 도메인 | `be/project → be/point` — published 프로젝트 slug 집합을 읽어 기존 0-포인트 후순위 규칙을 적용한다. `fe/browse → be/project` — 랜딩 카탈로그를 HTTP로 소비한다. |
| 분류 근거 | 프로젝트 표지의 `techStack`과 랜딩용 카탈로그 response shape는 `be/project`가 소유한다. 포인트는 정렬 판단용 읽기 의존일 뿐이다. |

## 3. 구조 결정 (패턴 타협)

- 채택: **TS 유지** — 표지 raw 목록 한 번 읽기 + published slug set 한 번 읽기 + DTO 조립의 얇은 절차다.
- 기존 `ProjectSummary`와 `GET /api/projects`는 관리자·기존 소비자의 계약을 보존하기 위해 바꾸지 않는다.
- 새 `LandingProject` DTO와 `GET /api/projects/landing`을 추가한다. 이 DTO는 랜딩 카드에 필요한 필드만 담고 `ProjectIndex`의 역할·기간·아키텍처·하이라이트·포인트 본문은 담지 않는다.
- `service.list_landing_projects()`는 `repository.iter_raw()`를 한 번 materialize하고, `point_service.list_published_project_slugs()`를 한 번 호출한다. 각 프로젝트마다 `list_by_project()`를 호출하면 안 된다.

## 4. 변경 대상 (파일·경로 구체)

| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `backend/app/project/models.py` | camelCase Pydantic DTO `LandingProject` 추가: `slug`, `name`, `summary`, `tech_stack: list[str]`. |
| 수정 | `backend/app/project/service.py` | `list_landing_projects() -> list[LandingProject]` 추가. 모든 project raw를 한 번 읽고 be/0013의 published slug set으로 기존 0-포인트 후순위 정렬을 유지한다. |
| 수정 | `backend/app/project/router.py` | `GET /api/projects/landing` 추가. 반드시 `GET /api/projects/{slug}`보다 먼저 선언한다. |

## 5. 인터페이스·시그니처 (구체)

```py
class LandingProject(CamelModel):
    slug: str
    name: str
    summary: str
    tech_stack: list[str]

def list_landing_projects() -> list[LandingProject]: ...
```

- `GET /api/projects/landing` → JSON camelCase `LandingProject[]`.
- 각 원소는 `{ slug, name, summary, techStack }`만 가진다. `techStack`은 해당 `index.md` frontmatter의 문자열 배열이며 없으면 `[]`.
- 모든 프로젝트를 반환한다. published 포인트가 하나 이상인 프로젝트가 먼저, 0개 프로젝트가 뒤에 온다. 각 순위군 내부 정렬은 기존 구현의 slug 순서를 유지한다.
- `GET /api/projects`, `GET /api/projects/{slug}`, 관리자 endpoint, `ProjectSummary`, `ProjectIndex` 계약은 변경하지 않는다.

## 6. 엣지 케이스

| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 프로젝트가 없음 | `[]` 반환 | service |
| 프로젝트에 `techStack` 없음 | 해당 원소의 `techStack: []` | repository DTO 조립 |
| published 포인트 0개 프로젝트 | 응답에는 포함하되 후순위 | service |
| 프로젝트 raw에는 있으나 published slug set에는 없음 | 0-포인트 그룹으로 처리 | service |
| published slug set에 표지 없는 slug가 있음 | 카탈로그 원소를 새로 만들지 않고 무시 | service |
| 포인트 Markdown 파싱 실패 | be/0013의 batch 함수 오류를 숨기지 않고 표준 5xx로 전파 | service / router |

## 7. 수용 기준 — 결과문

- [ ] `GET /api/projects/landing` 한 응답에 랜딩 카드가 필요한 `slug`, `name`, `summary`, `techStack`이 모두 있다.
- [ ] `list_landing_projects()`는 project raw 전체 1회 + `list_published_project_slugs()` 1회만 사용하며 프로젝트별 `list_by_project()`를 호출하지 않는다.
- [ ] published 포인트 0개 프로젝트는 현행 카탈로그와 같이 후순위로 남는다.
- [ ] 기존 프로젝트 목록·프로젝트 인덱스·관리자 API의 response shape와 동작은 바뀌지 않는다.
- [ ] §6 각 행이 적힌 기대 동작대로다.

## 8. 범위 경계 — 하지 말 것

- `be/point` 구현 수정 금지. be/0013의 service 계약만 읽는다.
- `fe/browse`·`fe/chat`·`be/chat` 수정 금지.
- `ProjectIndex`에 랜딩 전용 필드를 넣거나, 포인트 목록을 `index.md`에 저장하거나, 새 DB·캐시·의존을 도입하지 않는다.
- 기존 `GET /api/projects`를 삭제·확장·의미 변경하지 않는다.
- QA·검증 금지 — 구현만. 테스트 실행·수동 검증·수용 기준 판정은 하지 않는다(감독 Codex 몫).

## 9. 검증 방법

- 감독자는 published 포인트 보유 프로젝트, 0개 프로젝트, 빈 `techStack` 프로젝트를 섞은 임시 위키로 `GET /api/projects/landing`의 필드·순서를 확인한다.
- 감독자는 `point_service.list_by_project` spy가 landing endpoint 동안 호출되지 않고 `list_published_project_slugs`만 한 번 호출되는지 확인한다.
- 기존 `GET /api/projects`, `GET /api/projects/{slug}`, 관리자 목록 응답 회귀를 확인한다.

## 10. 참조

- ARCHITECTURE §2·§3·§4·§5
- [be/project 데이터](../../docs/be/project/데이터.md) · [프로젝트목록조회](../../docs/be/project/기능_프로젝트목록조회.md)
- 선행 [be/0013](0013-be-point-read-bundles.md) · 후속 [fe/0010](../fe/0010-fe-browse-read-models.md)
