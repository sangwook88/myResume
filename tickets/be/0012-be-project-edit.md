---
id: 0012
title: be/project 관리자 편집 — 프로젝트 표지(index.md) 저장(쓰기) 엔드포인트
branch: feat/be-project-edit
base: main
domain: be/project
stage: C
pattern: TS
status: ready
engine: codex
created: 2026-07-14
---

# [0012] be/project 관리자 편집 — 프로젝트 표지(index.md) 저장(쓰기)

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
관리자 대시보드에서 **프로젝트 표지 내용(설명 포함)** 을 편집·저장할 수 있게 be/project에 관리자 전용 **쓰기** 엔드포인트를 추가한다. 편집 결과는 `wiki/<slug>/index.md` 파일에 반영된다. 대상 필드 = 표지 6요소(summary·role·period·teamSize·techStack·highlights) + architecture 개요(본문/frontmatter). **be/0008(be/point 편집)의 완전한 미러** — 같은 무손실 raw 마크다운 방식·같은 검증·같은 원자적 쓰기.

> ⚠️ **아키텍처 경계 이탈(이미 승인된 확장).** ARCHITECTURE §1·§8은 "저작=로컬 / 서빙=읽기전용"이었으나 be/0008·0009·0010·0011에서 관리자 전용 쓰기를 승인·도입했다. 이 티켓은 그 확장을 be/project 표지 편집으로 잇는다. `docs/be/project/일지.md`에 1줄 기록(구현 에이전트가 추가). ARCHITECTURE는 be/0011에서 이미 "관리자 쓰기 경계 확장"을 명시해 뒀으므로 추가 문구는 선택(있으면 1줄).

- 재사용 인증: `app/admin.py::require_admin`(CHAT_ADMIN_TOKEN + Bearer).
- 근거: [데이터.md](../../docs/be/project/데이터.md)(표지 필드·index.md 구조) · `backend/app/project/repository.py`(`load_raw`·`_split_frontmatter`·`save_diagram_svg` 원자적 쓰기·`WIKI_ROOT`·`_find_project_dir`) · `backend/app/project/service.py`(`get_index_admin`·`ProjectNotFoundError`) · **선례 `backend/app/point/repository.py`·`service.py`(be/0008 `path_of_id`·`save_markdown`·`update_point_admin`)**.

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/project` (프로젝트 표지 마크다운 파일 소유·파싱자) |
| 단계 | C (쓰기 기능) |
| 가로지르는 도메인 | 없음(로컬 파일 IO). fe/browse가 HTTP로 호출 |
| 분류 근거 | index.md를 소유·파싱하는 be/project가 쓰기도 책임(be/point가 포인트 쓰기를 책임지는 것과 동형) |

## 2b. 웨이브
- Wave 1(BE). 선행 없음(기존 admin·project repository/service 재사용). 후속 fe/0008이 소비.

## 3. 구조 결정 (패턴 타협)
- **편집 단위 = 전체 index.md 마크다운 텍스트(무손실).** be/0008과 동일 근거 — 구조화 필드로 쪼개 재직렬화하면 architecture 본문 산문·서식·주석이 유실된다 → 파일을 **원문 그대로** 받아 검증 후 저장(CMS raw 에디터 방식). 프로젝트 표지엔 **발행 status·게이트가 없다**(데이터.md §enum) → 게이트 검증 없음.
- **파일 존재 스캔만**(경로 조합 금지) — be/project는 이미 `_find_project_dir(slug)`로 실존 `wiki/<slug>/index.md`만 정확 일치로 찾는다(path traversal 방어). 신규 생성 안 함(없는 slug=404).
- 파일 쓰기는 **원자적**(같은 디렉토리 temp write → `os.replace`, `save_diagram_svg` 방식 계승).
- TS 유지(arch §4). 경계 이탈(쓰기)이라 일지 1줄.

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `backend/app/project/repository.py` | `index_path_of_slug(slug: str) -> Path | None`(`_find_project_dir` 재사용 → `index.md` 경로, 없으면 None) · `save_index_markdown(slug: str, text: str) -> None`(utf-8 원자적 쓰기, temp→`os.replace`; slug 없으면 `FileNotFoundError`) |
| 신규 | `backend/app/project/models.py` | `ProjectEdit(CamelModel)` 입력 DTO — `content: str`(전체 index.md 마크다운) |
| 신규 | `backend/app/project/service.py` | `get_raw_admin(slug: str) -> str | None`(index.md 원문 반환, 없으면 None) · `update_project_admin(slug: str, content: str) -> ProjectIndex`(검증 후 저장, 갱신 인덱스 반환) + 검증 예외(`InvalidProjectError(ValueError)`) |
| 수정 | `backend/app/project/router.py` | `GET /api/projects/admin/{slug}/raw`(require_admin) → 편집 프리필용 원문 마크다운; `PUT /api/projects/admin/{slug}`(require_admin) → 저장 후 갱신 ProjectIndex. **선언 순서**: 기존 `/admin/{slug}`(GET)·`/admin/{slug}/diagram`(PUT)와 공존 — `/{slug}` 계열보다 먼저 유지(관례) |
| 수정 | `docs/be/project/일지.md` | 「서빙 API에 프로젝트 표지 편집 쓰기 도입(경계 이탈, 오너 승인) — be/0008 미러」 1줄 |

## 5. 인터페이스·시그니처 (구체)
- `GET /api/projects/admin/{slug}/raw` → `{ "content": "<index.md 원문 마크다운>" }`(편집기 프리필). 404(없는 slug·인증 미설정)·403. 경로: 2세그먼트라 기존 `/admin/{slug}`·`/admin/{slug}/diagram`와 충돌 없음.
- `PUT /api/projects/admin/{slug}` body `{ "content": "<전체 index.md 마크다운>" }`
  - 200 → 갱신된 `ProjectIndex`(재파싱 + 포인트목록 재조립 = `get_index_admin(slug)` 결과)
  - 400 → 파싱 실패(frontmatter 없음/깨짐) / frontmatter `slug` ≠ URL `slug`(리네이밍 금지) / 빈 content
  - 404 → 없는 slug(신규 생성 안 함) · 인증 미설정
  - 403 → 토큰 불일치
- 검증 순서(service): ① content가 비지 않음 ② `repository._split_frontmatter(content)` 파싱 성공 ③ frontmatter의 `slug`가 있으면 URL slug와 일치(없으면 통과 — load_raw는 디렉토리명을 정본 slug로 씀; 불일치만 거부) → 위반 시 저장 안 하고 400. **status·발행 게이트 검증 없음**(프로젝트엔 status 없음).
- 저장: 검증 통과 시에만 `save_index_markdown`(원자적). 저장 후 `get_index_admin(slug)`로 재조회해 반환.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 없는 slug | 404, 새 파일 생성 안 함 | service/router |
| frontmatter slug 변경(리네이밍 시도) | 400, 파일 미변경(slug 이동은 이 경로로 금지) | service |
| 파싱 실패(깨진 frontmatter) | 400, 파일 미변경 | service |
| path traversal(`../`·절대경로 slug) | `_find_project_dir` 실존 스캔 매칭만 → 404 | repository |
| 빈 content | 400, 파일 미변경 | service |
| architecture를 본문↔frontmatter로 옮겨 저장 | 무손실 저장 — 재파싱이 `load_raw` 규칙대로 반영(둘 다 유효) | repository/service |
| techStack·highlights를 YAML 리스트로 편집 | 저장·재파싱 정상(`_as_list` 정규화) | repository |
| 동시 편집(2 관리자) | last-write-wins(v1, 락 없음) | — |
| 쓰기 실패(권한/디스크) | 500, 원자적 쓰기라 원본 보존 | repository |
| architecture.svg(도식) 사이드카 | 편집 대상 아님 — index.md만 저장, 도식은 be/0009 경로 유지(무영향) | — |

## 7. 수용 기준 — 결과문
- [ ] 유효 index.md 마크다운을 PUT → 파일이 갱신되고 갱신 ProjectIndex(표지 + 포인트목록)가 반환된다.
- [ ] 없는 slug는 404이고 새 파일이 생기지 않는다.
- [ ] slug 불일치·파싱 실패·빈 content는 400이고 파일이 안 바뀐다.
- [ ] 토큰 없음/불일치는 404/403.
- [ ] `GET .../admin/{slug}/raw`가 원문 마크다운을 준다(프리필).
- [ ] `docs/be/project/일지.md`에 경계 이탈 1줄이 남는다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- 편집 **1엔드포인트(+raw 프리필)만**. 신규 프로젝트 생성·삭제·slug 이동 금지. 도식 업로드(be/0009)·공개 조회·프로필(be/0011)·be/point·be/chat·FE 수정 금지. status/발행 게이트 도입 금지(프로젝트엔 status 없음). git commit/push 자동화 금지(파일만 쓴다). 새 의존 금지.

## 9. 검증 방법
- 임시 `WIKI_ROOT` 픽스처에 유효/무효 content PUT → 파일 diff·400/404·slug 불일치 케이스, raw GET 프리필, 원자적 쓰기(실패 시 원본 보존) 확인. 저장 후 반환 ProjectIndex가 표지+포인트목록을 담는지 확인.

## 10. 참조
- ARCHITECTURE §1·§8(경계) · be/project 데이터.md · be/0008(be/point 편집, 미러 원본)·`point/repository.save_markdown`·`point/service.update_point_admin` · `project/repository.save_diagram_svg`(원자적 쓰기)·`_find_project_dir`·`_split_frontmatter` · `app/admin.py` · 후속 fe/0008
