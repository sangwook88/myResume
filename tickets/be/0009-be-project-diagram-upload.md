---
id: 0009
title: be/project 관리자 도식 추가 — 아키텍처 도식(SVG) 업로드(쓰기)
branch: feat/be-project-diagram-upload
base: main
domain: be/project
stage: C
pattern: TS
status: ready
engine: codex
created: 2026-07-13
---

# [0009] be/project 관리자 도식 추가 — 아키텍처 도식 업로드(쓰기)

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md §v4-C](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
관리자 대시보드에서 프로젝트 **아키텍처 도식 그림을 추가/교체**할 수 있게, be/project에 관리자 전용 **쓰기** 엔드포인트를 추가한다. 업로드된 SVG를 `wiki/<project>/architecture.svg`에 저장하면 **기존 서빙 경로가 그대로 잡는다**(`GET /api/projects/{slug}/architecture.svg` + `repository`가 파일 존재 시 `architectureDiagram` URL 자동 세팅 — `app/project/repository.py:60-63`, `router.py:24`).

> ⚠️ **아키텍처 경계 이탈(명시).** be/0008과 같은 취지 — 서빙 API에 **쓰기**를 도입한다(§1·§8/저작=로컬 원칙 밖). 오너 승인 확장으로 진행하되 승인 시 ARCHITECTURE 델타 + `docs/be/project/일지.md` 1줄 기록.
> 추가로: ARCHITECTURE §v4-C는 **"서빙 시 typst 무접근(도식은 빌드타임 컴파일)"**을 확정했다. 그래서 **1차 지원 = 완성 SVG 업로드**(런타임 typst 불필요). typst 소스 업로드→컴파일은 런타임 typst 의존이 필요해 **선택·별도 갈림길**로 둔다(기본은 SVG 업로드).

- 재사용 인증: `app/admin.py::require_admin`.
- 근거: [기능_도식컴파일](../../docs/be/project/기능_도식컴파일.md) · [데이터.md](../../docs/be/project/데이터.md)#아키텍처-도식.

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/project` (표지·도식 애셋 소유자) |
| 단계 | C (쓰기 기능) |
| 가로지르는 도메인 | 없음(로컬 파일 IO). fe/browse가 HTTP 호출 + 기존 SVG 서빙 소비 |
| 분류 근거 | 도식 애셋(`architecture.svg`)을 소유·서빙하는 be/project가 쓰기도 책임 |

## 3. 구조 결정 (패턴 타협)
- **1차 = 완성 SVG 업로드** → `wiki/<slug>/architecture.svg` 원자적 저장. 서빙·`architectureDiagram` 감지는 **기존 로직 그대로**(신규 서빙 코드 없음).
- **갈림길(사람 확정 필요)**: typst 소스 업로드→서버 컴파일 지원 여부. (A) 안 함 — SVG만(권장, §v4-C 정합) / (B) `architecture.typ` 저장 + `typst.compile` 런타임 호출(런타임 의존·§v4-C 이탈). **기본=A**, B는 오너가 명시 승인 시만.
- 래스터(PNG/JPG)는 현재 서빙이 `.svg` 전용이라 **범위 밖**(지원하려면 서빙 라우트 신설 — 별도 티켓).
- TS 유지. 경계 이탈(쓰기)이라 §1 경고 + 일지 1줄.

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 신규 | `backend/app/project/repository.py` | `save_diagram_svg(slug: str, svg_bytes: bytes) -> None`(실존 프로젝트 dir 확인 후 `architecture.svg` 원자적 쓰기), `delete_diagram(slug)`(선택 — 도식 제거) |
| 신규 | `backend/app/project/service.py` | `set_diagram_admin(slug, svg: bytes) -> ProjectIndex`(검증·저장 후 갱신 인덱스 반환) |
| 수정 | `backend/app/project/router.py` | `PUT /api/projects/admin/{slug}/diagram`(require_admin, multipart 파일 또는 `image/svg+xml` 본문) · (선택) `DELETE /api/projects/admin/{slug}/diagram`. `/{slug}/architecture.svg`·`/{slug}` 등 기존 라우트와 경로 충돌 없게 선언 순서 주의 |
| 수정 | `docs/be/project/일지.md` | 「서빙 API에 도식 업로드 쓰기 도입(경계 이탈, 오너 승인)」 1줄 |

## 5. 인터페이스·시그니처 (구체)
- `PUT /api/projects/admin/{slug}/diagram`
  - 입력: SVG 바이트(multipart `file` 또는 `Content-Type: image/svg+xml` raw 본문).
  - 200 → 갱신된 `ProjectIndex`(`architectureDiagram`이 이제 채워짐) | 400(빈/비-SVG/과대) | 404(없는 slug·인증 미설정) | 403(토큰 불일치).
- 검증: ① slug가 실존 프로젝트 디렉토리인가(`wiki/<slug>/index.md` 존재) ② 본문이 SVG인가(루트 `<svg` 태그 시작·XML 파싱 성공) ③ 크기 상한(예 2MB — 구현 튜닝) 이내.
- 저장: 통과 시 `architecture.svg` 원자적 쓰기(temp→replace). 이후 `get_index_admin(slug)`(be/0007) 또는 기존 인덱스 조회로 재조회 반환.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| 없는 slug | 404, 파일 안 씀 | service |
| 빈 본문/0바이트 | 400 | service |
| 비-SVG(PNG·임의 바이트) | 400(1차는 SVG만) | service |
| 크기 초과 | 400 | service/router |
| 악성 SVG(script/onload) | fe는 `<img src>`로 임베드해 스크립트 미실행(ArchitectureDiagram) — 서버는 저장, XSS 완화는 img 렌더에 의존. (선택) 저장 전 `<script>`/이벤트 핸들러 스트립 | fe 렌더 + (선택)service |
| 기존 도식 있음 | 덮어씀(재빌드=덮어쓰기 규칙 계승) | repository |
| path traversal slug(`../`) | 실존 dir 매칭만 → 404 | repository |
| 동시 업로드 | last-write-wins | — |

## 7. 수용 기준 — 결과문
- [ ] 유효 SVG를 PUT하면 `architecture.svg`가 생기고, 그 프로젝트 인덱스 `architectureDiagram`이 채워져 반환된다.
- [ ] 이후 공개 `GET /api/projects/{slug}`·`/architecture.svg`가 새 도식을 반환한다(기존 서빙 그대로).
- [ ] 없는 slug·비-SVG·과대·인증 실패는 각각 404/400/400/403(파일 안 바뀜).
- [ ] `docs/be/project/일지.md`에 경계 이탈 1줄이 남는다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- **SVG 저장 1엔드포인트(+선택 DELETE)만**. 래스터 서빙·typst 런타임 컴파일(갈림길 B 미승인 시)·새 서빙 라우트 금지. 기존 도식 서빙/컴파일(도식컴파일) 로직 변경 금지. 다른 도메인·FE 수정 금지. git 자동 커밋 금지. SVG 업로드용 외 새 의존 금지.

## 9. 검증 방법
- 임시 wiki 픽스처에 유효/무효 SVG PUT → `architecture.svg` diff·`architectureDiagram` 채워짐·400/404 케이스, 기존 공개 서빙이 새 도식 반환 확인.

## 10. 참조
- ARCHITECTURE §v4-C(빌드타임 도식·서빙 typst 무접근) · 기능_도식컴파일 · `app/project/repository.py:60-63`·`router.py:24`(기존 서빙) · `app/admin.py` · 후속 fe/0005
