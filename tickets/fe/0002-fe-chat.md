---
id: 0002
title: fe/chat — 챗봇 패널(제안질문·멀티턴·근거링크·스트리밍)
branch: feat/fe-chat
base: main
domain: fe/chat
stage: V
pattern:
status: ready
engine: codex
created: 2026-06-29
---

# [0002] fe/chat — 챗봇 패널(제안질문·멀티턴·근거링크·스트리밍)

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지. UI 충실 참고: [_qa/chat.html](../../docs/fe/chat/_qa/chat.html).

## 1. 배경·목표
fe/browse의 전역 FAB에서 열리는 챗봇 패널. 제안 질문 + 입력창으로 묻고, 답변을 스트리밍으로 표시하며 끝에 근거(커밋/PR/Swagger 등) 링크를 노출한다. 멀티턴. be/chat API 소비.
- 근거: [플로우.md](../../docs/fe/chat/플로우.md) · [요소/챗봇-열림](../../docs/fe/chat/요소/챗봇-열림.md) · [요소/질문-응답](../../docs/fe/chat/요소/질문-응답.md) · [ARCHITECTURE §1·§2](../../docs/arch/ARCHITECTURE.md)
- 전제: **티켓 be/0003(be/chat) 먼저** — API 소비. 진입 FAB는 fe/0001 소유.

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `fe/chat` (챗 패널 플로우+표현) |
| 단계 | V |
| 가로지르는 도메인 | `be/chat`(HTTP 스트리밍) / `fe/browse`(FAB 진입구 소유) |
| 분류 근거 | 패널 상태 전이·표현은 FE, 응답·세션·근거는 be/chat |

## 3. 구조 결정 (패턴 타협)
- FE 도메인 = 플로우+V. 챗 패널은 Next.js **client island**(SSE 스트리밍 소비). 세션 이력은 서버(be/chat, 세션 쿠키)라 로컬 저장 안 함.

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `frontend/components/chat/ChatPanel.tsx` | 패널 컨테이너(데스크톱 우하단 패널 / 모바일 전체화면), 열림·닫기·상태 |
| 신규 | `frontend/components/chat/MessageList.tsx` | 말풍선 멀티턴 + 답변 하단 근거 링크 목록(외부 새 탭) |
| 신규 | `frontend/components/chat/Composer.tsx` | 입력창 + 제안 질문 칩 |
| 신규 | `frontend/lib/chatClient.ts` | `POST /api/chat`(SSE 스트리밍) · `GET /api/chat/suggestions?point=` 소비 |
| 신규 | `frontend/lib/staticSuggestions.ts` | 무맥락 기본 제안 질문(정적 FE 자원, 3~4개) |

## 5. 인터페이스·시그니처 (구체)
전이(플로우.md에 그려진 것만): 챗봇열림→질문응답(입력 전송 또는 제안 질문 클릭)·질문응답→질문응답(이어 질문, 이력 누적)·질문응답→외부근거(근거 링크 새 탭)·양 노드→닫기(fe/browse 복귀).

- 진입 맥락: FAB에서 전달된 포인트 `id`(포인트상세) 또는 무맥락.
- 제안 질문: **하이브리드** — 무맥락=`staticSuggestions`(정적), 포인트 맥락=`GET /api/chat/suggestions?point=id`(be/chat 동적). 3~4개.
- 답변: `POST /api/chat` SSE **스트리밍**(토큰 점진), 생성 중 로딩 인디케이터, 완료 후 하단 근거 링크(`kind` 배지 + `target="_blank" rel="noopener"`).
- 세션: `session_id` 세션 쿠키(be/chat 발급) 그대로 사용. 로컬 저장 없음.
- 접근성: 열릴 때 입력창 포커스, Esc 닫고 FAB로 포커스 복귀, 메시지 영역 `role="log"`+`aria-live="polite"`.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 첫 방문·세션 만료 | 빈 대화로 시작 + 제안 질문 표시 | ChatPanel |
| published 0개(빈 코퍼스) | 안내 표시 | MessageList |
| 근거 없음 답변 | be/chat "답할 수 없음" 응답 그대로 표시 | MessageList |
| 생성 실패·타임아웃 | 에러 메시지 + 재시도 버튼 | ChatPanel |
| 맥락 제안질문 빈 응답 | 정적 기본 질문으로 폴백 | Composer |

## 7. 수용 기준 — 결과문
- [ ] FAB로 열면 제안 질문(맥락/무맥락에 따라 다름) + 입력창이 뜬다.
- [ ] 질문 전송/제안 클릭 시 답변이 스트리밍으로 표시되고 끝에 근거 링크(외부 새 탭)가 붙는다.
- [ ] 이어 질문이 같은 세션으로 멀티턴 누적된다.
- [ ] 데스크톱=우하단 패널 / 모바일=전체화면.
- [ ] 플로우에 없는 전이는 만들지 않는다.

## 8. 범위 경계 — 하지 말 것
- 응답 생성·근거 정책·세션 저장 구현 금지(be/chat). FAB 버튼 자체 구현 금지(fe/browse 소유 — 여기선 열린 뒤).
- 대화 이력 localStorage 저장 금지(서버 세션). 인라인 선택-질문 금지(v3).

## 9. 검증 방법
- be/chat 로컬 기동 + fe/browse FAB로 진입 → 멀티턴·근거링크·맥락/무맥락 제안 확인.

## 10. 참조
- ARCHITECTURE §1·§2 · fe/chat 일지 · 선행 be/0003 · 진입 fe/0001
