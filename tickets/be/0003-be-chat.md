---
id: 0003
title: be/chat — load-all 답변 생성·근거 인용·세션·맥락 제안질문
branch: feat/be-chat
base: main
domain: be/chat
stage: MC
pattern: TS
status: ready
engine: codex
created: 2026-06-29
---

# [0003] be/chat — load-all 답변 생성·근거 인용·세션·맥락 제안질문

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
챗봇 응답 엔진. published 코퍼스(be/point 포인트 + be/project 표지)를 **load-all**해 근거와 함께 답변을 스트리밍 생성하고, 세션 대화 이력을 Redis에 TTL로 보관하며, 포인트 맥락 제안질문을 만든다. RAG 아님(v1=전부 로드).
- 근거: [be/chat 데이터.md](../../docs/be/chat/데이터.md) · [기능_답변생성](../../docs/be/chat/기능_답변생성.md) · [기능_제안질문생성](../../docs/be/chat/기능_제안질문생성.md) · [기능_세션이력관리](../../docs/be/chat/기능_세션이력관리.md) · [ARCHITECTURE §1·§4·§5](../../docs/arch/ARCHITECTURE.md)
- 전제: **티켓 0001·0002 먼저**(코퍼스 서비스 호출).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/chat` (대화 세션 데이터 소유 + 응답 오케스트레이션) |
| 단계 | M(대화세션·Turn·Citation) + C(답변생성·제안질문·세션이력) |
| 가로지르는 도메인 | `be/point`·`be/project`(단방향, load-all 코퍼스 읽기) |
| 분류 근거 | 대화 세션은 be/chat 고유 데이터. 근거 인용은 be/point Evidence 재사용 |

## 3. 구조 결정 (패턴 타협)
- 채택: **TS** — LLM·Redis 오케스트레이션, 도메인 불변식 없음. LangChain(Python) + Anthropic. (ARCHITECTURE §4)
- LLM: Claude API `claude-sonnet-5`, 스트리밍. **프롬프트 캐싱**(`cache_control`)으로 안정적 코퍼스 prefix 캐싱.
- 세션: LangChain `RedisChatMessageHistory` 류, key=`session_id`, **TTL 1일 sliding**(쓰기마다 갱신).

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `backend/app/chat/models.py` | DTO: `Turn`, `Citation`, `ChatRequest` |
| 신규 | `backend/app/chat/corpus.py` | published load-all(be/point+be/project) → 캐시 가능한 컨텍스트 문자열 |
| 신규 | `backend/app/chat/session.py` | Redis 세션 이력 로드/저장(session_id, TTL 1일 sliding) |
| 신규 | `backend/app/chat/service.py` | `answer(session_id, question, context)` 스트리밍 · `suggest(point_id)` |
| 신규 | `backend/app/chat/router.py` | FastAPI 라우터(§5, SSE) |

## 5. 인터페이스·시그니처 (구체)
데이터: 세션 `{ sessionId, context(포인트 id|null), turns: Turn[], createdAt, expiresAt(마지막활동+1일) }`. `Turn`=`{ role: 'user'|'assistant', text, citations: Citation[] }`. `Citation`=`{ kind, label, url }`(be/point evidence.kind 재사용).

REST:
- `POST /api/chat` (SSE 스트리밍) — body `{ question, context?: pointId }`, `session_id`는 **세션 쿠키**로 수신. 동작: 세션 이력 로드 → published load-all(맥락 포인트 우선) → Sonnet 5 스트리밍 답변 + 인용 Citation → assistant Turn을 세션에 append. 근거 없으면 "근거 없어 답할 수 없음"류. 응답 타임아웃 **30초**.
- `GET /api/chat/suggestions?point=<id>` → `string[]`(3). 해당 포인트 핵심 섹션(제목·요약·문제·결정과근거) 기반. 없는/비공개 포인트면 `[]`.

세션 쿠키: 서버 발급 `session_id`, 최초 요청 시 세팅(만료형).

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 첫 방문·세션 만료·이력 로드 실패 | 빈 이력으로 시작 | session |
| 코퍼스 근거 없음 / published 0개 | "답할 수 없음"류 응답(추측 금지) | service |
| 생성 실패·30초 타임아웃 | 에러 반환(FE 재시도) | router |
| load-all 컨텍스트 예산 초과 | v1은 예산 내 가정 — 초과 시 로그 경고(RAG=v3 신호), 그대로 시도 | corpus |
| 없는/비공개 맥락 포인트(제안질문) | 빈 배열 | service |

## 7. 수용 기준 — 결과문
- [ ] `POST /api/chat`가 SSE로 토큰을 스트리밍하고 답변 끝에 Citation을 준다.
- [ ] 같은 세션 쿠키로 이어진 요청이 이전 턴을 컨텍스트로 반영한다(멀티턴).
- [ ] 세션이 1일 활동 없으면 만료되어 빈 이력으로 시작한다.
- [ ] 코퍼스에 근거 없으면 답을 지어내지 않는다.
- [ ] `GET /api/chat/suggestions?point=X`가 3개 제안질문을 준다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- be/point·be/project 내부 수정 금지(읽기 호출만). 화면(fe/chat)·FAB 진입구(fe/browse) 금지.
- RAG(임베딩·벡터·리랭커) 구현 금지 — v1은 load-all. 무맥락 기본 제안질문은 FE 정적 자원이라 여기서 만들지 않는다.

## 9. 검증 방법
- 샘플 코퍼스로 `POST /api/chat` 멀티턴 + 근거 인용 + 근거없음 케이스, `suggestions` 확인. Redis 로컬 인스턴스 사용.

## 10. 참조
- ARCHITECTURE §1·§4·§5 · be/chat 일지 · 선행 0001·0002 · 후속 fe/0002
