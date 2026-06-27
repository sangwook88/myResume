# 도메인 지도

> 범위: [roadmap](roadmap.md) **현재 타깃 v1**의 포함 기능만. v2(경험 심화)·v3(자동화·RAG) 기능은 버전 게이트에 막혀 아직 도메인으로 가르지 않음.
> 기반: [설계 브리프](brainstorming/portfolio-agent-brief.md)
> v1 모델: 본인이 **Claude Code(구독)로 로컬에서** 문서+대화 → 포폴 포인트를 저작(근거 강제 기재) → 발행 → 채용자가 렌더된 위키를 둘러보다 챗봇(API)에 질문.

## 저작 도구 (서버 도메인 아님)
| 이름 | 역할 | 실행 |
|---|---|---|
| (authoring) | 문서+대화를 받아 포폴 포인트로 정리해 위키 파일에 기록(근거 강제 기재). v1엔 별도 웹 UI 없음 — Claude Code 스킬/세션이 저작 surface, 결과는 마크다운+frontmatter status | 로컬·구독·수동 |

## FE 도메인
| slug | 역할(한 줄) | 상태 |
|---|---|---|
| fe/browse | 채용자가 렌더된 위키(published 포인트)를 둘러보는 화면 + 기본 디자인 템플릿 | not-started |
| fe/chat | 채용자가 챗봇과 대화하는 UI + 근거(커밋/Swagger 등) 링크 노출 | not-started |

## BE 도메인
| slug | 역할(한 줄) | 상태 |
|---|---|---|
| be/point | 포폴 포인트 데이터 모델/양식(STAR+ADR 9섹션 + **근거 필수 필드**) · 위키 파일 저장 · 발행 status(draft↔published) | not-started |
| be/chat | 챗봇 응답 엔진 — published 포인트 **load-all**(API) + 근거 링크 인용 | not-started |

## 참조 그래프
- fe/browse → be/point      # 둘러보기 화면이 published 포인트를 읽어 렌더
- fe/chat   → be/chat        # 챗봇 UI가 응답 엔진(API)을 호출
- be/chat   → be/point       # 응답 엔진이 published 포인트를 컨텍스트로 로드
- (authoring) → be/point     # 저작 도구가 포인트를 be/point 양식으로 기록 (로컬·구독)

> 미룬 도메인(버전 게이트): be/raw·be/git(자동 소스)·be/wiki 저작 엔진(자동화)·RAG 서빙·풀 HITL 승인 → 전부 v3. 근거: [[evidence-and-rag]]·[[authoring-local-vs-serving-api]] (메모리).
