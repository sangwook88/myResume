---
id: 0005
title: be/chat v4 — 프롬프트 캐싱 정상화(프리픽스 안정 + invidence 코퍼스 + 1h TTL 실측)
branch: feat/be-chat-caching
base: main
domain: be/chat
stage: C
pattern: TS
status: ready
engine: codex
created: 2026-07-12
---

# [0005] be/chat v4 — 프롬프트 캐싱 정상화

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md §v4-B](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
load-all 코퍼스 프롬프트 캐싱을 실제로 성립시킨다. 현 코드의 결함 4개(프리픽스 불안정 3 + 관측 불가 1)를 고쳐, **코퍼스까지를 안정 프리픽스로 캐시**하고 가변부(tone·진입맥락 포인터)를 브레이크포인트 뒤로 뺀다. 코퍼스는 be/point 챗봇전용 접근자로 읽어 invidence까지 캐시 프리픽스에 싣는다.
- 근거: [기능_답변생성](../../docs/be/chat/기능_답변생성.md) · [be/chat 데이터.md](../../docs/be/chat/데이터.md) · [ARCHITECTURE §v4-B](../../docs/arch/ARCHITECTURE.md)
- 전제: **티켓 0004 먼저**(`get_chatbot_point` 접근자).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/chat` (응답 오케스트레이션·프롬프트 조립) |
| 단계 | C(코퍼스 조립·프롬프트 구조·LLM 클라이언트) |
| 가로지르는 도메인 | `be/point`(챗봇전용 접근자 소비, 단방향) |
| 분류 근거 | 프롬프트 구조·캐싱은 be/chat 서빙 로직. invidence 데이터는 be/point 소유(읽기만) |

## 3. 구조 결정 (패턴 타협)
- 채택: **TS** 유지(ARCHITECTURE §4). 도메인 모델 아님 — LLM 오케스트레이션 손질.
- **프롬프트 구조(확정, ARCHITECTURE §v4-B):**
  ```
  SystemMessage(content=[
    {type:text, text: 고정지시 + 코퍼스, cache_control:{type:"ephemeral", ttl:"1h"}},  # 캐시 프리픽스
    {type:text, text: tone + 진입맥락 포인터},                                          # 캐시 밖 꼬리
  ])
  HumanMessage(질문)   # 순수 질문(세션 Turn 저장도 순수)
  ```

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `backend/app/chat/corpus.py` | ① `build_corpus`의 **진입 포인트 맨 앞 재배치 제거**(L129-136·L145 중복 스킵도 정리) → 코퍼스는 항상 정준 순서(프로젝트→포인트). ② 열거 시 `get_published` → `point_service.get_chatbot_point`로 교체, `_render_point`가 각 `[[E{token}]]` 밑에 invidence detail·code를 **비인용 컨텍스트**로 덧붙임. ③ 진입 맥락은 코퍼스에서 빼고, `CorpusBundle`에 `entry_pointer: str\|None`(예: `"방문자는 '<제목>'([E{token}]) 관련 포인트에서 진입"`) 필드로 반환 |
| 수정 | `backend/app/chat/service.py` | ① `_ANSWER_SYSTEM`을 **2블록으로 분리** — `_ANSWER_PREFIX`(고정지시+`{corpus}`, 캐시 대상)와 `_ANSWER_TAIL`(`{tone}` + entry_pointer, 캐시 밖). `{tone}`을 프리픽스 밖으로 이동. ② `LLMClient.stream_answer`/`generate` 시그니처를 `(prefix_text, tail_text, messages)`로 확장(또는 system 블록 리스트 전달). ③ `AnthropicLLM._to_lc_messages`: system content = [프리픽스 블록(cache_control ttl:"1h"), 꼬리 블록(no cache_control)]. ④ `ChatAnthropic(..., stream_usage=True)` + 1h 확장 캐시 beta 헤더 `anthropic-beta: extended-cache-ttl-2025-04-11`(model_kwargs/extra_headers). ⑤ 스트림 종료 시 usage_metadata의 cache_read/creation 토큰을 로깅 |
| 수정(선택) | `backend/requirements.txt` | 주석만 갱신(1h TTL·stream_usage 반영). 새 의존 없음 |

## 5. 인터페이스·시그니처 (구체)
- `CorpusBundle` += `entry_pointer: str | None = None`. 진입 맥락 포인트가 published면 짧은 포인터 문자열, 아니면 None. **코퍼스 text에는 진입 포인트를 재배치/중복 삽입하지 않는다**(정준 위치에 1회만).
- invidence 렌더: `_render_point`에서 각 Evidence 줄 `- [[E{n}]] kind=... | label | url` 다음 줄들에 `  - (상세) {detail}` / `  - (코드)\n    ```\n{code}\n    ```` 형태로 붙인다. **Citation 매핑(evidence registry)은 불변** — invidence는 인용 토큰 부여 대상 아님.
- `tone`은 `_MODE_TONE`(technical/hr) 그대로, 위치만 꼬리 블록으로. entry_pointer는 꼬리 블록에서 tone 다음에 붙인다.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 진입 맥락 없음/비공개 | entry_pointer=None, 꼬리엔 tone만 | corpus/service |
| invidence 없는 포인트 | Evidence만 렌더(기존과 동일) | corpus |
| 모드 전환(technical↔hr) | 프리픽스 불변 → 캐시 적중 유지(꼬리만 변경) | service |
| 다른 진입점 | 프리픽스 불변 → 캐시 적중 유지 | service |
| RAG 경로(_RAG_ENABLED ON) | 캐싱 대상 아님 — build_corpus_rag는 프리픽스 분리 미적용(기존 동작 유지) | corpus |
| stream_usage 미지원 SDK | 로깅만 실패 삼킴, 답변 정상 | service |

## 7. 수용 기준 — 결과문
- [ ] 코퍼스 text가 진입 맥락과 무관하게 **바이트 동일**하다(같은 published 집합 → 같은 프리픽스).
- [ ] technical↔hr 모드 전환·진입점 변경이 프리픽스(캐시 블록)를 바꾸지 않는다.
- [ ] system이 [코퍼스 캐시 블록(ttl 1h)] + [tone·진입 꼬리] 2블록으로 나가고, 질문은 user 메시지에 순수 저장된다.
- [ ] 코퍼스에 invidence detail·code가 각 Evidence 밑에 실리되, Citation 토큰은 Evidence에만 매겨진다.
- [ ] usage_metadata의 cache_read/creation 토큰이 로깅된다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- be/point 내부 수정 금지(0004의 `get_chatbot_point` 읽기 호출만).
- RAG(build_corpus_rag·retrieval) 로직 변경 금지 — 캐싱은 load-all 경로 전용.
- 세션 스토어(session.py)·라우터 SSE 프레이밍·인용 파싱(_CitationSplitter) 변경 금지.
- keep-alive/하트비트 구현 금지(ARCHITECTURE §v4-B — 측정 우선, 미도입).
- 1h TTL·모델·타임아웃 등 정책 수치 변경 금지.

## 9. 검증 방법
- 가짜 LLM로 `answer_stream` 실행 후 전달된 system 블록 구조(2블록·cache_control·tone 위치)·코퍼스 바이트 동일성(진입점 다르게 2회)·invidence 렌더·Citation 불변 검증. cache_read 로깅은 usage_metadata 가짜 주입으로.

## 10. 참조
- ARCHITECTURE §v4-B · be/chat 일지 · 선행 0004 · 관련 0003(원본 be/chat)
