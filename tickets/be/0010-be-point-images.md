---
id: 0010
title: be/point 관리자 이미지 업로드·서빙 — 단락 첨부 사진 저장 + 섹션 문서 갱신
branch: feat/be-point-images
base: main
domain: be/point
stage: C
pattern: TS
status: ready
engine: codex
created: 2026-07-14
---

# [0010] be/point 관리자 이미지 업로드·서빙 — 단락 첨부 사진

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
관리자가 포인트를 **단락(섹션)별로 편집**할 때 각 단락에 **사진을 첨부**할 수 있게, be/point에 관리자 전용 **이미지 업로드 쓰기** 엔드포인트와 **공개 이미지 서빙** 라우트를 추가한다. 업로드된 이미지는 `wiki/<project>/assets/<파일명>`에 저장되고, 섹션 본문 마크다운에 `![](<url>)`로 삽입된다(삽입·렌더는 후속 fe/0006). 콘텐츠 모델 정합 — 이미지도 git 버전관리 마크다운 콘텐츠의 일부(사람이 나중에 수동 커밋).

부수로: **섹션 구조 문서 갱신.** 현재 페이지는 핵심 4섹션(문제·고려한옵션·결정과근거·결과)만 노출하고 배경·실행·회고는 접혀 챗봇 심화 답변용으로만 쓰이는데(`PointView.tsx:29-38`), `docs/be/point/데이터.md`는 여전히 "9섹션"으로 적혀 있다 → **"핵심 4 + 심화 3(접힘) + 제목·요약 + Evidence"**로 갱신한다(코드 동작 변화 없음, 스펙 정합만).

> ⚠️ **아키텍처 경계 이탈(명시).** be/0008·0009과 같은 취지 — 서빙 API에 **쓰기**(이미지 저장)를 도입한다(§1·§8/저작=로컬 원칙 밖). 오너 승인 확장으로 진행하되 **ARCHITECTURE 델타 반영 + `docs/be/point/일지.md` 1줄 기록** 필요(구현 에이전트가 일지 1줄 추가).

- 재사용 인증: `app/admin.py::require_admin`(CHAT_ADMIN_TOKEN + Bearer).
- 근거: [데이터.md](../../docs/be/point/데이터.md) · `backend/app/point/repository.py`(WIKI_ROOT·원자적 쓰기 `save_markdown`) · **선례 `backend/app/project/router.py`**(SVG 도식 업로드 = 표준 라이브러리 multipart 파싱 + 상한 읽기, be/0009).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/point` (포인트 문서·부속 애셋 소유·파싱자) |
| 단계 | C (쓰기 기능 + 정적 서빙) |
| 가로지르는 도메인 | 없음(로컬 파일 IO). fe/browse가 HTTP 업로드 + `<img>`로 공개 서빙 소비 |
| 분류 근거 | 포인트 파일이 있는 `wiki/<project>/`를 소유·서빙하는 be/point가 부속 이미지 쓰기·서빙도 책임 |

## 2b. 웨이브
- Wave 1(BE). 선행 없음(기존 admin·repository 재사용). 후속 fe/0006이 소비.

## 3. 구조 결정 (패턴 타협)
- **저장 위치 = `wiki/<project>/assets/<파일명>`** — 포인트 문서와 같은 콘텐츠 트리(git 버전관리). `iter_raw()`는 `*.md`만 스캔하므로 이미지 파일은 포인트로 오인되지 않는다(스캔 무영향).
- **파일명은 서버가 생성**(클라 파일명 불신 — path traversal·충돌 차단). 예: `<타임스탬프>-<짧은난수>.<ext>`. ext는 **content-type 화이트리스트**에서만 결정.
- **1차 지원 = 래스터 이미지만**(png·jpeg·gif·webp). SVG는 XSS·다른 결(도식은 be/0009가 담당)이라 **범위 밖**.
- 저장은 **원자적**(temp write→`os.replace`, `save_markdown` 방식 계승). assets 디렉토리는 없으면 생성.
- **multipart 파싱은 be/0009와 동일하게 표준 라이브러리**(`email.parser`)로 — SVG 업로드가 새 런타임 의존(python-multipart)을 피한 선례를 그대로 따라 **새 의존 금지**. 또는 raw 본문(`Content-Type: image/png` 등) 직접 수용. 상한 초과는 스트리밍 중 400 중단(`_read_body_limited` 패턴).
- **서빙은 공개**(published 포인트가 공개 페이지에 이미지 렌더 → 인증 불가). 업로드만 admin 게이트. architecture.svg 서빙과 동일 posture(공개 서빙·admin 쓰기). draft 포인트 이미지도 URL을 알면 접근 가능하나 파일명이 서버생성 난수라 사실상 은닉 — v1 수용(§6 명시).
- TS 유지(arch §4). 경계 이탈(쓰기)이라 §1 경고 + 일지 1줄.

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `backend/app/point/repository.py` | `assets_dir_for_project(project: str) -> Path`(`WIKI_ROOT/<project>/assets`, project는 단일 세그먼트 검증) · `save_image(project: str, ext: str, data: bytes) -> str`(assets dir 보장 + 서버생성 유니크 파일명으로 원자적 쓰기, 파일명 반환) · `image_path(project: str, filename: str) -> Path | None`(경로 탈출 차단, 실존 파일만 반환) |
| 신규 | `backend/app/point/service.py` | `MAX_IMAGE_BYTES`·`_ALLOWED_IMAGE_TYPES`(content-type→ext 맵) 상수 · `save_point_image_admin(point_id: str, data: bytes, content_type: str) -> dict`(point_id→project 해석, 검증, 저장, `{"url": "/api/points/assets/<project>/<filename>", "markdown": "![](<url>)", "filename": <filename>}` 반환) · `InvalidImageError(ValueError)` · point 없으면 `PointNotFoundError` |
| 수정 | `backend/app/point/router.py` | `POST /api/points/admin/{point_id}/images`(require_admin, multipart `file` 또는 raw image 본문) → 업로드 결과 dict · `GET /api/points/assets/{project}/{filename}`(공개, path-safe FileResponse). **선언 순서**: 두 라우트 모두 `GET /{point_id}`(단건, 1세그먼트)보다 **먼저** 선언(고정 경로 의도 보존; `/admin/{id}/images`·`/assets/{p}/{f}`는 세그먼트 수가 달라 충돌은 없으나 관례 준수) |
| 수정 | `docs/be/point/데이터.md` | 「본문 — 9섹션」 표를 **핵심 4(문제·고려한옵션·결정과근거·결과) + 심화 3(배경·실행·회고 — 페이지 접힘, be/chat 심화 답변용) + 제목·요약 + Evidence**로 갱신. 섹션 본문에 `![](url)` 인라인 이미지 허용 1줄 추가 |
| 수정 | `docs/be/point/일지.md` | 「서빙 API에 이미지 업로드 쓰기 도입(경계 이탈, 오너 승인) + 섹션 문서 9→핵심4+심화3 정합」 1줄 |

## 5. 인터페이스·시그니처 (구체)
- `POST /api/points/admin/{point_id}/images`
  - 입력: 이미지 바이트(multipart `file` 또는 `Content-Type: image/png|jpeg|gif|webp` raw 본문).
  - 200 → `{ "url": "/api/points/assets/<project>/<filename>", "markdown": "![](<url>)", "filename": "<filename>" }`(camelCase 키는 이미 소문자라 무변).
  - 400 → 빈 본문 / 허용 안 되는 타입(래스터 4종 외) / 크기 초과 / multipart 해석 실패.
  - 404 → 없는 point_id(→project 미해석) · 인증 미설정.
  - 403 → 토큰 불일치.
- `GET /api/points/assets/{project}/{filename}`
  - `project`·`filename`은 각각 단일 세그먼트만(`/`·`\`·`.`·`..` 포함 시 404) — architecture.svg 서빙(`app/project/router.py:112-124`)과 동일 방어.
  - `WIKI_ROOT/<project>/assets/<filename>` 실존 시 `FileResponse`(content-type은 확장자로 추론), 아니면 404.
- 검증 순서(service): ① `point_id`로 실존 포인트 조회(`repository.find_raw_by_id`) → 없으면 404, project 확보 ② content-type 화이트리스트 매칭(→ext) 아니면 400 ③ 크기 ≤ `MAX_IMAGE_BYTES`(예 5 MiB — 구현 튜닝) 아니면 400 ④ 통과 시 `save_image`.
- 저장: `save_image`가 assets dir 없으면 생성 후 서버생성 파일명으로 원자적 쓰기(temp→replace).

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 없는 point_id | 404, 파일 안 씀 | service |
| 빈 본문/0바이트 | 400 | service/router |
| 비허용 타입(svg·pdf·임의 바이트) | 400(래스터 4종만) | service |
| 크기 초과 | 400(스트리밍 중 상한 중단) | router/service |
| multipart file 필드 부재/복수 | 400(정확히 1개) | router |
| 클라가 보낸 악성 파일명(`../`) | 무시 — 서버가 파일명 생성 | repository |
| 서빙 path traversal(`project`·`filename`에 `/`·`..`) | 404(단일 세그먼트 방어) | router |
| 같은 포인트 다중 업로드 | 파일명 유니크라 공존(덮어쓰기 없음) | repository |
| 없는 이미지 서빙 요청 | 404 | router |
| draft 포인트 이미지 공개 접근 | 접근 가능하나 파일명 난수로 은닉(v1 수용, architecture.svg와 동일 posture) | — |
| 쓰기 실패(권한/디스크) | 500, 원자적 쓰기라 부분파일 없음 | repository |

## 7. 수용 기준 — 결과문
- [ ] 유효 이미지를 POST하면 `wiki/<project>/assets/`에 파일이 생기고 `{url, markdown, filename}`이 반환된다.
- [ ] 반환된 `url`로 `GET /api/points/assets/<project>/<filename>` 하면 그 이미지가 온다(공개, 인증 불필요).
- [ ] 없는 point_id·비허용 타입·과대·인증 실패는 각각 404/400/400/403(파일 안 바뀜).
- [ ] 서빙 라우트에 `../`·다세그먼트 project/filename은 404(다른 wiki 파일 비노출).
- [ ] `docs/be/point/데이터.md`가 핵심4+심화3 구조로 갱신되고, `일지.md`에 경계 이탈 1줄이 남는다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- **이미지 업로드 1엔드포인트 + 서빙 1라우트 + 문서 갱신만**. 이미지 삭제·리스트·리사이즈·썸네일 금지. SVG/래스터 외 타입·래스터 외 서빙 금지. 마크다운 본문에 `![]()` 삽입(=fe/0006)·PointView 렌더 변경 금지(FE 몫). 편집 저장 엔드포인트(be/0008) 변경 금지. 다른 도메인·FE 수정 금지. git 자동 커밋 금지(파일만 쓴다). 이미지 처리용 외 **새 의존 금지**(multipart는 stdlib로 — be/0009 방식 계승).

## 9. 검증 방법
- 임시 wiki 픽스처에 유효/무효 이미지 POST → assets 파일 생성·`{url,markdown}`·400/404/403 케이스, 서빙 GET가 그 바이트 반환·path traversal 404, 원자적 쓰기(실패 시 부분파일 없음) 확인. 데이터.md·일지.md diff 확인.

## 10. 참조
- ARCHITECTURE §1·§8(경계) · 데이터.md(섹션 구조) · `app/project/router.py`(be/0009 SVG 업로드·서빙 선례) · `repository.save_markdown`(원자적 쓰기)·`WIKI_ROOT` · `app/admin.py` · 후속 fe/0006
