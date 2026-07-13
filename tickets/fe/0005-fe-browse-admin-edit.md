---
id: 0005
title: fe/browse 관리자 편집 UI — 포인트 마크다운 편집·저장 + 도식 업로드
branch: feat/fe-browse-admin-edit
base: main
domain: fe/browse
stage: V
pattern:
status: ready
engine: codex
created: 2026-07-13
---

# [0005] fe/browse 관리자 편집 UI — 마크다운 편집·저장 + 도식 업로드

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
관리자 뷰(fe/0004)에 **① 포인트 문서(마크다운) 편집·저장 UI**와 **② 프로젝트 아키텍처 도식(SVG) 업로드 UI**를 얹는다. 편집은 원문 마크다운을 그대로 다룬다(be/0008이 무손실 전체 마크다운 저장). 도식은 SVG 파일 업로드(be/0009).
- 전제: **be/0008**(포인트 편집 `PUT /admin/{id}` + 프리필 `GET /admin/{id}/raw`) · **be/0009**(도식 업로드 `PUT /admin/{slug}/diagram`) · **fe/0004**(관리자 뷰 + `controls` 슬롯).
- 근거: 기존 대시보드/관리자 페이지(fe/0004) · `frontend/lib/adminClient.ts`.

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `fe/browse` (관리자 편집 표현·상호작용) |
| 단계 | V |
| 가로지르는 도메인 | `be/point`(편집 PUT/raw GET)·`be/project`(도식 PUT) — HTTP, Bearer |
| 분류 근거 | 편집 폼·미리보기·업로드 UX는 FE. 파일 저장·검증은 BE(be/0008·0009) |

## 2b. 웨이브
- Wave 3(FE). 선행 be/0008·be/0009·fe/0004.

## 3. 구조 결정
- FE=V. **편집기 = 원문 마크다운 textarea**(구조화 폼 아님 — be/0008이 전체 마크다운 저장이라 일치). 라이브 미리보기는 fe/0004에서 만든 `Markdown`(`components/Markdown.tsx`)·`PointView` 재사용(선택: 좌 편집/우 미리보기).
- 편집 진입은 fe/0004 관리자 페이지의 `controls` 슬롯에 "편집" 버튼 → 인라인 편집 모드 토글(별도 라우트 불필요). 저장 성공 시 뷰 갱신.
- 도식 업로드는 관리자 프로젝트 페이지 `controls`에 파일 선택(accept=`.svg,image/svg+xml`) → 업로드 → `architectureDiagram` 갱신 반영.

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `frontend/lib/adminClient.ts` | `adminGetPointRaw(token,id)`(GET `/admin/{id}/raw`) · `adminSavePoint(token,id,content)`(PUT `/admin/{id}`) · `adminUploadDiagram(token,slug,file)`(PUT `/admin/{slug}/diagram`, multipart) |
| 신규 | `frontend/components/PointEditor.tsx` | 클라 편집기: 마운트 시 raw 로드 → textarea(원문) [+ 우측 `Markdown` 미리보기] → 저장(로딩·에러·성공) → 저장 결과(Point) 상위로 콜백 |
| 신규 | `frontend/components/DiagramUploader.tsx` | 클라 업로더: SVG 파일 선택 → 검증(확장자/크기) → 업로드 → 갱신 `architectureDiagram` 콜백. 진행/에러 표시 |
| 수정 | `frontend/app/admin/points/[id]/page.tsx` | `controls`에 "편집" 버튼 → `PointEditor` 토글. 저장 성공 시 `PointView` 데이터 갱신 |
| 수정 | `frontend/app/admin/projects/[slug]/page.tsx` | `controls`에 `DiagramUploader` 배치. 성공 시 도식 갱신 렌더 |

## 5. 인터페이스·시그니처 (구체)
- `adminGetPointRaw(token,id) -> {content:string}` · `adminSavePoint(token,id,content) -> Point`(400/404/403 → 결과 타입에 에러 메시지) · `adminUploadDiagram(token,slug,file:File) -> ProjectIndex`.
- 편집 저장 실패(400: 게이트 미충족·id 불일치 등)는 **BE 메시지를 그대로 표시**하고 편집 상태 유지(사용자가 고쳐 재시도). 성공 시 편집 종료 + 뷰 갱신.
- 업로드는 multipart(`file`) 또는 `image/svg+xml` raw — be/0009 계약에 맞춘다.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 토큰 만료(403/404) 저장/업로드 중 | 에러 표시 + `/admin` 유도(재입력) | 컴포넌트 |
| published 저장인데 게이트 미충족(BE 400) | BE 사유 그대로 표시, 편집 유지, 파일 안 바뀜 | 편집기 |
| 빈 편집 내용 저장 | BE 400 표시(프론트도 빈값 사전 차단 가능) | 편집기 |
| 비-SVG/과대 도식 업로드 | 프론트 사전 검증 + BE 400 표시 | 업로더 |
| 저장 중 이탈/중복 클릭 | 저장 중 버튼 비활성(중복 제출 방지) | 컴포넌트 |
| 저장 성공 후 상태 배지 | draft↔published 편집이 반영돼 배지·목록에 반영 | 뷰 |

## 7. 수용 기준 — 결과문
- [ ] 관리자 포인트 페이지에서 "편집" → 원문 마크다운이 프리필된 편집기가 뜨고, 수정·저장하면 파일이 반영되어 뷰가 갱신된다.
- [ ] 저장 실패(BE 400)면 사유가 표시되고 편집 내용이 유지된다(유실 없음).
- [ ] 관리자 프로젝트 페이지에서 SVG를 업로드하면 도식이 그 자리에서 갱신 렌더된다.
- [ ] 토큰 만료 시 저장/업로드가 안전 실패하고 재입력으로 유도된다.
- [ ] 공개 페이지엔 편집·업로드 UI가 절대 안 보인다(admin 게이트).
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- BE 수정 금지(be/0008·0009 소비만). 포인트 신규 생성·삭제 UI 금지(편집·도식만). 공개 페이지에 편집 UI 노출 금지. WYSIWYG/리치에디터 도입 등 새 무거운 의존 금지(textarea + 기존 `Markdown` 미리보기로 충분). 챗봇·랜딩 등 무관 화면 변경 금지.

## 9. 검증 방법
- 토큰 세팅 → 편집: raw 프리필·수정 저장·파일 반영·400 사유표시 확인. 도식: 유효/무효 SVG 업로드·갱신 렌더·400 확인. 공개 페이지 미노출 확인.

## 10. 참조
- 선행 be/0008(편집+raw)·be/0009(도식)·fe/0004(뷰·controls) · `components/Markdown.tsx` · `lib/adminClient.ts`
