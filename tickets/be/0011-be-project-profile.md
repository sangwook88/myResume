---
id: 0011
title: be/project 사이트 프로필 — 랜딩 자기소개(사진·이름·연락처) 조회·편집·사진 업로드
branch: feat/be-project-profile
base: main
domain: be/project
stage: C
pattern: TS
status: ready
engine: codex
created: 2026-07-14
---

# [0011] be/project 사이트 프로필 — 랜딩 자기소개

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
랜딩 최상단에 **본인 소개(사진·이름·GitHub·전화·이메일·짧은 자기소개)** 를 보여주려 한다(기존 "문제보다 판단이…" 태그라인 히어로 제거 → 프로필 헤더로 대체, 렌더·제거는 후속 **fe/0007**). 이를 위해 **사이트 프로필**(사이트당 1개, 프로젝트도 포인트도 아닌 사이트 레벨 콘텐츠)의 **공개 조회 + 관리자 편집 + 사진 업로드/서빙** 엔드포인트를 추가한다.

프로필은 **새 도메인을 만들지 않고 be/project에 흡수**한다 — be/project는 이미 랜딩용 콘텐츠(카탈로그·표지·아키텍처 SVG 업로드/서빙)를 소유·서빙하는 도메인이고, `require_admin`·상한 스트리밍 읽기(`_read_body_limited`)·multipart 파싱(`_diagram_payload`)·원자적 파일 쓰기(`save_diagram_svg`)를 이미 갖고 있어 그대로 재사용한다. (HOME의 "새 도메인 경계는 decompose로만" 원칙을 지켜 도메인 수를 늘리지 않는다.)

> ⚠️ **아키텍처 경계 이탈(명시).** be/0008·0009·0010과 같은 취지 — 서빙 API에 **쓰기**(프로필 편집·사진 저장)를 도입한다(§1·§8 "저작=로컬 / 서빙=읽기전용" 밖). 오너의 의도된 확장으로 진행하되 **ARCHITECTURE 델타 반영 + `docs/be/project/일지.md` 1줄 기록 + `docs/HOME.md` 1줄**이 필요하다(구현 에이전트가 추가).

- 재사용 인증: `app/admin.py::require_admin`(CHAT_ADMIN_TOKEN + Bearer).
- 근거: `backend/app/project/router.py`(`_read_body_limited`·`_diagram_payload` multipart·SVG 서빙 방어 = 단일 세그먼트 가드) · `backend/app/project/repository.py`(`WIKI_ROOT`·`save_diagram_svg` 원자적 쓰기·`_split_frontmatter`) · `backend/app/project/models.py`(`CamelModel` — `alias_generator=to_camel`) · be/0010(래스터 이미지 화이트리스트·서버생성 파일명 선례).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/project` (랜딩·사이트 레벨 콘텐츠의 소유·파싱·서빙자) |
| 단계 | C (조회 + 쓰기 기능 + 정적 서빙) |
| 가로지르는 도메인 | `be/point` — 스캔 제외 1줄(아래 §4). fe/browse가 HTTP로 소비(fe/0007) |
| 분류 근거 | 프로필은 프로젝트/포인트가 아닌 사이트 레벨 콘텐츠. wiki 콘텐츠를 서빙·업로드하는 be/project가 프로필도 소유·서빙하는 게 정합(새 도메인 회피) |

## 2b. 웨이브
- Wave 1(BE). 선행 없음(기존 admin·project repository/router 재사용). 후속 fe/0007이 소비.

## 3. 구조 결정 (패턴 타협)
- **저장 위치 = `wiki/profile.md`(최상위, 프로젝트 디렉토리 아님).** frontmatter(사진·이름·연락처) + 본문(자기소개 마크다운). git 버전관리 콘텐츠 트리에 그대로 편입(다른 콘텐츠와 동일 결).
  - **be/project `iter_raw()`**는 `WIKI_ROOT.glob("*/index.md")`(한 단계 아래 index.md만) → `wiki/profile.md`는 매칭 안 됨(카탈로그에 안 뜸, 무변).
  - **be/point `iter_raw()`**는 `WIKI_ROOT.rglob("*.md")`로 재귀 스캔하며 `index.md`·`*.code.md`만 제외 → `wiki/profile.md`가 **포인트로 오인**된다. 그래서 be/point 스캔에 `profile.md` 제외 1줄을 추가한다(기존 index.md 제외와 동일 관례, 사이트 프로필은 be/project 소유임을 주석).
- **사진 저장 = `wiki/profile/<서버생성-파일명>.<ext>`(프로필 전용 애셋 디렉토리).** 이미지 파일이라 `.md` 스캐너와 무관. `wiki/profile/`엔 index.md가 없어 be/project 카탈로그에도 안 뜬다. 파일명은 서버가 생성(클라 파일명 불신 — traversal·충돌 차단), ext는 **content-type 화이트리스트(png·jpeg·gif·webp)** 에서만. be/0010과 동일 posture.
- **편집 단위 = 구조화 DTO(JSON)** — 프로필은 고정 스키마의 작은 필드 집합이고 표·숨은 섹션이 없어, be/0008의 "무손실 raw 마크다운" 방식이 불필요하다. `PUT`은 구조화 `ProfileEdit`를 받아 서버가 `wiki/profile.md`로 직렬화한다(사진 URL은 별도 업로드가 채운 값을 그대로 저장). **발행 게이트 없음**(프로필은 항상 노출, draft 개념 없음).
- **서빙은 공개**(프로필은 랜딩 공개 콘텐츠). 편집·업로드만 admin 게이트. architecture.svg·point assets와 동일 posture.
- **파일 부재 허용** — `wiki/profile.md`가 아직 없으면 `GET`은 **빈 기본 프로필**(모든 문자열 "", photo=null)을 반환한다(랜딩·에디터가 빈 상태로 안전 렌더). 최초 `PUT`이 파일을 생성한다.
- TS 유지(arch §4). 경계 이탈(쓰기)이라 §1 경고 + 일지 1줄.

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `backend/app/project/profile.py` | 프로필 repository+service(작은 모듈). `WIKI_ROOT`(project.repository 재사용) 기준: `load_profile() -> dict`(`wiki/profile.md` 파싱, 없으면 빈 기본값) · `save_profile(edit: dict) -> dict`(frontmatter+본문 직렬화 후 원자적 쓰기, 갱신 프로필 반환) · `save_profile_image(data: bytes, content_type: str) -> dict`(검증·서버생성 파일명으로 `wiki/profile/`에 원자적 저장, `{"url","filename"}` 반환) · `profile_image_path(filename: str) -> Path | None`(단일 세그먼트 가드, 실존만) · `MAX_PROFILE_IMAGE_BYTES`·`_ALLOWED_IMAGE_TYPES`·`InvalidProfileImageError(ValueError)`. 원자적 쓰기는 `save_diagram_svg`의 temp→`os.replace` 패턴 계승 |
| 신규 | `backend/app/project/models.py` | `Profile(CamelModel)`(조회 DTO) + `ProfileEdit(CamelModel)`(입력 DTO). 필드 §5 |
| 신규 | `backend/app/project/profile_router.py` | `APIRouter(prefix="/api/profile", tags=["project"])` — `GET ""`(공개) · `PUT "/admin"`(require_admin, body ProfileEdit) · `POST "/admin/image"`(require_admin, multipart `file` 또는 raw image 본문) · `GET "/assets/{filename}"`(공개, path-safe FileResponse). multipart 파싱·상한은 `project/router.py::_read_body_limited`·`_diagram_payload` 로직을 프로필 이미지용으로 재사용(중복 최소화 위해 헬퍼를 공유 가능한 위치로 두거나 복제 — 새 의존 금지) |
| 수정 | `backend/app/main.py` | `from app.project.profile_router import router as profile_router` + `app.include_router(profile_router)` |
| 수정 | `backend/app/point/repository.py` | `iter_raw()` 재귀 스캔에 `if path.name == "profile.md": continue` 1줄 추가(주석: 사이트 프로필 = be/project 소유, index.md 제외와 동일 관례) |
| 수정 | `docs/arch/ARCHITECTURE.md` | 사이트 프로필 델타 1블록(저장 `wiki/profile.md` + 사진 `wiki/profile/` + 공개 조회/서빙·admin 쓰기 posture, be/project 흡수 근거) |
| 수정 | `docs/be/project/일지.md` | 「서빙 API에 사이트 프로필 조회·편집·사진 업로드 도입(경계 이탈, 오너 승인) — be/point 스캔 profile.md 제외」 1줄 |
| 수정 | `docs/HOME.md` | be/project v4 확장 행 또는 참조 그래프 근처에 「사이트 프로필(wiki/profile.md) 소유·서빙」 1줄 |

## 5. 인터페이스·시그니처 (구체)
- **DTO(키 camelCase)**
  - `Profile`: `name:str`, `headline:str`(한 줄 태그라인, 선택), `photo:str|None`(사진 애셋 URL path 또는 null), `github:str`, `phone:str`, `email:str`, `intro:str`(자기소개 마크다운). 모든 문자열 필드 기본 ""(빈 값 허용).
  - `ProfileEdit`: 같은 필드(`name,headline,photo,github,phone,email,intro`). photo는 업로드가 반환한 URL path(`/api/profile/assets/<fn>`) 또는 "" — 서버는 값 그대로 저장(존재 검증 안 함, v1).
- **`wiki/profile.md` 직렬화 형식**
  ```
  ---
  name: ...
  headline: ...
  photo: /api/profile/assets/<fn>      # 비면 키 생략 또는 빈 문자열
  github: https://github.com/...
  phone: 010-...
  email: a@b.com
  ---
  <intro 마크다운 본문>
  ```
  파싱은 `repository._split_frontmatter` 재사용(frontmatter dict + body). body가 `intro`.
- `GET /api/profile` → `Profile`(200). 파일 없으면 빈 기본 프로필 200(리다이렉트·404 아님 — 항상 조회 가능).
- `PUT /api/profile/admin` body `ProfileEdit` → 저장 후 갱신 `Profile`(200). 403(토큰 불일치)·404(인증 미설정). 빈 필드 저장 허용(발행 게이트 없음).
- `POST /api/profile/admin/image`
  - 입력: 이미지 바이트(multipart `file` 또는 `Content-Type: image/png|jpeg|gif|webp` raw 본문).
  - 200 → `{ "url": "/api/profile/assets/<filename>", "filename": "<filename>" }`.
  - 400 → 빈 본문 / 비허용 타입(래스터 4종 외) / 크기 초과(`MAX_PROFILE_IMAGE_BYTES`, 예 5 MiB) / multipart 해석 실패.
  - 404 → 인증 미설정. 403 → 토큰 불일치.
- `GET /api/profile/assets/{filename}` — `filename`은 단일 세그먼트만(`/`·`\`·`.`·`..` 포함 시 404, architecture.svg 서빙과 동일 방어). `WIKI_ROOT/profile/<filename>` 실존 시 `FileResponse`(content-type 확장자 추론), 아니면 404.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| `wiki/profile.md` 부재 | GET → 빈 기본 프로필 200(랜딩 안전 렌더) | profile.load |
| 최초 PUT(파일 없음) | 파일 생성 후 갱신 프로필 반환 | profile.save |
| 빈 필드만 저장 | 허용(게이트 없음), 빈 값 저장 | service |
| frontmatter 깨진 기존 파일 | GET가 파싱 실패 시 500(원본 보존), PUT는 덮어쓰므로 복구 가능 | repository |
| `profile.md`가 be/point 포인트로 오인 | iter_raw 제외 1줄로 차단(포인트 목록·추천·챗봇 코퍼스에 안 샘) | point.repository |
| 사진 비허용 타입(svg·pdf·임의 바이트) | 400(래스터 4종만) | profile.image |
| 사진 크기 초과 | 400(스트리밍 중 상한 중단) | router/service |
| multipart file 필드 부재/복수 | 400(정확히 1개) | router |
| 악성 파일명(`../`) 업로드 | 무시 — 서버가 파일명 생성 | profile.image |
| 서빙 path traversal(`filename`에 `/`·`..`) | 404(단일 세그먼트 방어, 다른 wiki 파일 비노출) | router |
| 없는 사진 서빙 요청 | 404 | router |
| 동시 편집(2 관리자) | last-write-wins(v1, 락 없음) | — |
| 쓰기 실패(권한/디스크) | 500, 원자적 쓰기라 원본 보존 | repository |

## 7. 수용 기준 — 결과문
- [ ] `GET /api/profile`가 프로필을 준다(파일 없으면 빈 기본값 200, 리다이렉트 아님).
- [ ] `PUT /api/profile/admin`(유효 토큰)로 필드를 저장하면 `wiki/profile.md`가 생성/갱신되고 갱신 Profile이 반환된다. 토큰 없음/불일치는 404/403.
- [ ] `POST /api/profile/admin/image`에 유효 이미지를 올리면 `wiki/profile/`에 파일이 생기고 `{url, filename}`이 반환되며, 그 url로 `GET /api/profile/assets/<fn>`가 이미지를 준다(공개).
- [ ] 비허용 타입·과대·인증 실패는 각각 400/400/403(파일 안 바뀜). 서빙 `../`·다세그먼트 filename은 404.
- [ ] `wiki/profile.md`가 포인트 목록·추천·챗봇 코퍼스·프로젝트 카탈로그 어디에도 안 나타난다(be/point 제외 + be/project glob 무매칭).
- [ ] ARCHITECTURE 델타 + `docs/be/project/일지.md` 1줄 + `docs/HOME.md` 1줄이 남는다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- **프로필 조회 1 + 편집 1 + 사진 업로드 1 + 사진 서빙 1 라우트 + 문서 갱신만**. 프로필 **복수 지원·다중 사진·이미지 삭제/리스트/리사이즈/썸네일** 금지. SVG/래스터 외 타입 금지. 새 도메인(`backend/app/profile/`) 신설 금지 — be/project에 흡수. be/point는 **스캔 제외 1줄만**(다른 로직 손대지 말 것). 기존 project 공개 조회·SVG 업로드·publish.py·be/chat·FE 수정 금지. git 자동 커밋 금지(파일만 쓴다). **새 런타임 의존 금지**(multipart는 stdlib `email.parser` — be/0009·0010 방식 계승).

## 9. 검증 방법
- 임시 `WIKI_ROOT` 픽스처: 파일 없이 GET→빈 기본값, PUT→파일 생성·재GET 반영, 사진 유효/무효 POST→`wiki/profile/` 파일·`{url}`·400/404/403, 서빙 GET 바이트·traversal 404. be/point `iter_raw`에 `wiki/profile.md` 픽스처를 두고 포인트 목록에 안 뜸 확인. 문서 diff 확인.

## 10. 참조
- ARCHITECTURE §1·§8(경계)·§v4-C(SVG 업로드/서빙 선례) · `app/project/router.py`(`_read_body_limited`·`_diagram_payload`·단일 세그먼트 가드) · `app/project/repository.py`(`save_diagram_svg` 원자적 쓰기·`_split_frontmatter`·`WIKI_ROOT`) · `app/point/repository.py`(`iter_raw` 제외 관례) · `app/admin.py` · be/0008·0010 · 후속 fe/0007
