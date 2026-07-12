---
id: 0003
title: fe/browse v4 — 프로젝트 인덱스 아키텍처 도식(SVG) 임베드
branch: feat/fe-browse-diagram
base: main
domain: fe/browse
stage: V
pattern:
status: ready
engine: codex
created: 2026-07-12
---

# [0003] fe/browse v4 — 아키텍처 도식(SVG) 임베드

> 구현 에이전트에게: **이 티켓에 적힌 것만 구현한다.** 규약 SoT = [ARCHITECTURE.md §v4-C](../../docs/arch/ARCHITECTURE.md). 모호하면 멈추고 질문. 「범위 경계」 밖 파일 금지.

## 1. 배경·목표
프로젝트 인덱스 화면에서 `architectureDiagram`(be/project가 반환하는 컴파일된 SVG)이 있으면 긴 `architecture` 텍스트 위/옆에 **압축 도식을 임베드**한다. 없으면 기존처럼 텍스트만(하위호환).
- 근거: [요소/프로젝트-인덱스](../../docs/fe/browse/요소/프로젝트-인덱스.md) · [ARCHITECTURE §v4-C](../../docs/arch/ARCHITECTURE.md)
- 전제: **티켓 be/0006 먼저**(`architectureDiagram` 반환 + SVG 애셋).

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `fe/browse` (프로젝트 인덱스 표현) |
| 단계 | V |
| 가로지르는 도메인 | `be/project`(HTTP, architectureDiagram 소비) |
| 분류 근거 | 도식 배치·렌더는 FE, SVG 생성·경로는 BE |

## 3. 구조 결정 (패턴 타협)
- FE = 플로우+V, 패턴 해당 없음. 기존 프로젝트 인덱스 페이지(`frontend/app/projects/[slug]/page.tsx`) 확장.
- SVG는 벡터 마크업 → `<img src>` 또는 인라인 임베드. **다크모드 대응**을 위해 인라인/`currentColor` 활용 권장(단순 우선이면 `<img>`).

## 4. 변경 대상 (파일·경로 구체)
| 동작 | 경로 | 내용 |
|---|---|---|
| 수정 | `frontend/app/projects/[slug]/page.tsx` | 표지 렌더에 `architectureDiagram` 분기 추가 — 값 있으면 도식 임베드 섹션, 없으면 기존 architecture 텍스트만 |
| 신규(선택) | `frontend/components/ArchitectureDiagram.tsx` | SVG 임베드 컴포넌트(로드 실패·다크모드 처리 캡슐화) |

## 5. 인터페이스·시그니처 (구체)
- 소비 필드: `ProjectIndex.architectureDiagram: string | null`(be/0006). 정적 SVG 애셋 경로 — BE가 주는 상대경로를 웹 서빙 규약(정적 마운트/프록시)에 맞춰 절대 URL로 해석.
- 렌더: 도식이 있으면 architecture 텍스트와 함께(도식이 요약, 텍스트가 상세) 배치. `max-width:100%`·반응형, 확대 시 무손실.

## 6. 엣지 케이스
| 케이스 | 기대 동작 | 처리 위치 |
|---|---|---|
| architectureDiagram null | 도식 영역 생략, 텍스트만 | page |
| SVG 로드 실패(404) | 도식 영역 숨김(텍스트는 유지) | component |
| 다크모드 | 배경/선 대비 유지(반전 CSS 또는 currentColor) | component |
| architecture 텍스트도 빈 경우 | 둘 다 없으면 아키텍처 섹션 자체 생략 | page |

## 7. 수용 기준 — 결과문
- [ ] architectureDiagram이 있는 프로젝트에서 SVG 도식이 인덱스 화면에 보인다.
- [ ] 없는 프로젝트는 기존과 동일하게 텍스트만 렌더된다(하위호환).
- [ ] 다크모드에서 도식이 읽힌다.
- [ ] §6 각 행대로.

## 8. 범위 경계 — 하지 말 것
- BE(be/project) 수정 금지 — architectureDiagram는 소비만.
- SVG 생성·typst 관련 코드 금지(be/0006 소관).
- 포인트 상세·랜딩·챗봇 FAB 등 다른 화면 변경 금지.

## 9. 검증 방법
- architectureDiagram 유/무 픽스처로 인덱스 렌더 확인, 404·다크모드 케이스 확인.

## 10. 참조
- ARCHITECTURE §v4-C · fe/browse 일지 · 선행 be/0006 · 관련 fe/0001
