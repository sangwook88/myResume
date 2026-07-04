# 도메인 지도

> 범위: [roadmap](roadmap.md) **현재 타깃 v1**의 포함 기능만. v2(경험 심화)·v3(자동화·RAG) 기능은 버전 게이트에 막혀 아직 도메인으로 가르지 않음.
> 기반: [설계 브리프](brainstorming/portfolio-agent-brief.md)
> v1 모델: 본인이 **Claude Code(구독)로 로컬에서** 문서+대화 → 포폴 포인트를 저작(근거 강제 기재) → 발행 → 채용자가 렌더된 위키를 둘러보다 챗봇(API)에 질문.

## 저작 도구 (서버 도메인 아님)
| 이름 | 역할 | 실행 |
|---|---|---|
| grill-me | be/project 표지(index) + be/point 양식(목차)을 기반으로 섹션별로 사람을 캐물어(왜·대안·트레이드오프·근거) **생각을 극대화**해 프로젝트 표지·포폴 포인트를 채우는 엘리시테이션 스킬. 근거 강제 기재. HITL(AI초안 승인) 대체. 결과는 마크다운 + frontmatter status | 로컬·구독·Claude Code |

## FE 도메인
| slug | 역할(한 줄) | 상태 |
|---|---|---|
| fe/browse | 채용자가 렌더된 위키(published 포인트)를 둘러보는 화면 + 기본 디자인 템플릿 | not-started |
| fe/chat | 채용자가 챗봇과 대화하는 UI + 근거(커밋/Swagger 등) 링크 노출 | not-started |

## BE 도메인
| slug | 역할(한 줄) | 상태 |
|---|---|---|
| be/project | 프로젝트 인덱스(표지=1계층) 데이터 모델 — 요약·역할/기간/팀·기술스택·아키텍처개요·핵심성과 · 프로젝트 카탈로그(목록) | done |
| be/point | 포폴 포인트(2계층) 데이터 모델/양식(STAR+ADR 9섹션 + **근거 필수 필드**) · 위키 파일 저장 · 발행 status(draft↔published) | done |
| be/chat | 챗봇 응답 엔진 — published 포인트 **load-all**(API) + 근거 링크 인용 | in-progress |

## 참조 그래프
- fe/browse → be/project     # 랜딩 프로젝트 목록 + 프로젝트 인덱스 화면(표지) 렌더
- fe/browse → be/point       # 추천·단건 published 포인트를 읽어 렌더
- fe/chat   → be/chat         # 챗봇 UI가 응답 엔진(API)을 호출
- be/chat   → be/point        # 응답 엔진이 published 포인트를 컨텍스트로 로드
- be/chat   → be/project      # "이 프로젝트 뭐예요?"에 프로젝트 표지(index)를 컨텍스트로 로드(목차-설계 §4)
- be/project → be/point       # index의 포인트 목록은 포인트 frontmatter(title/status/tags) 스캔으로 생성(목차-설계 §7.3)
- grill-me → be/project       # 저작 스킬이 프로젝트 표지(index 1~5)를 인터뷰하고 기록 (로컬·구독)
- grill-me → be/point         # 저작 스킬이 be/point 양식(목차)을 읽어 인터뷰하고 포인트로 기록 (로컬·구독)

> 미룬 도메인(버전 게이트): be/raw·be/git(자동 소스)·be/wiki 저작 엔진(자동화)·RAG 서빙·풀 HITL 승인 → 전부 v3. 근거: [[evidence-and-rag]]·[[authoring-local-vs-serving-api]] (메모리).
