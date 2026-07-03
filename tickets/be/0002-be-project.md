---
id: 0002
title: be/project — 프로젝트 표지 데이터·카탈로그·인덱스 조립 API
branch: feat/be-project
base: main
domain: be/project
stage: MC
pattern: TS
status: ready
engine: codex
created: 2026-06-29
---

# [0002] be/project — 프로젝트 표지 데이터·카탈로그·인덱스 조립 API

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
프로젝트 인덱스(1계층 표지)의 데이터 모델과 카탈로그·인덱스 조회 API. 콘텐츠는 `wiki/<project>/index.md`. 인덱스의 포인트 목록은 저장하지 않고 be/point에서 조립한다.
- 근거: [be/project 데이터.md](../../docs/be/project/데이터.md) · [기능_프로젝트목록조회](../../docs/be/project/기능_프로젝트목록조회.md) · [기능_프로젝트인덱스조회](../../docs/be/project/기능_프로젝트인덱스조회.md) · [ARCHITECTURE §4·§5](../../docs/arch/ARCHITECTURE.md)
- 전제: **티켓 0001(be/point) 먼저** — 포인트목록 조립에 be/point service를 호출.

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/project` (프로젝트 표지 데이터 소유자) |
| 단계 | M(프로젝트 표지) + C(프로젝트목록·프로젝트인덱스조회) |
| 가로지르는 도메인 | `be/point`(단방향) — 인덱스 포인트목록 조립 시 호출 |
| 분류 근거 | 표지(요약·역할·스택·아키텍처·성과)는 포인트와 다른 데이터라 별도 소유 |

## 3. 구조 결정 (패턴 타협)
- 채택: **TS** — 표지 조회 + 포인트목록 조립은 거의 순수 조회. 서비스 함수. (ARCHITECTURE §4)

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `backend/app/project/models.py` | DTO: `ProjectSummary`, `ProjectIndex` |
| 신규 | `backend/app/project/repository.py` | `wiki/<slug>/index.md` 파싱·로드 |
| 신규 | `backend/app/project/service.py` | `list_projects()`, `get_index(slug)` (be/point service 호출) |
| 신규 | `backend/app/project/router.py` | FastAPI 라우터(§5) |

## 5. 인터페이스·시그니처 (구체)
데이터(index.md frontmatter/본문): `slug`(케밥), `summary`, `role`, `period`(`YYYY.MM–YYYY.MM`), `teamSize`, `techStack`(string[]), `architecture`(텍스트/마크다운), `highlights`(string[]).

DTO(JSON camelCase):
- `ProjectSummary` = `{ slug, summary }`
- `ProjectIndex` = `{ slug, summary, role, period, teamSize, techStack, architecture, highlights, points: PointSummary[] }`

REST:
- `GET /api/projects` → `ProjectSummary[]`. 모든 프로젝트 노출, **published 포인트 0개는 후순위**; 같은 순위군 정렬은 구현 기본.
- `GET /api/projects/{slug}` → `ProjectIndex`. `points`는 be/point `list_by_project(slug)`로 조립. 없거나 노출 불가 slug면 **302 → `/`**.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 프로젝트 0개 | 빈 배열 | service |
| published 포인트 0개 프로젝트 | 카탈로그 후순위 배치 + 인덱스 `points: []`(FE가 슬롯 숨김) | service |
| 없는/노출 불가 slug | 302 → `/` | router |
| 데이터 로드 실패 | 표준 5xx | router |

## 7. 수용 기준 — 결과문
- [ ] `GET /api/projects`가 `ProjectSummary[]`(0-포인트 프로젝트 후순위)를 준다.
- [ ] `GET /api/projects/{slug}`가 표지 6요소 + `points`(be/point 조립)를 준다.
- [ ] 없는 slug면 302 `/`.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- be/point 내부 수정 금지(읽기 호출만). 화면(FE)·챗봇 금지. 표지 예시 데이터 생성 금지.
- 포인트 목록을 표지에 저장 금지(항상 be/point 파생).

## 9. 검증 방법
- 임시 `wiki/<slug>/index.md` + 포인트 샘플로 두 엔드포인트 확인(커밋 안 함).

## 10. 참조
- ARCHITECTURE §4·§5 · be/project 일지 · 선행 0001 · 후속 0003·fe
