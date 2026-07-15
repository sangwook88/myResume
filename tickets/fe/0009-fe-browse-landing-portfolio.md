---
id: 0009
title: fe/browse 랜딩 프로필 헤더 제거 — 프로젝트·추천 포인트 즉시 노출(포트폴리오형)
branch: feat/fe-browse-landing-portfolio
base: main
domain: fe/browse
stage: V
pattern:
status: ready
engine: codex
created: 2026-07-15
---

# [0009] fe/browse 랜딩 프로필 헤더 제거 — 콘텐츠 즉시 노출

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
랜딩(`/`) 좌측 최상단의 **프로필 헤더**(사진·이름·연락처·자기소개 + `Projects`/`Case studies`/`Proof` 스탯 스트립, fe/0007에서 넣은 `<ProfileHeader>`)를 **제거**한다. 목적: 채용자가 랜딩을 열면 **자기소개 서두 없이 곧바로 "내가 한 프로젝트와 추천 구현 포인트"**를 보게 하는 포트폴리오형 랜딩. 사이트 타이틀 "근거기반 포트폴리오"는 이미 상단 **브랜드바**(`layout.tsx`)에 있으므로 랜딩 본문엔 별도 타이틀을 추가하지 않는다. 좌측 본문은 프로필 없이 **① 추천 구현 사례(추천 포인트) → ② 프로젝트(기술 스택 포함)** 순서로 바로 시작하고, 우측 레일(기술 스택 필터 + 근거 챗봇)은 무변.

- 이 티켓은 사실상 **fe/0007의 랜딩 부분 되돌리기**다(관리자 프로필 편집 `/admin/profile`·be/0011 프로필 API는 **건드리지 않는다** — 데이터·편집 경로는 남겨두고, 랜딩 렌더에서만 프로필을 뗀다).
- 근거 코드: `frontend/components/LandingExplorer.tsx`(현재 `<ProfileHeader … />` 렌더 + `profile` prop) · `frontend/app/page.tsx`(서버 컴포넌트 병렬 fetch에 `getProfile()` 포함) · `frontend/components/ProfileHeader.tsx`(제거 대상 헤더, `Projects`/`Case studies` 스탯 포함) · `frontend/app/portfolio.css`(`.profile-header*` 스타일 · `.landing-main` 상단 여백).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `fe/browse` (랜딩 표현 재구성) |
| 단계 | V |
| 가로지르는 도메인 | 없음(순수 FE 표현 변경). be/project 프로필 API 계약·호출 규약 변경 없음 |
| 분류 근거 | 데이터·규칙 변화 없음. 어떤 위젯을 랜딩에 렌더하느냐의 표현(V) 결정뿐 |

## 2b. 웨이브
- 단일 FE 티켓, 선행 없음(현행 코드만 수정).

## 3. 구조 결정
- **프로필 렌더 제거:** `LandingExplorer`에서 `<ProfileHeader profile={profile} projectCount={…} caseCount={…} />` 블록을 **삭제**하고, `ProfileHeader` import·`profile` prop·`filter-note` 위에 있던 프로필 관련 요소를 제거한다. 좌측 `<div className="landing-main">`의 **첫 자식이 곧바로 콘텐츠**가 되게 한다: 활성 필터 노트(`filter-note`, 기존 그대로) → `<h2>추천 구현 사례</h2>` + 포인트 카드 → `<h2>프로젝트</h2>` + 프로젝트 카드. 순서·카드 마크업·필터 로직·우측 레일은 **무변**.
- **props 정리:** `LandingExplorer`의 props에서 `profile` 제거(`{ recommended, projects }`만). `page.tsx`의 `Promise.all`에서 `getProfile()` 호출을 빼고 구조분해를 `[recommended, projectSummaries]`로 줄인 뒤 `<LandingExplorer recommended={…} projects={…} />`로 넘긴다. `getProfile`/`Profile` import가 `page.tsx`에서 더 안 쓰이면 그 import도 제거(다른 사용처 없으면).
- **ProfileHeader.tsx는 삭제하지 않는다:** 컴포넌트 파일 자체는 남긴다(향후 재사용 여지 + 스코프 최소화). 단 **랜딩에서 참조하는 import·JSX는 완전히 제거**해 미사용 import 린트 에러가 없게 한다.
- **상단 여백:** 프로필 헤더가 사라지면서 좌측 콘텐츠가 최상단에 붙는다. `.landing-main` 첫 요소(`filter-note` 또는 `추천 구현 사례` `h2`)가 위에서 너무 붙거나 뜨지 않게 기존 디자인 토큰 여백과 정합되는지 확인하고, 필요 시 `.landing-main > :first-child`/`.landing-section-title:first-child`의 상단 여백만 소폭 조정(라이트/다크 공통). 새 색/컴포넌트 도입 금지.
- **프로젝트 카드(기술설명):** "프로젝트들 기술설명만 보이게"는 **현재 프로젝트 카드 그대로**(이름 `.t` + 요약 `.m` + `.stackline` 기술 스택 태그)가 이미 충족한다 — 카드 내용·필드를 새로 바꾸지 않는다. 추가 필드 노출/제거 없음.

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `frontend/components/LandingExplorer.tsx` | `import ProfileHeader …` 제거 · props에서 `profile: Profile` 제거(`Profile` import가 더 안 쓰이면 그것도) · `<ProfileHeader …/>` JSX 블록 삭제. 나머지(useState/useMemo 필터 로직·`filter-note`·추천·프로젝트·우측 레일) 무변 |
| 수정 | `frontend/app/page.tsx` | `Promise.all`에서 `getProfile()` 제거 → `[recommended, projectSummaries]`. `getProfile`(사용처 없으면) import 제거. `<LandingExplorer recommended={recommended} projects={projects} />` |
| 수정 | `frontend/app/portfolio.css` | `.landing-main` 상단이 프로필 없이도 자연스럽도록 첫 요소 상단 여백만 필요 시 소폭 조정. `.profile-header*` 스타일 블록은 (다른 곳 미사용이면) 그대로 두거나 정리 — **삭제는 선택**, 레이아웃 회귀만 없으면 됨 |

> `ProfileHeader.tsx`·`lib/api.ts`(`getProfile`)·`lib/types.ts`(`Profile`)·`lib/adminClient.ts`·`app/admin/profile/*`·`app/admin/page.tsx`는 **건드리지 않는다**(랜딩에서 참조만 끊는다).

## 5. 인터페이스·시그니처 (구체)
- `LandingExplorer`: `export default function LandingExplorer({ recommended, projects }: { recommended: PointSummary[]; projects: LandingProject[] })` — `profile` 제거.
- `page.tsx`: `const [recommended, projectSummaries] = await Promise.all([getRecommendedPoints(), getProjects()]);` 이후 기존 index 수집 로직 그대로, `return <LandingExplorer recommended={recommended} projects={projects} />;`
- 브랜드바(`layout.tsx`)·라우팅·API 호출 시그니처 변경 없음.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 추천 포인트 0개 | 기존 `empty-state`("추천 포인트가 없습니다") 그대로, 프로필 제거로 인한 회귀 없음 | LandingExplorer |
| 프로젝트 0개(전부 비공개 index) | 기존 `empty-state` 그대로 | LandingExplorer |
| 기술 스택 필터 활성 | `filter-note`가 좌측 최상단에 뜬다(프로필이 없어진 자리) — 레이아웃 정상 | LandingExplorer/CSS |
| BE 미기동으로 fetch 빈 배열 | 프로필 없이도 추천·프로젝트 empty-state 정상 렌더(프로필 폴백 로직 의존 제거) | page |
| 다크/라이트 | 콘텐츠가 최상단에 붙어도 여백·구분선이 두 테마 모두 자연스러움 | portfolio.css |
| 미사용 import 잔존 | `ProfileHeader`/`Profile`/`getProfile` 미사용 import 없음(빌드·린트 통과) | 전 파일 |

## 7. 수용 기준 — 결과문
- [ ] 랜딩(`/`)에서 프로필 헤더(사진·이름·연락처·자기소개·`Projects`/`Case studies`/`Proof` 스탯)가 **완전히 사라진다**.
- [ ] 좌측 본문이 프로필 없이 **곧바로 「추천 구현 사례」(추천 포인트) → 「프로젝트」(기술 스택 포함)** 순으로 보인다.
- [ ] 우측 레일(기술 스택 필터 + 근거 챗봇)·필터 동작·카드 링크는 **이전과 동일하게** 작동한다.
- [ ] 상단 브랜드바의 "근거기반 포트폴리오" 타이틀·네비는 그대로다(랜딩 본문에 별도 타이틀 추가 없음).
- [ ] 콘텐츠가 최상단에 붙어도 여백/정렬이 자연스럽다(라이트·다크).
- [ ] 빌드·린트 통과(미사용 import 없음), `/admin/profile` 및 프로필 API는 손대지 않았다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- **BE·프로필 API·`/admin/profile` 편집 경로 변경 금지**(랜딩 렌더에서만 프로필을 뗀다). `ProfileHeader.tsx` 파일 **삭제 금지**(참조만 제거). `lib/api.ts`의 `getProfile`·`lib/types.ts`의 `Profile` 타입 **삭제 금지**(랜딩에서 import만 끊음).
- 추천·프로젝트 목록의 **순서 재편·카드 필드 추가/삭제 금지**(추천 포인트 먼저 → 프로젝트, 카드 마크업 현행 유지). 우측 레일·챗봇·필터 로직 변경 금지.
- 브랜드바 타이틀 이동/재배치, 새 히어로/배너/타이틀 컴포넌트 **신설 금지**. 새 라이브러리·디자인 토큰·색 도입 금지.
- 포인트/프로젝트 상세 페이지, 관리자 화면, 챗 등 **랜딩 외 화면** 변경 금지.

## 9. 검증 방법
- `frontend`에서 빌드/린트(`npm run build` 또는 `next lint`) 통과 확인(미사용 import 없음).
- 랜딩 로드 → 프로필 헤더 부재 + 추천 구현 사례가 최상단, 그 아래 프로젝트(기술 스택 태그) 확인.
- 우측 레일 기술 스택 필터 토글 시 포인트·프로젝트 목록이 함께 필터되고 `filter-note`가 좌측 상단에 뜨는지 확인.
- 라이트/다크 모두 상단 여백·정렬 확인. `/admin/profile` 진입·저장이 이전과 동일하게 동작(회귀 없음)하는지 확인.

## 10. 참조
- 되돌림 대상: fe/0007(`tickets/fe/0007-fe-browse-profile.md`) — 랜딩 프로필 헤더 도입. 이 티켓은 그 **랜딩 렌더만** 되돌린다(관리자 편집·BE는 유지).
- 코드: `frontend/components/LandingExplorer.tsx` · `frontend/app/page.tsx` · `frontend/components/ProfileHeader.tsx`(제거 대상 참조) · `frontend/app/portfolio.css`(`.landing-main`/`.profile-header*`) · `frontend/app/layout.tsx`(브랜드바 타이틀, 무변).
