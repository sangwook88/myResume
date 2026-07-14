---
id: 0008
title: fe/browse 관리자 프로젝트 표지 편집기 — index.md 원문 편집
branch: feat/fe-browse-project-edit
base: main
domain: fe/browse
stage: V
pattern:
status: ready
engine: codex
created: 2026-07-14
---

# [0008] fe/browse 관리자 프로젝트 표지 편집기

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
관리자 프로젝트 페이지(`/admin/projects/[slug]`)는 현재 **조회 + 아키텍처 SVG 업로드(DiagramUploader)만** 가능하다 — 표지 텍스트(요약·역할·기간·팀·기술스택·architecture·highlights)를 고칠 수 없다. be/0012가 추가한 **프로젝트 표지 편집 API**(raw 프리필 + 전체 index.md PUT)를 소비해, 포인트 편집(fe/0005·0006)과 동형의 **표지 원문 편집기**를 붙인다. 저장은 be/0012 계약대로 **전체 index.md 마크다운을 무손실 저장**.

- 전제: **be/0012**(`GET /api/projects/admin/{slug}/raw` + `PUT /api/projects/admin/{slug}`) · 기존 `adminGetProject`(관리자 조회)·`DiagramUploader`(도식 업로드, 무변) · fe/0004·0005(관리자 뷰·편집 진입·인증 게이트).
- 근거: `frontend/app/admin/projects/[slug]/page.tsx`(현 조회+도식) · `frontend/components/ProjectView.tsx`(표지 렌더 + `admin`·`controls` props) · `frontend/app/admin/points/[id]/page.tsx`+`PointEditor.tsx`(편집 토글·원문 편집기 선례) · `frontend/lib/adminClient.ts`(`adminGetPointRaw`·`adminSavePoint`·`adminGetProject` 관례).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `fe/browse` (관리자 프로젝트 편집 표현·상호작용) |
| 단계 | V |
| 가로지르는 도메인 | `be/project`(편집 PUT/raw GET = be/0012) — HTTP, Bearer |
| 분류 근거 | 편집 UX·프리필·저장 흐름은 FE. index.md 파일 저장은 BE(be/0012) |

## 2b. 웨이브
- Wave 2(FE). 선행 be/0012.

## 3. 구조 결정
- **편집기 = 원문 마크다운 textarea(무손실).** be/0012가 전체 index.md를 받으므로, FE는 raw 원문을 로드(프리필)해 textarea로 편집하고 저장한다 — 포인트 편집기 초기형(단일 textarea)과 동형. 표지 frontmatter·architecture 본문·서식이 그대로 라운드트립. (구조화 필드 폼은 architecture 산문 유실 위험 + 범위 밖.)
- **진입 = 편집 토글.** `admin/projects/[slug]/page.tsx`에 `editing` 상태를 두고(포인트 admin 페이지와 동형), 조회(`ProjectView` + DiagramUploader) ↔ 편집(`ProjectEditor`)을 전환한다. 저장 성공 시 반환된 `ProjectIndex`로 뷰 갱신 + 편집 종료.
- **미리보기(선택):** textarea 옆/아래에 조립본을 `<Markdown>`으로 렌더(포인트 편집기 관례). 필수는 아님 — 최소 구현은 textarea + 저장.
- **auth/에러 처리:** 로딩·저장·403/404는 기존 admin 관례 계승(403/404면 `/admin`으로 replace 유도, 그 외 메시지 표시, 편집 내용 유지).

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `frontend/lib/adminClient.ts` | `adminGetProjectRaw(token, slug) -> AdminResult<{content:string}>`(GET `/api/projects/admin/{slug}/raw`) · `adminSaveProject(token, slug, content) -> AdminResult<ProjectIndex>`(PUT `/api/projects/admin/{slug}`, JSON `{content}`). `adminGetPointRaw`·`adminSavePoint` 구현을 그대로 미러 |
| 신규 | `frontend/components/ProjectEditor.tsx` | 원문 편집기: 마운트 시 `adminGetProjectRaw`로 프리필 → textarea 편집 → 저장 `adminSaveProject` → `onSaved(ProjectIndex)`. `onCancel` 콜백. 로딩·저장·403/404(→`/admin`) 처리. `PointEditor`의 로딩/저장/에러 구조를 계승하되 **단일 raw textarea**(섹션 분해 없음) |
| 수정 | `frontend/app/admin/projects/[slug]/page.tsx` | `editing` 상태 추가 → 미편집: `ProjectView`의 `controls`에 "편집" 버튼(+ 기존 DiagramUploader 유지) / 편집: `ProjectEditor` 렌더. 저장 성공 시 `setProject(갱신)` + `setEditing(false)`. 토큰 게이트·조회는 기존 그대로 |

## 5. 인터페이스·시그니처 (구체)
- `adminGetProjectRaw(token, slug) -> AdminResult<{content:string}>` — 404/403은 `AdminResult` 에러.
- `adminSaveProject(token, slug, content) -> AdminResult<ProjectIndex>` — 400(파싱·slug 불일치·빈값)·404·403은 에러 메시지, 편집 유지.
- `ProjectEditor` props: `{ token: string; slug: string; onSaved: (p: ProjectIndex) => void; onCancel: () => void }`.
- 편집 진입 버튼은 `ProjectView`의 `controls` 슬롯을 통해 노출(기존 DiagramUploader와 공존 — controls에 편집 버튼 + DiagramUploader 둘 다).

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| raw 로드 실패(403/404) | `/admin`으로 유도, 편집기 안 뜸 | ProjectEditor/page |
| 저장 실패(400: slug 불일치·파싱·빈값) | 사유 표시, 편집 내용 유지, 파일 안 바뀜(BE 검증) | ProjectEditor |
| 저장 실패(403/404 auth) | `/admin` 유도, 편집 유지 | ProjectEditor |
| 저장 중 중복 클릭 | 저장 버튼 disable | ProjectEditor |
| 저장 성공 | 반환 ProjectIndex로 뷰 갱신 + 편집 종료 | page |
| 도식 업로드와 공존 | 편집 토글과 DiagramUploader가 서로 간섭 없이 동작(둘 다 controls) | page |
| 공개 페이지에 편집 UI 노출 | 절대 없음 — 편집은 `/admin/projects/[slug]` 토큰 게이트에서만 | page |
| architecture 긴 본문 편집 | textarea 라운드트립 무손실(BE 재파싱 안전망) | ProjectEditor |

## 7. 수용 기준 — 결과문
- [ ] 관리자 프로젝트 페이지에서 "편집" → 표지 index.md 원문이 textarea로 뜨고, 요약·역할·기술스택·architecture 등을 고쳐 저장하면 파일과 뷰에 반영된다.
- [ ] 저장 실패(400: slug 불일치·파싱 / 403·404 auth)가 안전 처리되고 편집 내용이 유지된다.
- [ ] 기존 아키텍처 SVG 업로드(DiagramUploader)가 그대로 동작한다.
- [ ] 공개 프로젝트 페이지엔 편집 UI가 절대 안 보인다(admin 게이트).
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- BE 수정 금지(be/0012 소비만). 프로젝트 신규 생성·삭제·slug 이동 UI 금지. 구조화 필드 폼·WYSIWYG 등 새 무거운 의존 금지(단일 raw textarea + 기존 `Markdown` 미리보기로 충분). 포인트 편집기(fe/0006)·프로필(fe/0007)·랜딩·챗봇 등 무관 화면 변경 금지. `lib/types.ts` 계약 변경 금지(ProjectIndex 무변). DiagramUploader 로직 변경 금지(공존만).

## 9. 검증 방법
- be/0012 기동 + 토큰 세팅 → `/admin/projects/{slug}` 편집: 원문 프리필·표지 텍스트 수정 저장·뷰 반영·라운드트립(무편집 저장 후 architecture 본문 보존)·400(slug 불일치) 사유표시·auth 실패. 도식 업로드 공존 확인. 공개 페이지 편집 UI 미노출 확인.

## 10. 참조
- 선행 be/0012 · `app/admin/projects/[slug]/page.tsx`·`ProjectView.tsx`·`DiagramUploader.tsx` · `app/admin/points/[id]/page.tsx`+`PointEditor.tsx`(편집 토글·원문 편집기 선례) · `lib/adminClient.ts`(`adminGetPointRaw`·`adminSavePoint` 미러)
