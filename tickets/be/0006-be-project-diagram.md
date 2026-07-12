---
id: 0006
title: be/project v4 — 아키텍처 도식(typst→SVG) 컴파일 + architectureDiagram 반환
branch: feat/be-project-diagram
base: main
domain: be/project
stage: MC
pattern: TS
status: ready
engine: codex
created: 2026-07-12
---

# [0006] be/project v4 — 아키텍처 도식(typst→SVG)

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md §v4-C](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
긴 `architecture` 텍스트를 보완할 **압축 아키텍처 도식**을 붙인다. 소스=typst 사이드카(사람 저작), 애셋=**빌드/발행 시 1회 컴파일**한 정적 SVG. 서빙은 SVG 경로만 반환하고 런타임 typst 접근 없음. 표지에 optional `architectureDiagram` 필드 추가.
- 근거: [be/project 데이터.md](../../docs/be/project/데이터.md) · [기능_도식컴파일](../../docs/be/project/기능_도식컴파일.md) · [기능_프로젝트인덱스조회](../../docs/be/project/기능_프로젝트인덱스조회.md) · [ARCHITECTURE §v4-C](../../docs/arch/ARCHITECTURE.md)
- 전제: 선행 티켓 0002(be/project) 위에 얹는 확장. fe 도식 임베드(fe/0003)가 이 반환을 소비한다.

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/project` (표지 데이터 소유 + 도식 애셋 생성) |
| 단계 | M(architectureDiagram 필드·SVG 애셋) + C(도식컴파일 유틸) |
| 가로지르는 도메인 | `fe/browse`(반환 SVG 임베드, 단방향) |
| 분류 근거 | 도식은 프로젝트 표지에 종속된 be/project 애셋 |

## 3. 구조 결정 (패턴 타협)
- 채택: **TS** — typst 1회 호출·파일 존재 판정. 도메인 불변식 없음(ARCHITECTURE §4·§v4-C).
- **컴파일러 = typst PyPI 패키지**(`import typst; typst.compile(...)`) — 발행/빌드 전용 의존, 별도 바이너리·CLI 없음(ARCHITECTURE §v4-C).
- **architectureDiagram 파생 = 파일 존재 규약(frontmatter 미변경):** `get_index`가 `wiki/<slug>/architecture.svg` 존재 시 그 상대경로, 없으면 `None`을 채운다. 도식컴파일은 순수 **생산자**(SVG 생성/스킵)로 두고, 표지 frontmatter를 되쓰지 않는다(왕복 제거).

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `backend/app/project/models.py` | `ProjectIndex` += `architecture_diagram: str \| None = None`(camelCase `architectureDiagram`) |
| 수정 | `backend/app/project/repository.py` | 표지 raw에 `architecture_diagram` 파생 추가 — `WIKI_ROOT/<slug>/architecture.svg` 존재하면 그 상대경로(예 `<slug>/architecture.svg`), 없으면 None |
| 수정 | `backend/app/project/service.py` | `get_index`가 `architecture_diagram`을 `ProjectIndex`에 전달(파생값 그대로) |
| 신규 | `scripts/compile_diagrams.py` | 도식컴파일 유틸 — 대상 프로젝트마다 `wiki/<slug>/architecture.typ` → `architecture.svg` 컴파일(1회). `.typ` 없으면 스킵. 실패 시 §6대로 사람에게 프롬프트 |
| 신규 | `backend/requirements-publish.txt` | 발행 전용 의존: `typst>=0.11`(서빙 런타임 무관 — 발행 안 하는 포크엔 불필요) |

## 5. 인터페이스·시그니처 (구체)
- `ProjectIndex.architecture_diagram: str | None` — SVG 상대경로(웹이 붙일 수 있는 형태, 정적 애셋 규약은 fe 티켓과 합치) 또는 None.
- `compile_diagrams.py`: 인자 없으면 전체, `<slug>` 주면 1개. 각 대상 `typst.compile("wiki/<slug>/architecture.typ", output="wiki/<slug>/architecture.svg", format="svg")`. 성공=SVG 갱신(덮어씀), `.typ` 부재=스킵(기존 SVG 있으면 손대지 않음).
- 컴파일 실패(typst 미설치·문법오류): stderr에 사유 + **대화형 프롬프트** "이 프로젝트 도식 비우고 진행할까요? [Y/n] (n=중단)". 기본(Y)=그 프로젝트 SVG를 만들지 않고 다음으로(=architectureDiagram None으로 노출). n=비영 종료(중단). 비대화(-y/파이프) 플래그면 기본=진행.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| `.typ` 소스 없음 | 스킵 → architectureDiagram None(도식 없이 텍스트만) | compile/repository |
| typst 미설치·문법오류 | 사람에게 프롬프트, 기본=비우고 진행 | compile |
| 재빌드 | 기존 `.svg` 덮어씀 | compile |
| SVG는 있고 `.typ` 없음 | SVG 유지(파생은 존재 기준 → 노출) | repository |
| 없는 slug | get_index None(기존과 동일) | service |

## 7. 수용 기준 — 결과문
- [ ] `.typ`가 있는 프로젝트에서 `compile_diagrams.py`가 `architecture.svg`를 생성/갱신한다.
- [ ] `get_index`가 SVG 존재 시 `architectureDiagram` 상대경로를, 없으면 `null`을 반환한다.
- [ ] 컴파일 실패 시 발행/빌드가 사람에게 묻고, 기본 선택으로 도식 없이 진행한다.
- [ ] 표지 6요소·카탈로그·302 등 기존 계약 불변(도식은 부가 필드).
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- be/point 수정 금지. 서빙 런타임에 typst 호출·의존 추가 금지(빌드타임만).
- 표지 frontmatter를 도식컴파일이 되쓰기 금지(파일 존재 규약으로 파생).
- fe 임베드·렌더 금지(fe/0003 소관 — 이 티켓은 SVG 생성 + 경로 반환까지).
- typst 문서 문법·도식 저작 자동화 금지(사람 저작).

## 9. 검증 방법
- 임시 wiki에 `architecture.typ` 둔 프로젝트/안 둔 프로젝트로 `compile_diagrams.py` 실행 → SVG 생성/스킵, `get_index` architectureDiagram 유/무 확인. 문법오류 소스로 실패 프롬프트 경로 확인(비대화 플래그).

## 10. 참조
- ARCHITECTURE §v4-C · be/project 일지 · 선행 0002 · 후속 fe/0003
