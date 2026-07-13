---
id: 0007
title: be/project 관리자 조회 — draft 포함 프로젝트 인덱스·카탈로그(읽기)
branch: feat/be-project-admin-read
base: main
domain: be/project
stage: C
pattern: TS
status: ready
engine: codex
created: 2026-07-13
---

# [0007] be/project 관리자 조회 — draft 포함 인덱스·카탈로그

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문(`status: draft`로 되돌림). 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
be/point에는 이미 관리자 조회(draft 포함) 엔드포인트가 있다(`GET /api/points/admin`·`/admin/{id}`, `app/admin.py::require_admin` 게이트). 관리자 뷰(fe/0004)가 **프로젝트 인덱스 페이지도 draft 포인트를 포함해** 재사용 렌더하려면 be/project에도 동일한 관리자 조회가 필요하다. 이 티켓은 be/point 관리자 조회를 **거울처럼** be/project에 추가한다(읽기 전용 — 경계 이탈 아님).
- 근거: [ARCHITECTURE §6](../../docs/arch/ARCHITECTURE.md)(draft 비노출은 공개 경로 한정) · [기능_프로젝트인덱스조회](../../docs/be/project/기능_프로젝트인덱스조회.md)
- 재사용: `app/admin.py::require_admin`(CHAT_ADMIN_TOKEN + Bearer, 토큰 미설정=404).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/project` (표지·카탈로그 조립 소유자) |
| 단계 | C (조회 기능) |
| 가로지르는 도메인 | `be/point`(기존대로 포인트 frontmatter 스캔) — 여기선 draft 포함분까지 |
| 분류 근거 | 표지(index)와 포인트 목록 조립은 be/project 책임. draft 포함 변형만 추가 |

## 2b. 웨이브
- Wave 1(BE). fe/0004의 선행. be/point 관리자 조회는 이미 구현됨(참조만).

## 3. 구조 결정 (패턴 타협)
- TS 유지(arch §4 be/project=TS). 기존 조회 서비스에 **draft 필터를 끈 변형 경로**만 추가 — 공개 함수는 불변(published 필터 유지, 물리 분리).
- 라우트 순서: `/admin`·`/admin/{slug}`를 `/{slug}`(catch) **앞**에 선언(be/point router와 동일 주의).

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `backend/app/project/service.py` | `list_all_admin() -> list[ProjectSummary]`(published 0개도 후순위 없이 전량), `get_index_admin(slug) -> ProjectIndex | None`(draft 포인트 포함 목록 조립). 기존 공개 함수는 그대로 두고 draft 포함 경로만 신설(be/point service의 `list_all_admin`/`get_any_admin` 패턴 계승) |
| 수정 | `backend/app/project/router.py` | `GET /api/projects/admin`(require_admin) · `GET /api/projects/admin/{slug}`(require_admin) — `/{slug}` 앞에 선언 |
| (참조) | `backend/app/point/service.py` | 인덱스의 포인트 목록 조립이 be/point 조회를 쓰면, draft 포함 버전(`list_all_admin` 또는 project 필터 변형)을 호출 |

## 5. 인터페이스·시그니처 (구체)
- `GET /api/projects/admin` → `list[ProjectSummary]` (전 프로젝트, draft만 있는 프로젝트도 포함). 인증 실패=404/403.
- `GET /api/projects/admin/{slug}` → `ProjectIndex`(그 프로젝트의 **published+draft 포인트 전부**를 `points`에 담음) | 404(없는 slug) | 404/403(인증).
- `ProjectIndex`·`ProjectSummary` DTO는 기존 그대로 재사용(camelCase). 포인트 목록의 각 항목이 status를 담아야 하면 be/point의 `AdminPointSummary`를 재사용(status·updated 포함) — 그렇지 않으면 FE(fe/0004)가 `/api/points/admin?project=`로 별도 조회. **결정 필요 시 첫 갈림길**: (A) index.points에 status 실어 보냄 / (B) FE가 포인트는 be/point 관리자 목록으로 따로 받음. 기본 권장 = B(계약 최소 변경).

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 토큰 미설정 | 404(기능 은닉) | require_admin |
| 토큰 불일치 | 403 | require_admin |
| 없는 slug | 404(공개처럼 302 아님 — 관리자는 존재/부재를 알아도 됨) | router |
| published 0개 프로젝트 | admin 목록엔 정상 포함(후순위 강등 없음) | service |
| 포인트 0개 프로젝트 | points=[] 로 인덱스 반환 | service |

## 7. 수용 기준 — 결과문
- [ ] Bearer 토큰으로 `/api/projects/admin/{slug}` 호출 시 draft 포인트가 목록에 포함된다.
- [ ] 같은 slug의 공개 `/api/projects/{slug}`는 여전히 published만(불변).
- [ ] 토큰 없음/불일치는 404/403.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- **읽기 전용** — 쓰기·편집 금지(그건 be/0008·0009). 공개 함수·공개 라우트 시그니처 변경 금지(draft 노출 회귀 금지). fe 수정 금지. 새 의존 금지.

## 9. 검증 방법
- 임시 wiki 픽스처(draft 포인트 포함)로 `/admin/{slug}` 호출 → draft 포함 확인, 공개 경로는 미포함 확인, 인증 케이스 확인.

## 10. 참조
- ARCHITECTURE §6 · be/point service `list_all_admin`/`get_any_admin`(선례) · `app/admin.py` · 후속 fe/0004
