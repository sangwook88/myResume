---
id: 0007
title: fe/browse 랜딩 프로필 헤더(사진·이름·연락처·자기소개) + 관리자 프로필 편집
branch: feat/fe-browse-profile
base: main
domain: fe/browse
stage: V
pattern:
status: ready
engine: codex
created: 2026-07-14
---

# [0007] fe/browse 랜딩 프로필 헤더 + 관리자 프로필 편집

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
랜딩(`/`) 최상단의 태그라인 히어로("문제보다 판단이 보이는 포트폴리오" + 서브 + 통계)를 **제거**하고, 그 자리에 **본인 소개 헤더**(사진·이름·GitHub·전화·이메일·짧은 자기소개)를 넣는다. 채용자가 랜딩에서 "이 사람이 누구인지"를 한눈에 잡게 하는 게 목적. 헤더 **아래에 기존 추천 구현 사례·프로젝트 목록**이 그대로 뜬다. 프로필은 **관리자 화면에서 편집 가능**(사진 업로드 + 필드 편집).

- 전제: **be/0011**(`GET /api/profile` 공개 조회 · `PUT /api/profile/admin` 편집 · `POST /api/profile/admin/image` 사진 업로드 · `GET /api/profile/assets/{filename}` 공개 서빙). 관리자 인증·토큰 게이트는 기존 fe/0004·0005 방식(`ADMIN_TOKEN_KEY` + Bearer).
- 근거: `frontend/components/LandingExplorer.tsx`(현 히어로 `.landing-hero`·`.landing-proof` 블록) · `frontend/app/page.tsx`(서버 컴포넌트 병렬 fetch) · `frontend/lib/api.ts`·`lib/types.ts`·`lib/adminClient.ts` · `frontend/components/ArchitectureDiagram.tsx`(`${API_BASE}${src}` 이미지 로드 관례) · `frontend/components/Markdown.tsx`(자기소개 렌더) · `frontend/app/admin/points/[id]/page.tsx`+`PointEditor.tsx`(관리자 편집 페이지·에디터 패턴) · `frontend/app/admin/page.tsx`(대시보드 진입 링크).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `fe/browse` (랜딩 표현 + 관리자 프로필 편집 상호작용) |
| 단계 | V |
| 가로지르는 도메인 | `be/project`(프로필 조회 GET = 공개 · 편집 PUT · 사진 POST = be/0011) — HTTP, Bearer |
| 분류 근거 | 프로필 렌더·편집 UX는 FE. 프로필 저장·사진 저장은 BE(be/0011) |

## 2b. 웨이브
- Wave 2(FE). 선행 be/0011.

## 3. 구조 결정
- **프로필 데이터 흐름:** `app/page.tsx`(서버 컴포넌트)가 기존 병렬 fetch에 `getProfile()`를 추가해 `LandingExplorer`에 `profile` prop으로 내린다(SSG/ISR, 나머지 fetch와 동일 규약).
- **히어로 제거·대체:** `LandingExplorer`의 `<section className="landing-hero">…</section>` 블록(kicker "Evidence-backed engineering" + `<h1>문제보다 판단이…</h1>` + `.sub` + `.landing-proof`)을 **통째로 `<ProfileHeader profile={profile} .../>`로 교체**한다. 통계(Projects·Case studies·Proof)는 프로필 헤더 안에 **작은 스탯 스트립**으로 유지(props로 `projects.length`·`recommended.length` 전달) — 채용자 신호 보존. 추천·프로젝트 목록 섹션·우측 레일은 무변.
- **ProfileHeader(표현 전용, 무상태):** 사진(원형/썸네일) + 이름 + headline(있으면) + 연락처 링크(GitHub↗·전화 `tel:`·이메일 `mailto:`) + 자기소개(`<Markdown>`로 렌더 — 짧은 마크다운). 값이 빈 필드는 렌더 생략(사진 없으면 이니셜/플레이스홀더, 링크 없으면 그 칩 생략). **사진 src는 `/api/`로 시작하면 `NEXT_PUBLIC_API_BASE`를 프리픽스**(`ArchitectureDiagram`의 `${API_BASE}${src}` 관례 동일 — 교차출처·공개 페이지 모두 로드), 절대 URL이면 그대로.
- **관리자 편집:** 새 페이지 `app/admin/profile/page.tsx`(토큰 게이트 → `ProfileEditor`). 프로필은 고정 스키마의 작은 폼이라 **필드 기반 에디터**(raw 마크다운 아님): 이름·headline·GitHub·전화·이메일 = `<input>`, 자기소개 = `<textarea>`, 사진 = 업로드 버튼(be/0011 이미지 POST → 반환 `url`을 photo 필드에 세팅 + 미리보기). 저장 = `adminSaveProfile`(구조화 `ProfileEdit` PUT). 로딩·저장·403/404 auth 처리는 기존 admin 페이지 관례 계승.
- **대시보드 진입:** `app/admin/page.tsx` 인증 화면에 "프로필 편집"(`/admin/profile`) 링크 1개 추가(포인트 목록 근처 섹션 라벨).

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `frontend/lib/types.ts` | `Profile` 인터페이스 추가 — `name,headline,photo(string|null),github,phone,email,intro`(be/0011 DTO 미러, camelCase) |
| 수정 | `frontend/lib/api.ts` | `getProfile(): Promise<Profile>` — `GET /api/profile`. 프로필은 항상 200이지만 BE 미기동 시 null 대비해 빈 기본값 폴백 반환 |
| 수정 | `frontend/lib/adminClient.ts` | `adminSaveProfile(token, edit: ProfileEdit) -> AdminResult<Profile>`(PUT `/api/profile/admin`, JSON) · `adminUploadProfileImage(token, file: File) -> AdminResult<{url:string; filename:string}>`(POST `/api/profile/admin/image`, multipart `file`) · 편집 프리필용 현재값은 공개 `GET /api/profile`를 부르는 `fetchProfileClient() -> Profile`(토큰 불필요) 또는 기존 base로 직접 fetch. `ProfileEdit` 타입(=Profile 필드) export |
| 신규 | `frontend/components/ProfileHeader.tsx` | 표현 전용 무상태 컴포넌트. props `{ profile: Profile; projectCount: number; caseCount: number }`. 사진(API_BASE 프리픽스)·이름·headline·연락처 칩(github/tel/mailto, 빈 값 생략)·자기소개(`<Markdown>`)·스탯 스트립 렌더 |
| 수정 | `frontend/components/LandingExplorer.tsx` | `landing-hero` 블록 제거 → `<ProfileHeader profile={profile} projectCount={projects.length} caseCount={recommended.length} />`. `props`에 `profile: Profile` 추가. 나머지(필터·추천·프로젝트·레일) 무변 |
| 수정 | `frontend/app/page.tsx` | `getProfile()`를 기존 `Promise.all`에 추가해 `LandingExplorer`에 `profile` 전달 |
| 신규 | `frontend/components/ProfileEditor.tsx` | 필드 기반 편집기: 마운트 시 `fetchProfileClient()`로 프리필 → 필드/텍스트에어리어 + 사진 업로드 버튼(업로드 중 disable·에러) → 저장 `adminSaveProfile`. `onSaved`·`onCancel` 콜백. 403/404는 `/admin` 유도 |
| 신규 | `frontend/app/admin/profile/page.tsx` | 토큰 게이트(`ADMIN_TOKEN_KEY` sessionStorage, 없으면 `/admin` replace) → 상단바 + `ProfileEditor`. `admin/points/[id]/page.tsx` 패턴 계승 |
| 수정 | `frontend/app/admin/page.tsx` | 대시보드에 "프로필 편집"(`/admin/profile`) 링크 1개 추가 |
| 수정 | `frontend/app/portfolio.css` (또는 `globals.css`) | `.profile-header`·사진·연락처 칩·스탯 스트립 스타일. 기존 디자인 토큰·`.landing-*` 룩앤필과 정합(라이트/다크). 제거된 `.landing-hero` 관련 스타일이 다른 곳에서 안 쓰이면 정리 |

## 5. 인터페이스·시그니처 (구체)
- `getProfile(): Promise<Profile>` — `getJson<Profile>('/api/profile')` 결과, null이면 빈 기본값(`{name:'',headline:'',photo:null,github:'',phone:'',email:'',intro:''}`).
- `adminSaveProfile(token, edit)` — 실패(403/404) `AdminResult` 에러(에디터가 메시지·auth 유도).
- `adminUploadProfileImage(token, file)` — 성공 시 `{url, filename}`; photo 필드에 `url` 세팅 + 미리보기. 실패(400 타입·과대 / 403·404)는 에디터에 메시지, 기존 사진 유지.
- `ProfileHeader`: 사진 src = `photo?.startsWith('/api/') ? \`${NEXT_PUBLIC_API_BASE}${photo}\` : photo`. 연락처 칩: github=`<a href={github} target=_blank rel=noreferrer>`, phone=`<a href={\`tel:${phone}\`}>`, email=`<a href={\`mailto:${email}\`}>`. 각 값이 빈 문자열이면 그 칩 미렌더. 자기소개 빈 값이면 그 영역 생략.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 프로필 아직 비어있음(be 파일 없음) | 사진 플레이스홀더·이름 빈칸·링크 없음 — 헤더는 깨지지 않고 추천 목록은 정상 | ProfileHeader/page |
| 사진 미설정 | 이니셜/플레이스홀더 원, 레이아웃 유지 | ProfileHeader |
| 일부 연락처만 있음 | 있는 칩만 렌더 | ProfileHeader |
| 사진 src가 절대 URL(외부) | 프리픽스 안 함(그대로) | ProfileHeader |
| BE 미기동(landing fetch 실패) | `getProfile` 빈 기본값 폴백 → 랜딩 렌더(추천은 기존대로 []) | api |
| 사진 업로드 실패(타입·과대·auth) | 에디터에 에러, 기존 photo 유지, auth면 `/admin` 유도 | ProfileEditor |
| 업로드 중 중복 클릭 | 버튼 disable | ProfileEditor |
| 저장 실패(403/404) | 사유 표시 + auth면 `/admin` 유도, 편집 유지 | ProfileEditor |
| 공개 랜딩에 편집 UI 노출 | 절대 안 됨 — 편집은 `/admin/profile` 토큰 게이트에서만 | page |
| 자기소개 마크다운/링크 | `<Markdown>` 렌더(기존 새 탭 링크 관례) | ProfileHeader |

## 7. 수용 기준 — 결과문
- [ ] 랜딩 최상단에서 "문제보다 판단이…" 태그라인 히어로가 사라지고, 사진·이름·GitHub·전화·이메일·자기소개 헤더가 뜬다.
- [ ] 헤더 아래에 기존 추천 구현 사례·프로젝트 목록·우측 레일이 그대로 보인다.
- [ ] `/admin/profile`에서 필드를 고치고 사진을 올려 저장하면 랜딩 헤더에 반영된다(사진·이름·연락처·자기소개).
- [ ] 프로필이 비어도 랜딩이 깨지지 않고, 있는 값만 렌더된다(빈 연락처·사진 생략).
- [ ] 사진/저장 실패(타입·과대·auth)가 안전 실패하고 재시도/`/admin` 유도된다.
- [ ] 공개 랜딩에 편집·업로드 UI가 절대 안 보인다(admin 게이트).
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- BE 수정 금지(be/0011 소비만). 프로필 **복수·다중 사진·이미지 삭제/리사이즈** UI 금지. 추천·프로젝트 목록 로직·우측 레일·챗봇·프로젝트 도식(fe/0005)·포인트 편집(fe/0006) 등 무관 화면 변경 금지. 태그라인 히어로 제거 외에 랜딩 정보구조(추천→프로젝트 순서) 재편 금지. WYSIWYG/리치에디터 등 새 무거운 의존 금지(input+textarea+기존 `Markdown`로 충분). `lib/types.ts`의 기존 계약(Point·ProjectIndex 등) 변경 금지(Profile 신규 추가만).

## 9. 검증 방법
- be/0011 기동 + 토큰 세팅 → `/admin/profile`에서 이름·연락처·자기소개 입력 + 사진 업로드·저장 → 랜딩 새로고침에 헤더 반영. 빈 프로필 상태 랜딩 렌더. 사진 무효/과대·저장 auth 실패 안전처리. 공개 랜딩에 편집 UI 미노출. 다크/라이트 헤더 룩 확인.

## 10. 참조
- 선행 be/0011(프로필 조회·편집·사진) · `LandingExplorer.tsx`(히어로 블록)·`app/page.tsx`(fetch)·`ArchitectureDiagram.tsx`(API_BASE 관례)·`Markdown.tsx`·`lib/api.ts`·`lib/adminClient.ts`·`app/admin/points/[id]/page.tsx`+`PointEditor.tsx`(에디터 패턴)·`app/admin/page.tsx`(진입 링크)
