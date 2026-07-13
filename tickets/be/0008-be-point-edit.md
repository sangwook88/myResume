---
id: 0008
title: be/point 관리자 편집 — 포인트 마크다운 저장(쓰기) 엔드포인트
branch: feat/be-point-edit
base: main
domain: be/point
stage: C
pattern: TS
status: ready
engine: codex
created: 2026-07-13
---

# [0008] be/point 관리자 편집 — 포인트 마크다운 저장(쓰기)

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
관리자 대시보드에서 포인트 **문서 내용을 편집·저장**할 수 있게 be/point에 관리자 전용 **쓰기** 엔드포인트를 추가한다. 편집 결과는 `wiki/<project>/<id>.md` 파일에 반영된다.

> ⚠️ **아키텍처 경계 이탈(명시).** ARCHITECTURE §1·§8 및 [HOME](../../docs/HOME.md)은 **"저작=로컬 Claude Code(pofol) / 서빙=읽기전용 API"**로 확정했고 `be/wiki 저작 엔진(자동화)`은 **YAGNI로 안 함**이었다. 이 티켓은 그 경계를 넘어 **서빙 API에 쓰기**를 도입한다. 오너의 의도된 확장 결정으로 진행하되, 승인 시 **ARCHITECTURE에 델타 반영 + `docs/be/point/일지.md`에 1줄 기록**이 필요하다(구현 에이전트는 일지 1줄 추가).

- 재사용 인증: `app/admin.py::require_admin`(CHAT_ADMIN_TOKEN + Bearer).
- 근거: [데이터.md](../../docs/be/point/데이터.md)(파일 구조·frontmatter·9섹션) · `backend/app/point/repository.py`(파싱·발행게이트).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/point` (포인트 마크다운 파일 소유·파싱자) |
| 단계 | C (쓰기 기능) |
| 가로지르는 도메인 | 없음(로컬 파일 IO). fe/browse가 HTTP로 호출 |
| 분류 근거 | 파일을 소유·파싱하는 be/point가 쓰기도 책임 |

## 3. 구조 결정 (패턴 타협)
- **편집 단위 = 전체 마크다운 텍스트(무손실).** 구조화 필드로 쪼개 재직렬화하면 표·숨은 섹션·서식이 유실된다 → 파일을 **원문 그대로** 받아 검증 후 저장. (CMS raw 에디터 방식.)
- TS 유지(arch §4). 파일 쓰기는 **원자적**(같은 디렉토리 temp 파일 write → `os.replace`)로 부분쓰기 방지.
- 경계 이탈(쓰기)이라 §1 경고 + 일지 1줄.

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `backend/app/point/repository.py` | `path_of_id(point_id) -> Path | None`(iter_raw 스캔으로 실존 파일 경로만 반환 — 경로 조합 금지) · `save_markdown(path: Path, text: str) -> None`(utf-8 원자적 쓰기) |
| 신규 | `backend/app/point/service.py` | `update_point_admin(point_id: str, content: str) -> Point`(검증 후 저장, 갱신 Point 반환) + 검증 예외 |
| 신규 | `backend/app/point/models.py` | `PointEdit(CamelModel)` 입력 DTO — `content: str`(전체 마크다운) |
| 수정 | `backend/app/point/router.py` | `GET /api/points/admin/{point_id}/raw`(require_admin) → 편집 프리필용 **원문 마크다운**; `PUT /api/points/admin/{point_id}`(require_admin) → 저장 후 갱신 Point |
| 수정 | `docs/be/point/일지.md` | 「서빙 API에 편집 쓰기 도입(경계 이탈, 오너 승인)」 1줄 |

## 5. 인터페이스·시그니처 (구체)
- `GET /api/points/admin/{point_id}/raw` → `{ "content": "<파일 원문 마크다운>" }`(편집기 프리필). 404(없는 id·인증 미설정)·403. `/{point_id}`·`/admin/{point_id}` 등 기존 라우트와 경로 순서 주의(`/admin/{point_id}/raw`는 2세그먼트라 충돌 없음).
- `PUT /api/points/admin/{point_id}` body `{ "content": "<전체 마크다운>" }`
  - 200 → 갱신된 `Point`(재파싱 결과)
  - 400 → 파싱 실패 / frontmatter `id` ≠ URL `point_id` / project 불일치 / 빈 content / published 저장인데 발행게이트 미충족
  - 404 → 없는 point_id(신규 생성 안 함) · 인증 미설정
  - 403 → 토큰 불일치
- 검증 순서(service): ① content 파싱(`repository.load_raw` 로직 재사용) 성공 ② parsed.id == point_id ③ parsed.project == 실존 파일의 project ④ status=="published"면 `repository.publish_errors(parsed)`가 빈 배열 — 위반 시 저장 안 하고 400.
- 저장: 검증 통과 시에만 `save_markdown`(원자적). 저장 후 `get_any_admin(point_id)`로 재조회해 반환.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 없는 id | 404, 새 파일 생성 안 함 | service/router |
| frontmatter id 변경(리네이밍 시도) | 400, 파일 미변경(id 이동은 이 경로로 금지) | service |
| project 변경(이동 시도) | 400, 파일 미변경 | service |
| 파싱 실패(깨진 frontmatter) | 400, 파일 미변경 | service |
| path traversal(`../`·절대경로 id) | `path_of_id`가 실존 스캔 매칭만 → 404 | repository |
| status=published인데 게이트 미충족 | 400(사유 메시지), 파일 미변경 | service |
| status=draft 저장 | 게이트 무관 허용 | service |
| 동시 편집(2 관리자) | last-write-wins(v1, 락 없음) — 티켓에 명시 | — |
| 쓰기 실패(권한/디스크) | 500, 원자적 쓰기라 원본 보존 | repository |

## 7. 수용 기준 — 결과문
- [ ] 유효 마크다운 PUT → 파일이 갱신되고 갱신 Point가 반환된다.
- [ ] 없는 id는 404이고 새 파일이 생기지 않는다.
- [ ] id/project 불일치·파싱 실패는 400이고 파일이 안 바뀐다.
- [ ] published로 저장 시 게이트 미충족이면 400(파일 안 바뀜), draft는 게이트 무관 저장.
- [ ] 토큰 없음/불일치는 404/403.
- [ ] `docs/be/point/일지.md`에 경계 이탈 1줄이 남는다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- 편집 **1엔드포인트만**. 신규 포인트 생성·삭제·id 이동 금지. 공개 조회·publish.py·다른 도메인·FE 수정 금지. git commit/push 자동화 금지(파일만 쓴다). 새 의존 금지.

## 9. 검증 방법
- 임시 wiki 픽스처에 유효/무효 content PUT → 파일 diff·400/404·published 게이트 케이스, 원자적 쓰기(실패 시 원본 보존) 확인.

## 10. 참조
- ARCHITECTURE §1·§8(경계) · be/point 데이터.md · `repository.publish_errors`·`load_raw` · `app/admin.py` · 후속 fe/0005
