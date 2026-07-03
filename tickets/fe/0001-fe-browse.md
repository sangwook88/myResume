---
id: 0001
title: fe/browse — 랜딩·프로젝트인덱스·포인트상세 + 전역 챗봇 FAB
branch: feat/fe-browse
base: main
domain: fe/browse
stage: V
pattern:
status: ready
engine: codex
created: 2026-06-29
---

# [0001] fe/browse — 랜딩·프로젝트인덱스·포인트상세 + 전역 챗봇 FAB

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지. UI 충실 참고: [_qa/browse.html](../../docs/fe/browse/_qa/browse.html).

## 1. 배경·목표
채용자가 published 위키를 둘러보는 3계층 화면(랜딩 → 프로젝트 인덱스 → 포폴 포인트 상세) + 전역 우하단 챗봇 FAB(진입구만 소유). Next.js로 be/project·be/point API를 fetch해 SSG/SSR 렌더.
- 근거: [플로우.md](../../docs/fe/browse/플로우.md) · [요소/랜딩](../../docs/fe/browse/요소/랜딩.md) · [요소/프로젝트-인덱스](../../docs/fe/browse/요소/프로젝트-인덱스.md) · [요소/포폴-포인트-상세](../../docs/fe/browse/요소/포폴-포인트-상세.md) · [ARCHITECTURE §1·§2](../../docs/arch/ARCHITECTURE.md)
- 전제: **티켓 0001·0002(be) 먼저** — API 소비.

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `fe/browse` (플로우+표현) |
| 단계 | V |
| 가로지르는 도메인 | `be/project`·`be/point`(HTTP) / `fe/chat`(FAB 진입구만) |
| 분류 근거 | 화면 전환·요소 배치는 FE, 데이터·규칙은 BE |

## 3. 구조 결정 (패턴 타협)
- FE 도메인 = 플로우+V, 패턴(TS/DM) 해당 없음. Next.js App Router, 서버 컴포넌트에서 BE API fetch(SSG/ISR), 챗 FAB는 client island(대화는 fe/chat 소관).

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `frontend/app/page.tsx` | 랜딩(추천 포인트 상단 + 프로젝트 목록 하단) |
| 신규 | `frontend/app/projects/[slug]/page.tsx` | 프로젝트 인덱스(표지 6요소 + published 포인트 목록) |
| 신규 | `frontend/app/points/[id]/page.tsx` | 포폴 포인트 상세(9섹션 + Evidence + 같은 프로젝트 다른 포인트) |
| 신규 | `frontend/components/ChatFab.tsx` | 전역 우하단 FAB(모든 화면 고정, fe/chat 진입) |
| 신규 | `frontend/lib/api.ts` | BE fetch 래퍼(`/api/points/recommended`, `/api/projects`, `/api/projects/{slug}`, `/api/points/{id}`) |
| 신규 | `frontend/app/layout.tsx` | 공통 레이아웃 + `<ChatFab/>` + 기본 디자인 템플릿 |

## 5. 인터페이스·시그니처 (구체)
전이(플로우.md에 그려진 것만): 랜딩→인덱스(프로젝트 카드)·랜딩→상세(추천 포인트)·인덱스→상세(포인트)·상세→상세(다른 포인트)·상세→Evidence 외부 새 탭(`target="_blank" rel="noopener"`)·상세→뒤로 인덱스. 전역 FAB→fe/chat(포인트상세에서 열면 현재 포인트 `id`를 맥락으로 전달, 랜딩·인덱스는 무맥락).

소비 DTO는 티켓 0001·0002의 camelCase 응답 그대로. 라우팅: `/`, `/projects/[slug]`, `/points/[id]`.
FAB 접근성: 키보드 포커스 가능, 터치 타겟 ≥44px, 모바일 safe-area.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 추천/프로젝트 0개(빈 상태) | 빈 상태 안내 표시 | 각 페이지 |
| 없는/draft `id`·`slug` 접근 | BE가 302 `/` → 랜딩으로 이동 | api.ts/페이지 |
| 프로젝트 published 포인트 0개 | 인덱스에서 포인트 목록 슬롯 미표시 | projects/[slug] |
| Evidence 링크 클릭 | 외부 새 탭 이탈 | points/[id] |

## 7. 수용 기준 — 결과문
- [ ] 랜딩에 추천 포인트(상단)·프로젝트(하단)가 렌더된다.
- [ ] 프로젝트 인덱스가 표지 6요소 + published 포인트 목록을 렌더(0개면 목록 슬롯 숨김).
- [ ] 포인트 상세가 9섹션 + Evidence(외부 새 탭) + 같은 프로젝트 다른 포인트를 렌더.
- [ ] 전역 FAB가 모든 화면 우하단 고정, 포인트상세에서 열면 포인트 id 맥락 전달.
- [ ] 플로우에 없는 전이는 만들지 않는다.

## 8. 범위 경계 — 하지 말 것
- 챗봇 대화 UI 구현 금지(fe/chat, 티켓 fe/0002). BE 로직·데이터 모델 구현 금지.
- 인라인 텍스트 선택-질문 금지(v3). 플로우에 없는 화면·전이 생성 금지.

## 9. 검증 방법
- BE 로컬 기동 + 샘플 콘텐츠로 세 화면 클릭 흐름 + FAB 표시 확인.

## 10. 참조
- ARCHITECTURE §1·§2 · fe/browse 일지 · 선행 be/0001·0002 · 관련 fe/0002
