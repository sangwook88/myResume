---
id: 0004
title: fe/browse 관리자 뷰 — 공개 페이지 컴포넌트 재사용 + 링크 이동(admin 플래그로 컨트롤 게이트)
branch: feat/fe-browse-admin-view
base: main
domain: fe/browse
stage: V
pattern:
status: ready
engine: codex
created: 2026-07-13
---

# [0004] fe/browse 관리자 뷰 — 표현 컴포넌트 재사용 + 링크 이동

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
관리자 조회를 지금의 **대시보드 내 접기/펼치기** 대신, 공개 사이트처럼 **링크로 실제 페이지로 이동**해 보게 한다. 공개 포인트/프로젝트 페이지의 **표현(presentational) 컴포넌트를 그대로 재사용**하고, `admin` 플래그로 **관리자 전용 컨트롤(대시보드 복귀·발행 상태 배지·편집 진입 자리)의 노출만** 다르게 한다. (편집 동작 자체는 fe/0005.)

**✅ "웹에서 흔한 방식인가" 확인(요청):** 그렇다. 이는 널리 쓰이는 **역할 기반 조건부 렌더링** 패턴 — 콘텐츠 표현은 단일 컴포넌트로 두고 `isAdmin`/`canEdit` 플래그로 편집·관리 컨트롤만 게이트한다. 선례: **WordPress**(공개 글 페이지 + 로그인 관리자에게만 admin bar·"편집" 링크), **GitHub**(리포 페이지 + 쓰기 권한자에게만 Settings/Edit·Web 편집), **Notion·Confluence**(같은 페이지에서 보기↔편집 토글), **Ghost/CMS 미리보기**. 요지는 "레이아웃·표현 중복 없이 SoT 한 벌 + 컨트롤만 조건부". → 이 티켓이 그 구조를 도입한다.

- 전제: **be/0007(be/project 관리자 조회)** + 이미 구현된 be/point 관리자 조회(`/api/points/admin`·`/admin/{id}`).
- 근거: [플로우.md](../../docs/fe/browse/플로우.md) · 기존 페이지 `frontend/app/points/[id]/page.tsx`·`frontend/app/projects/[slug]/page.tsx` · 기존 대시보드 `frontend/app/admin/page.tsx`(fe 커밋 완료분).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `fe/browse` (위키 표현 — 공개·관리자 공통) |
| 단계 | V |
| 가로지르는 도메인 | `be/point`·`be/project`(HTTP, 공개+관리자 조회 소비) |
| 분류 근거 | 렌더·라우팅·컨트롤 게이트는 FE. draft 포함 데이터 공급은 BE(관리자 조회) |

## 2b. 웨이브
- Wave 2(FE). 선행 be/0007. fe/0005(편집 UI)의 선행.

## 3. 구조 결정
- FE=V, 패턴 해당 없음. **표현 컴포넌트 추출**이 핵심:
  - `frontend/app/points/[id]/page.tsx`의 렌더 본문 → `components/PointView.tsx`(순수 컴포넌트, props로 `point`·`siblings`·`admin?`·`controls?`).
  - `frontend/app/projects/[slug]/page.tsx`의 렌더 본문 → `components/ProjectView.tsx`(props로 `project`·`admin?`·`controls?`).
- **공개 페이지(서버 컴포넌트)** = 서버 fetch(published) → View(admin=false). **관리자 페이지(클라이언트 컴포넌트)** = 토큰(Bearer)으로 관리자 조회 → 같은 View(admin=true). View는 서버/클라이언트 양쪽에서 쓰이는 순수 컴포넌트(서버 전용 API 미사용; 기존 client island인 PointRail·AskSectionButton·SelectionAsk는 그대로 자식으로 둠).
- **대시보드 변경**: 포인트 목록을 접기/펼치기 → `/admin/points/<id>` **링크**로 교체(세션 등 다른 목록은 유지).

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `frontend/components/PointView.tsx` | 포인트 상세 표현 추출(순수). props: `{ point: Point; siblings: PointSummary[]; admin?: boolean; controls?: ReactNode }`. admin=true면 상단에 관리자 툴바(대시보드 복귀 링크 + `draft/published` 배지 + `controls` 슬롯) 렌더 |
| 수정 | `frontend/app/points/[id]/page.tsx` | 렌더를 `<PointView point=… siblings=… />`(admin 미지정=공개)로 대체. 동작 불변 |
| 신규 | `frontend/components/ProjectView.tsx` | 프로젝트 인덱스 표현 추출(순수). props: `{ project: ProjectIndex; admin?; controls? }` |
| 수정 | `frontend/app/projects/[slug]/page.tsx` | `<ProjectView project=… />`로 대체. 동작 불변 |
| 신규 | `frontend/app/admin/points/[id]/page.tsx` | **클라이언트** 페이지 — sessionStorage 토큰으로 `adminGetPoint(id)`(+ 같은 프로젝트 목록은 `/api/points/admin?project=` 또는 클라 필터) → `<PointView admin controls={…} />`. 토큰 없으면 `/admin`으로 |
| 신규 | `frontend/app/admin/projects/[slug]/page.tsx` | **클라이언트** 페이지 — `adminGetProject(slug)`(be/0007) → `<ProjectView admin controls={…} />`. 토큰 없으면 `/admin` |
| 수정 | `frontend/lib/adminClient.ts` | `adminGetProject(token, slug)` 추가(be/0007 `/api/projects/admin/{slug}` 소비). (포인트는 기존 `adminGetPoint`) |
| 수정 | `frontend/app/admin/page.tsx` | 포인트 카드: 접기/펼치기 제거 → `<Link href={"/admin/points/"+id}>`. 미리보기(PointPreview) 관련 상태·핸들러 제거. 세션·질문 로그 섹션은 유지 |

## 5. 인터페이스·시그니처 (구체)
- `PointView`·`ProjectView`: 서버·클라 양용 순수 컴포넌트. `admin` 기본 false. `admin=true`일 때만 관리자 툴바+`controls` 노출(공개 렌더에는 절대 안 나옴).
- 관리자 페이지는 `"use client"`, `NEXT_PUBLIC_API_BASE` 경유 Bearer 조회(기존 adminClient 관례). 미인증(토큰 없음·403/404) → `/admin`으로 이동(next `useRouter().replace`).
- 대시보드 포인트 항목 = `<Link>`(딥링크). 새 페이지에서 "← 대시보드"로 복귀.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 토큰 없음(직접 `/admin/points/x` 진입) | `/admin`(게이트)로 리다이렉트 | 관리자 페이지 |
| 토큰 불일치/만료(403/404) | `/admin`로 리다이렉트(재입력 유도) | 관리자 페이지 |
| 없는 id/slug(관리자) | "없음" 안내 or `/admin` 복귀(공개의 302와 달리 존재부재 노출 무방) | 관리자 페이지 |
| 공개 페이지 회귀 | 리팩터 후에도 공개 point/project 페이지 렌더·draft 302 동작 **불변** | 공개 페이지 |
| admin 플래그 누출 | 공개 경로에서 admin 컨트롤이 절대 렌더되지 않아야(기본 false) | View |

## 7. 수용 기준 — 결과문
- [ ] 대시보드에서 포인트를 클릭하면 접기 대신 `/admin/points/<id>` 페이지로 이동해 공개와 **같은 표현**으로 (draft 포함) 렌더된다.
- [ ] 그 페이지 상단에 관리자 툴바(대시보드 복귀·상태 배지)가 보이고, 공개 `/points/<id>`에는 안 보인다.
- [ ] 공개 포인트/프로젝트 페이지는 리팩터 후에도 동작·모양 불변, draft는 여전히 302.
- [ ] 토큰 없이 `/admin/points/<id>` 진입 시 `/admin`으로 보내진다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- **편집·쓰기 UI 금지**(그건 fe/0005 — 여기선 `controls` 슬롯만 비워 둠). BE 수정 금지(조회만 소비). 공개 페이지의 표현/동작 변경 금지(순수 추출만). 챗봇 FAB·랜딩 등 무관 화면 변경 금지. 새 의존 금지.

## 9. 검증 방법
- 토큰 세팅 후 대시보드→포인트 링크→관리자 페이지(draft 렌더+툴바) 확인. 공개 페이지 회귀(모양·302) 확인. 무토큰 리다이렉트 확인.

## 10. 참조
- 플로우.md · 기존 point/project 페이지 · 선행 be/0007 + be/point 관리자 조회 · 후속 fe/0005
