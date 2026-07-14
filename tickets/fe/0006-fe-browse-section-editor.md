---
id: 0006
title: fe/browse 관리자 단락(섹션)별 편집기 + 단락별 사진 첨부
branch: feat/fe-browse-section-editor
base: main
domain: fe/browse
stage: V
pattern:
status: ready
engine: codex
created: 2026-07-14
---

# [0006] fe/browse 관리자 단락(섹션)별 편집기 + 단락별 사진 첨부

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
현재 관리자 편집기(`PointEditor.tsx`)는 **파일 전체를 하나의 textarea**로 편집한다. 이를 **단락(H2 섹션)별 편집기**로 바꾼다 — 각 섹션을 개별 textarea로 나눠 편집하고, **섹션마다 사진을 첨부**할 수 있게 한다(be/0010 이미지 업로드 → 그 섹션 본문에 `![](url)` 삽입). 저장은 **기존 계약 그대로**(전체 마크다운을 무손실 조립해 `PUT /api/points/admin/{id}`) — be/0008의 "무손실 전체 마크다운" 결정과 숨은 `## 챗봇전용 [[E##]]` invidence·표를 유실 없이 보존한다.

- 전제: **be/0010**(이미지 업로드 `POST /admin/{id}/images` + 공개 서빙 `GET /assets/{project}/{filename}`) · **be/0008**(편집 `PUT /admin/{id}` + 프리필 `GET /admin/{id}/raw`, 무변) · **fe/0004·0005**(관리자 뷰·편집 진입).
- 근거: `frontend/components/PointEditor.tsx`(현 전체편집기) · `PointView.tsx`(섹션 렌더) · `Markdown.tsx`(렌더러) · `lib/adminClient.ts` · `ArchitectureDiagram.tsx`(`${API_BASE}${src}` 이미지 로드 관례).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `fe/browse` (관리자 편집 표현·상호작용 + 공개 렌더) |
| 단계 | V |
| 가로지르는 도메인 | `be/point`(편집 PUT/raw GET = 무변, 이미지 POST = be/0010) — HTTP, Bearer |
| 분류 근거 | 섹션 분해·재조립·업로드 UX·이미지 렌더는 FE. 파일·이미지 저장은 BE(be/0008·0010) |

## 2b. 웨이브
- Wave 2(FE). 선행 be/0010. be/0008·0004·0005는 이미 done.

## 3. 구조 결정
- **단락 = H2 섹션.** 편집기는 원문 마크다운을 로드해 **frontmatter 블록 + H2 섹션 블록들**로 분해한다. 각 블록은 (헤딩 라인 + 본문)이고, 본문 textarea만 편집한다 — **헤딩 라인·블록 순서는 절대 건드리지 않는다**(무손실 라운드트립의 핵심). 재조립 = frontmatter + 원래 순서대로 블록 join → 전체 마크다운. BE 재파싱·발행게이트가 안전망.
- **섹션 분류(시각 그룹핑용, 재조립 순서와 무관)** — backend `_canonical_heading` 로직 미러:
  - **핵심**: 문제 · 고려한 옵션(표) · 결정과 근거 · 결과
  - **심화(페이지 접힘·챗봇용, 그래도 편집 가능)**: 배경 · 실행 · 회고
  - **요약**: 제목·요약(summary)
  - **기타(원문 보존)**: `## 챗봇전용 [[E##]]` 등 인식 못 한 헤딩 블록 — 유실 방지로 편집 가능한 textarea로 노출하되 별도 그룹.
  - frontmatter: 상단 "메타데이터" 블록(verbatim textarea; id/project 변경은 BE가 400으로 거부 — 안내만).
- **사진 첨부 = 산문 섹션 단위 버튼.** 문제·결정과근거·결과·배경·실행·회고·요약 각 textarea에 "사진 첨부" 버튼 → 파일 선택 → be/0010 업로드 → 반환 `markdown`(`![](url)`)을 그 textarea 끝에 삽입. 표 섹션(고려한옵션·Evidence)엔 이미지 버튼 없음(범위 밖).
- **이미지 렌더:** be/0010이 준 url은 `/api/points/assets/...` 상대경로 → `Markdown.tsx`에 커스텀 `img` 렌더러를 더해 `/api/`로 시작하는 src에 `NEXT_PUBLIC_API_BASE`를 프리픽스(교차출처·공개페이지 모두 로드). `ArchitectureDiagram`의 `${API_BASE}${src}` 관례와 동일.
- **공개 페이지에 사진 노출:** 현 `PointView`는 산문 섹션을 `<p>{s.xxx}</p>` 평문으로 렌더 → `![](url)`이 리터럴 텍스트로 보인다. 핵심 산문 섹션(문제·결정과근거·결과)을 **`<Markdown>`으로 렌더**해 첨부 이미지(및 기본 마크다운)가 실제로 보이게 한다. 배경·실행·회고는 페이지에서 여전히 접힘(챗봇 전용) — 무변.

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `frontend/lib/adminClient.ts` | `adminUploadPointImage(token, id, file: File) -> AdminResult<{url:string; markdown:string; filename:string}>`(POST `/api/points/admin/{id}/images`, multipart `file`). 기존 `adminGetPointRaw`·`adminSavePoint`는 무변 재사용 |
| 신규 | `frontend/lib/pointMarkdown.ts` | 순수 함수: `splitFrontmatter(raw) -> {frontmatter, body}` · `splitSections(body) -> Block[]`(각 `{heading, headingKind, body}`, 원래 순서) · `classify(heading) -> kind`(요약/문제/옵션/결정/실행/결과/회고/evidence/기타) · `assemble(frontmatter, blocks) -> string`(무손실 재조립). backend `_canonical_heading` 규칙 미러 |
| 수정(재작성) | `frontend/components/PointEditor.tsx` | 전체 textarea → **섹션별 편집기**: raw 로드 → 분해 → 그룹(요약·핵심·심화·기타 + frontmatter 메타) 렌더, 각 산문 섹션에 textarea + "사진 첨부" 버튼(업로드 중 disable·에러) → 저장 시 `assemble`로 전체 마크다운 만들어 `adminSavePoint`. 로딩·저장·403/404 auth 처리(기존 그대로) + 미리보기(`<Markdown>` 조립본) 유지 |
| 수정 | `frontend/components/Markdown.tsx` | 커스텀 `img` 렌더러 추가 — `src`가 `/api/`로 시작하면 `NEXT_PUBLIC_API_BASE` 프리픽스, 아니면 그대로. 기존 `a`(새 탭) 유지 |
| 수정 | `frontend/components/PointView.tsx` | 핵심 산문 섹션(문제·결정과근거·결과) 렌더를 `<p>{s.xxx}</p>` → `<Markdown>{s.xxx}</Markdown>`로 교체(첨부 이미지·기본 md 표시). 요약(`point-lede`)은 한 줄 유지(선택). 배경·실행·회고 접힘·레일·AskSectionButton 등 나머지 무변 |

## 5. 인터페이스·시그니처 (구체)
- `adminUploadPointImage(token, id, file) -> AdminResult<{url, markdown, filename}>` — 실패(400/403/404)는 그 섹션 옆에 메시지, textarea 유지.
- `splitFrontmatter`: 선두 `---\n...\n---\n?` 매칭(정규식) → frontmatter(두 `---` 포함)와 body 분리. frontmatter 없으면 저장은 BE가 400 처리(편집기는 그대로 시도).
- `splitSections(body)`: 라인 순회, `/^#{1,6}\s/` 매칭 시 새 블록 시작(헤딩 라인 보존). 첫 헤딩 이전 프리앰블(있으면) 헤딩 없는 리딩 블록으로 보존. 각 블록 = `{heading:string(헤딩 원문 라인 or ""), body:string, kind}`.
- `assemble(frontmatter, blocks)`: `frontmatter` + `"\n"` + 블록들을 **원래 순서**로 (`heading` + `"\n" + body`) 이어붙임, 블록 간 단일 빈 줄. 편집 안 한 블록은 원문 그대로. → 전체 마크다운.
- `classify`: 부분일치 — "요약"→summary, "배경"→background, "문제"→problem, "고려"|"옵션"→options, "결정"→decision, "실행"→execution, "결과"→result, "회고"→retrospective, 소문자에 "evidence"→evidence, 그 외(챗봇전용 [[E##]] 포함)→기타. (backend `_canonical_heading`와 동일 우선순위: evidence·결정·요약을 앞에 둬 '근거'/'요약' 오매칭 방지.)
- 이미지 삽입: 업로드 성공 시 해당 블록 `body`에 `"\n\n" + markdown + "\n"` append(상태 갱신).

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 숨은 `## 챗봇전용 [[E##]]`·미인식 헤딩 | '기타(원문 보존)' 그룹에 편집 가능 textarea로 노출, 재조립서 순서·헤딩 보존(유실 없음) | pointMarkdown/editor |
| 표 섹션(고려한옵션·Evidence) 편집 | raw 마크다운 textarea로 편집(이미지 버튼 없음) | editor |
| frontmatter id/project 변경 저장 | BE 400 사유 그대로 표시, 편집 유지 | editor(BE 검증) |
| published인데 게이트 미충족 저장 | BE 400 표시, 편집 유지, 파일 안 바뀜 | editor(BE 검증) |
| 이미지 업로드 실패(400 타입·과대 / 403·404 auth) | 그 섹션에 에러, auth면 `/admin` 유도, textarea 유지 | editor |
| 업로드 중 중복 클릭 | 업로드 중 버튼 disable | editor |
| 첫 헤딩 없는 본문/빈 섹션 | 리딩 블록·빈 body 허용, 재조립 안전 | pointMarkdown |
| 라운드트립(편집 안 하고 저장) | 원문과 의미 동일(파싱·게이트 통과) — 헤딩·순서·표·숨은섹션 보존 | pointMarkdown |
| 이미지 src가 절대 URL(외부) | 프리픽스 안 함(그대로) | Markdown |
| 공개 페이지 draft 미노출·admin 게이트 | 편집·업로드 UI는 admin 경로에서만(기존 fe/0004·0005 게이트 그대로) | page |

## 7. 수용 기준 — 결과문
- [ ] 관리자 포인트 "편집" → 섹션별(요약·핵심4·심화3·기타·메타) textarea로 나뉘어 뜨고, 한 섹션만 고쳐 저장하면 파일이 반영된다.
- [ ] 편집 안 한 섹션·표·숨은 `## 챗봇전용 [[E##]]`가 저장 후에도 유실 없이 보존된다(라운드트립 무손실).
- [ ] 산문 섹션의 "사진 첨부"로 이미지를 올리면 그 섹션 본문에 `![](url)`가 삽입되고, 저장·공개 페이지에서 이미지가 렌더된다.
- [ ] 저장 실패(BE 400: id/project 불일치·게이트)면 사유가 표시되고 편집 내용이 유지된다.
- [ ] 업로드 실패(타입·과대·auth)가 안전 실패하고 재시도로 유도된다.
- [ ] 공개 페이지에 편집·업로드 UI가 절대 안 보인다(admin 게이트).
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- BE 수정 금지(be/0008 무변 소비·be/0010 이미지 소비만). 포인트 신규 생성·삭제·id 이동 UI 금지. **섹션 재정렬·섹션 추가/삭제 UI 금지**(단락별 편집·사진만; 헤딩·순서는 원문 보존). 이미지 삭제·리사이즈 UI 금지. WYSIWYG/리치에디터 등 새 무거운 의존 금지(textarea + 기존 `Markdown` 미리보기로 충분). 챗봇·랜딩·프로젝트 도식(fe/0005 DiagramUploader) 등 무관 화면 변경 금지. `lib/types.ts` 계약 변경 금지(섹션 DTO 무변).

## 9. 검증 방법
- 토큰 세팅 → 편집: 섹션 분해·한 섹션 수정 저장·파일 반영·라운드트립(무편집 저장 후 표·숨은섹션 보존)·400 사유표시. 사진: 유효/무효 업로드·`![]()` 삽입·공개 페이지 이미지 렌더·auth 실패. 공개 페이지 편집 UI 미노출 확인.

## 10. 참조
- 선행 be/0010(이미지)·be/0008(편집·raw 무변) · `PointEditor.tsx`·`PointView.tsx`·`Markdown.tsx`·`lib/adminClient.ts`·`ArchitectureDiagram.tsx`(API_BASE 관례) · backend `repository._canonical_heading`(분류 규칙 원본)
