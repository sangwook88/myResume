---
id: 0010
title: fe/browse — 랜딩·포인트상세 read model 소비로 다중 API 조립 제거
branch: feat/fe-browse-read-models
base: main
domain: fe/browse
stage: V
pattern: TS
status: ready
engine: codex
created: 2026-07-17
---

# [0010] fe/browse — 랜딩·포인트상세 read model 소비로 다중 API 조립 제거

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 추측하지 말고 멈추고 질문한다. 「범위 경계」 밖 파일은 건드리지 않는다.

## 1. 배경·목표

랜딩은 `GET /api/projects` 뒤 각 프로젝트 `GET /api/projects/{slug}`를 호출해 `techStack`을 조립하고, 포인트 상세는 단건과 같은 프로젝트 목록을 두 API로 조립한다. FE는 데이터 조립 규칙을 소유하지 않으므로, 각 화면이 필요한 데이터가 완결된 BE read model을 소비하도록 전환한다.

- 랜딩: `GET /api/projects/landing`의 `LandingProject[]`를 추천 포인트와 병렬로 읽는다.
- 포인트 상세: `GET /api/points/{id}/page`의 `PointPage`를 한 번 읽어 `PointView`에 기존 props를 전달한다.

UI 구조·카드·필터·상세 표현·라우팅은 바꾸지 않는다. Next 서버 컴포넌트의 기존 `getJson` ISR 정책도 그대로이므로 새 URL별 응답은 기존 `next: { revalidate }` 규칙을 따른다.

- 근거: [fe/browse 플로우](../../docs/fe/browse/플로우.md) · [ARCHITECTURE §1·§2·§5](../../docs/arch/ARCHITECTURE.md)
- 전제: **be/0013·be/0014 완료 후** 새 HTTP 계약을 소비한다.

## 2. 책임 도메인 분류

| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `fe/browse` |
| 단계 | V |
| 가로지르는 도메인 | `fe/browse → be/project` — `LandingProject[]` 소비. `fe/browse → be/point` — `PointPage` 소비. |
| 분류 근거 | 어떤 read model을 어느 서버 페이지에서 호출해 기존 화면 props로 전달할지는 FE 플로우·표현의 책임이며, 데이터 조립 규칙은 BE에 남긴다. |

## 3. 구조 결정 (패턴 타협)

- FE는 플로우+V이므로 TS/DM 패턴을 새로 도입하지 않는다.
- `frontend/lib/types.ts`에 BE JSON과 같은 `LandingProject`, `PointPage` 인터페이스를 추가하고, `frontend/lib/api.ts`에서 새 URL을 소비한다.
- 랜딩의 `LandingExplorer`는 `projects` props를 기존처럼 배열로 받아 `useMemo`·필터·`map()`으로만 처리한다. 받은 props를 Context 또는 중복 `useState`에 복사하지 않는다.
- 포인트 상세의 `PointView` props(`point`, `siblings`)는 유지한다. page가 `PointPage`를 분해해 그대로 전달하므로 표현 컴포넌트 변경을 최소화한다.

## 4. 변경 대상 (파일·경로 구체)

| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `frontend/lib/types.ts` | `LandingProject { slug, name, summary, techStack }`, `PointPage { point: Point; siblings: PointSummary[] }` export 추가. |
| 수정 | `frontend/lib/api.ts` | `getLandingProjects(): Promise<LandingProject[]>` → `/api/projects/landing`, `getPointPage(id): Promise<PointPage | null>` → `/api/points/{id}/page` 추가. 기존 `getProjects`, `getProjectIndex`, `getPoint`은 삭제·변경하지 않는다. |
| 수정 | `frontend/app/page.tsx` | `getProjects`·프로젝트별 `getProjectIndex` `Promise.all`·null filter·수동 `LandingProject` map을 제거. `getRecommendedPoints`와 `getLandingProjects`만 병렬 호출해 `LandingExplorer`에 전달. |
| 수정 | `frontend/components/LandingExplorer.tsx` | 파일 내부 `LandingProject` interface 선언을 제거하고 `@/lib/types`의 type import를 사용. 카드·필터·표현 로직은 무변. |
| 수정 | `frontend/app/points/[id]/page.tsx` | `getPoint` 뒤 `getProjectPoints`를 호출하는 두 단계 조립을 `getPointPage(params.id)` 한 번으로 교체. null이면 기존처럼 `redirect('/')`, 아니면 `pointPage.point`·`pointPage.siblings`를 `PointView`에 전달. |

## 5. 인터페이스·시그니처 (구체)

```ts
export interface LandingProject {
  slug: string;
  name: string;
  summary: string;
  techStack: string[];
}

export interface PointPage {
  point: Point;
  siblings: PointSummary[];
}

export async function getLandingProjects(): Promise<LandingProject[]>;
export async function getPointPage(id: string): Promise<PointPage | null>;
```

- `getLandingProjects()`은 `getJson<LandingProject[]>('/api/projects/landing') ?? []`를 사용한다.
- `getPointPage(id)`는 `getJson<PointPage>(\`/api/points/\${encodeURIComponent(id)}/page\`)`를 사용한다. null은 기존 `getPoint`처럼 라우트 redirect 판단에만 쓴다.
- `LandingExplorer`의 props shape는 `recommended: PointSummary[]; projects: LandingProject[]`로 유지한다.
- `PointView`의 props shape·형제 카드 렌더·챗봇 URL 맥락은 변경하지 않는다.

## 6. 엣지 케이스

| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 랜딩 프로젝트 0개 | 기존 프로젝트 empty state를 유지 | LandingExplorer |
| 랜딩 프로젝트의 `techStack: []` | 스택 태그·필터 facet에 나타나지 않으며 카드의 기존 조건부 렌더를 유지 | LandingExplorer |
| 새 landing/page endpoint 네트워크 실패 또는 302 | `getJson`이 `[]` 또는 null로 폴백; 랜딩은 empty state, 포인트 상세는 `redirect('/')` | api.ts / page |
| 포인트에 형제 없음 | `siblings: []`를 `PointView`에 전달; 기존 형제 섹션 미표시 | points/[id] / PointView |
| 포인트 id에 URL 예약문자 | `encodeURIComponent(id)`로 경로 인코딩 | api.ts |
| 기술 스택 필터 활성 | 기존 `selected` state와 `useMemo`를 그대로 사용해 포인트·프로젝트 목록을 함께 필터 | LandingExplorer |

## 7. 수용 기준 — 결과문

- [ ] 랜딩 서버 페이지는 `getRecommendedPoints()`와 `getLandingProjects()`만 병렬 호출하고 프로젝트별 `getProjectIndex()` 호출을 하지 않는다.
- [ ] 랜딩 카드와 기술 스택 필터는 기존 표시·선택·빈 상태 동작을 유지한다.
- [ ] 포인트 상세 서버 페이지는 `getPointPage()` 한 번으로 `PointView`에 현재 포인트와 형제 목록을 전달한다.
- [ ] 없는/draft 포인트와 API 실패의 랜딩 redirect 동작, 형제 0개일 때의 UI 동작이 기존과 같다.
- [ ] 기존 프로젝트 상세·관리자·챗봇·기존 `getProjects`/`getProjectIndex`/`getPoint` 소비자는 변경하지 않는다.
- [ ] §6 각 행이 적힌 기대 동작대로다.

## 8. 범위 경계 — 하지 말 것

- `backend/`·`docs/`·`tickets/` 외 새 BE 변경 금지. be/0013·be/0014의 API 계약만 소비한다.
- `frontend/components/ProjectView.tsx`, `frontend/components/PointView.tsx`, `frontend/components/ChatFab.tsx`, 관리자 페이지·CSS·라우팅 구조 변경 금지.
- Context, Zustand, Redux, SWR/React Query, 새 client state·새 라이브러리 도입 금지.
- `REVALIDATE_SECONDS`·`getJson` 캐시 정책·기존 API helper 삭제/리네이밍 금지.
- QA·검증 금지 — 구현만. 테스트 실행·수동 검증·수용 기준 판정은 하지 않는다(감독 Codex 몫).

## 9. 검증 방법

- 감독자는 새 BE read model fixture로 랜딩을 열어 추천·프로젝트 카드·기술 스택 필터가 이전과 같은지 확인하고, 서버 로그에서 프로젝트별 상세 API 호출이 사라졌는지 확인한다.
- 감독자는 포인트 상세를 열어 현재 본문·형제 목록·형제 없음·없는/draft id redirect를 확인하고, 페이지 로드에 point read API가 한 번만 사용되는지 확인한다.
- 감독자는 프로젝트 상세·관리자·챗봇 진입을 확인해 기존 helper와 props 계약의 회귀가 없는지 판정한다.

## 10. 참조

- ARCHITECTURE §1·§2·§5
- [fe/browse 플로우](../../docs/fe/browse/플로우.md) · [HOME 참조 그래프](../../docs/HOME.md)
- 선행 [be/0013](../be/0013-be-point-read-bundles.md), [be/0014](../be/0014-be-project-landing-read-model.md)

