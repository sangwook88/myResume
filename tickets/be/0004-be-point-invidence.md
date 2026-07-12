---
id: 0004
title: be/point v4 — invidence(숨은 detail·code) 파싱 + 챗봇전용 접근자 + 발행코드추출
branch: feat/be-point-invidence
base: main
domain: be/point
stage: MC
pattern: TS
status: ready
engine: codex
created: 2026-07-12
---

# [0004] be/point v4 — invidence 하이브리드 콘텐츠

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md §v4-A](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
각 Evidence 밑에 **invidence 숨은 층**(사람이 쓴 `detail` + 발행 시 git에서 뽑은 `code`)을 붙인다. **공개 조회(get_published 등)에는 절대 노출하지 않고**, be/chat 챗봇 코퍼스 전용 접근자로만 읽는다(공개/비공개 물리 분리). code는 발행 시 1회 추출해 사이드카 파일에 저장한다.
- 근거: [be/point 데이터.md](../../docs/be/point/데이터.md) · [기능_챗봇컨텍스트조회](../../docs/be/point/기능_챗봇컨텍스트조회.md) · [기능_발행코드추출](../../docs/be/point/기능_발행코드추출.md) · [ARCHITECTURE §v4-A](../../docs/arch/ARCHITECTURE.md)
- 전제: 선행 티켓 0001(be/point) 위에 얹는 확장. be/chat 캐싱(0005)이 이 접근자를 소비한다.

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/point` (Evidence 종속 숨은 데이터 소유) |
| 단계 | M(invidence 파싱·저장) + C(챗봇전용 접근자·발행코드추출) |
| 가로지르는 도메인 | `be/chat`(접근자 소비, 단방향) |
| 분류 근거 | invidence는 Evidence에 종속된 be/point 데이터 — 별 도메인 안 만듦 |

## 3. 구조 결정 (패턴 타협)
- 채택: **TS** — 얇은 파싱·git 1회 읽기. 도메인 불변식 없음(ARCHITECTURE §4·§v4-A). README 패턴 슬롯 그대로.
- **공개/비공개 물리 분리:** invidence는 `_invidence` 내부 키로만 raw dict에 싣고, 공개 DTO(`Point`)·공개 서비스(`get_published`·`list_*`)에는 절대 넣지 않는다. 챗봇 전용 모델·접근자에서만 노출.

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `backend/app/point/repository.py` | ① 본문에서 숨은 섹션 `## 챗봇전용 [[E{n}]]` 블록 파싱(9섹션과 별도) → detail. ② 사이드카 `<id>.code.md` 읽어 `## [[E{n}]]` 블록 파싱 → code. 둘을 `_invidence: {n: {detail, code}}`(n=포인트-로컬 Evidence 1-based 순번)로 raw에 실음. **공개 파싱 경로·`load_raw` 반환의 공개 필드는 불변** — `_invidence`만 추가 |
| 수정 | `backend/app/point/models.py` | 챗봇 전용 모델 추가: `ChatbotEvidence(Evidence)` += `detail: str\|None=None`, `code: str\|None=None`. `ChatbotPoint(Point)`에서 `evidence: list[ChatbotEvidence]`로 override. **공개 `Point`·`Evidence`는 불변** |
| 수정 | `backend/app/point/service.py` | `get_chatbot_point(point_id) -> ChatbotPoint \| None` 추가 — get_published와 동일 로직 + raw `_invidence`를 각 Evidence(순번 매칭)에 부착. **published만**(draft None). 기존 공개 3함수 불변 |
| 수정 | `scripts/publish.py` | 발행 통과 후 `_extract_code()` 호출 — kind가 `commit`·`pr`인 Evidence의 url/commits ref에서 변경 hunk를 `git`으로 1회 추출해 `wiki/<project>/<id>.code.md`에 `## [[E{n}]]` 블록으로 기록(덮어씀) |

## 5. 인터페이스·시그니처 (구체)
- **숨은 섹션 키잉:** `## 챗봇전용 [[E{n}]]`의 `{n}`은 **이 포인트 Evidence 배열의 1-based 순번**(전역 E토큰 아님 — 전역 번호는 코퍼스 빌드가 매김). 사이드카 `.code.md`도 동일 `## [[E{n}]]` 키잉. 인식 못한 `n`(Evidence 없음)은 무시.
- `ChatbotEvidence` = `{ kind, label, url, detail?, code? }`(camelCase 직렬화 상속). `ChatbotPoint` = `Point` + `evidence: ChatbotEvidence[]`.
- `get_chatbot_point(point_id: str) -> ChatbotPoint | None` — published 단건 + invidence 부착. 없는/draft = None.
- **발행코드추출:** `commit` = 해당 커밋의 diff, `pr`도 커밋 범위 diff. hunk만(파일 헤더 최소). ref = Evidence `url`에서 해시 파싱(불가하면 frontmatter `commits` range 폴백). code 크기 상한 초과 시 앞부분만 남기고 `…(잘림)` 표시(상한 수치값=env `POINT_CODE_MAX_CHARS`, 기본은 구현이 잡는다).

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 숨은 섹션·사이드카 없음 | detail/code = None(invidence 없이 정상) | repository |
| 사이드카 파일 자체 부재 | code 전부 None(에러 아님) | repository |
| 공개 조회로 접근 | invidence 절대 미포함(회귀 테스트로 고정) | service |
| ref 해석 실패·git 미설치 | 해당 Evidence code 비우고 **발행 계속**(발행 안 막음) | publish |
| 재발행 | `.code.md` 덮어씀(버전 누적 안 함) | publish |
| detail만/code만 있음 | 있는 쪽만 부착 | service |
| code 크기 상한 초과 | 앞부분 자름 + `…(잘림)` | publish |

## 7. 수용 기준 — 결과문
- [ ] `get_chatbot_point`가 숨은 섹션 detail과 사이드카 code를 올바른 Evidence에 순번 매칭해 부착한다.
- [ ] `get_published`·`list_*`·공개 `Point` JSON에 invidence(detail·code)가 **절대** 나타나지 않는다.
- [ ] `scripts/publish.py`가 발행 통과 시 commit/pr Evidence의 hunk를 `<id>.code.md`에 기록하고, ref 실패 시 그 code만 비운 채 발행을 완료한다.
- [ ] 재발행이 사이드카를 덮어쓴다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- 공개 `Point`/`Evidence` DTO·공개 서비스 3함수·`iter_raw`의 공개 필드 시그니처 변경 금지(invidence는 내부 `_invidence`·챗봇 전용 모델로만).
- be/chat corpus·service 수정 금지(0005 소관 — 이 티켓은 접근자만 제공).
- 발행 게이트 규칙 변경 금지(Evidence≥1 불변, invidence는 게이트 무영향).
- code 크기 상한 **수치값** 정책 결정 금지(env 손잡이만, 기본값은 구현 튜닝).

## 9. 검증 방법
- 임시 wiki 픽스처(숨은 섹션 있는 포인트 + `.code.md` 사이드카)로 `get_chatbot_point` 부착·순번 매칭 확인, `get_published` invidence 부재 회귀. git 가짜 ref로 추출 실패 폴백 확인.

## 10. 참조
- ARCHITECTURE §v4-A · be/point 일지 · 선행 0001 · 후속 0005(be/chat 캐싱이 접근자 소비)
