---
id: 0001
title: be/point — 포폴 포인트 데이터 모델·조회 API·발행 게이트
branch: feat/be-point
base: main
domain: be/point
stage: MC
pattern: TS
status: ready
engine: codex
created: 2026-06-29
---

# [0001] be/point — 포폴 포인트 데이터 모델·조회 API·발행 게이트

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문(`status: draft`). 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
개별 포폴 포인트(2계층)의 데이터 모델과 조회 API, 발행 게이트를 구현한다. 콘텐츠는 `wiki/<project>/<id>.md` 마크다운. Python/FastAPI가 파싱해 서빙(단일 소스). 이 도메인이 be/project·be/chat·fe/browse의 코퍼스·조회 대상이다.
- 근거: [be/point 데이터.md](../../docs/be/point/데이터.md) · [기능_추천포인트목록조회](../../docs/be/point/기능_추천포인트목록조회.md) · [기능_포인트목록조회](../../docs/be/point/기능_포인트목록조회.md) · [기능_포인트단건조회](../../docs/be/point/기능_포인트단건조회.md) · [ARCHITECTURE §1·§4·§5](../../docs/arch/ARCHITECTURE.md)

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/point` (포인트 데이터·발행 규칙 소유자, 참조 그래프 말단) |
| 단계 | M(포폴포인트·Evidence·status) + C(추천목록·프로젝트별목록·단건조회 + 발행) |
| 가로지르는 도메인 | 없음(be/point가 읽는 도메인 없음). be/project·be/chat·fe/browse가 이걸 부른다 |
| 분류 근거 | 포인트 마크다운·frontmatter·발행 status를 이 도메인이 소유·파싱한다 |

## 3. 구조 결정 (패턴 타협)
- 채택: **TS(트랜잭션 스크립트)** — 파일 파싱→DTO 조회 + 발행 게이트 검증은 얇은 절차. 서비스 함수로 구현, 도메인 모델 불필요. (ARCHITECTURE §4)

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `backend/app/point/models.py` | Pydantic DTO: `Point`, `Evidence`, `PointSummary` |
| 신규 | `backend/app/point/repository.py` | `wiki/*.md` 파싱·로드(frontmatter + 9섹션 + Evidence) |
| 신규 | `backend/app/point/service.py` | `list_recommended()`, `list_by_project(slug)`, `get_published(id)` |
| 신규 | `backend/app/point/router.py` | FastAPI 라우터(아래 §5 엔드포인트) |
| 신규 | `scripts/publish.py` | 발행 CLI: draft→published, 게이트 검증 |
| 신규 | `wiki/.gitkeep` | 콘텐츠 루트(예시 포인트는 넣지 않음) |

## 5. 인터페이스·시그니처 (구체)
데이터(frontmatter YAML): `id`(케밥), `title`, `project`(케밥 slug), `status`(`draft`|`published`), `tags`(string[], 예약값 `featured`), `commits`(git range), `updated`(ISO). 본문 9섹션(제목·요약/배경/문제/고려한옵션표/결정과근거/실행/결과/회고/Evidence). Evidence[]: `kind`(`commit`|`pr`|`swagger`|`file`|`link`)·`label`·`url`.

DTO(JSON = **camelCase**):
- `PointSummary` = `{ id, title, tags, project }`
- `Point` = `PointSummary` + `{ sections: {background, problem, options[], decision, execution, result, retrospective}, summary, evidence: {kind,label,url}[] }`

REST(모두 published만):
- `GET /api/points/recommended` → `PointSummary[]` (최대 3). 선정: `featured` 태그 우선 → 동점 `updated` 최신순.
- `GET /api/points?project=<slug>` → `PointSummary[]` (해당 project published, 정렬 구현 기본).
- `GET /api/points/{id}` → `Point` (published). 없거나 draft면 **HTTP 302 → `/`**(랜딩 리다이렉트).

발행 CLI `python scripts/publish.py <id>`: Evidence ≥1 **AND** 핵심 섹션(제목·요약/문제/결정과 근거/Evidence) 채워짐 검증 → 통과 시 frontmatter `status: published`로 기록, 실패 시 비영으로 종료 + 사유 출력.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| published 0개(추천/목록) | 빈 배열 | service |
| 없는/draft id 단건 접근 | 302 → `/` | router |
| 없는 project 목록조회 | 빈 배열 | service |
| 선택 섹션(배경·실행·결과·회고·옵션표) 비었음 | 해당 섹션 필드 생략(누락 렌더는 FE) | repository |
| 발행 게이트 미충족(Evidence 0 또는 핵심섹션 결손) | 발행 거부 + 사유, status 불변 | scripts/publish |
| 데이터 로드 실패 | 표준 5xx 에러 | router |

## 7. 수용 기준 — 결과문
- [ ] `GET /api/points/recommended`가 `featured` 우선·동점 최신순 상위 3 `PointSummary[]`를 준다.
- [ ] `GET /api/points?project=X`가 X의 published `PointSummary[]`를 준다(없으면 `[]`).
- [ ] `GET /api/points/{id}`가 published면 `Point`, 아니면 302 `/`.
- [ ] `publish.py`가 Evidence≥1+핵심섹션 충족 시만 `published`로 승격.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- 프로젝트 표지(be/project)·챗봇(be/chat)·화면(FE) 구현 금지.
- 관계형 DB 도입 금지(콘텐츠=git 마크다운). 새 의존은 FastAPI·Pydantic·PyYAML 외 추가 금지.
- 예시 포인트 데이터 생성 금지(저작은 로컬).

## 9. 검증 방법
- `wiki/<proj>/<id>.md` 임시 샘플 1~2개로 세 엔드포인트 응답 + publish 게이트 통과/거부 확인(샘플은 커밋하지 않음).

## 10. 참조
- ARCHITECTURE §1·§4·§5 · be/point 일지 · 후속 티켓 0002·0003
