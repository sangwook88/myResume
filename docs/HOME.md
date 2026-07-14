# 도메인 지도

> 범위: [roadmap](roadmap.md) **v4 완료(2026-07-13)**. v1·v2 구현 완료(2026-07-08) — v2(경험 심화)는 새 도메인이 아니라 기존 fe/browse·fe/chat·be/chat에 확장으로 반영됨. v3는 프로토타입 범위인 인라인 선택-질문(`SelectionAsk.tsx`, fe/browse 확장)까지 구현하고 종료 — 자동화·RAG 계열은 **2026-07-13 피벗으로 안 함(YAGNI) 확정**(도메인으로 가르지 않음). 다음은 비-기능 '콘텐츠 채우기 페이즈'(`pofol` 인터뷰로 임시 데이터셋 교체).
> 기반: [설계 브리프](brainstorming/portfolio-agent-brief.md)
> v1 모델: 본인이 **Claude Code(구독)로 로컬에서** 문서+대화 → 포폴 포인트를 저작(근거 강제 기재) → 발행 → 채용자가 렌더된 위키를 둘러보다 챗봇(API)에 질문.

## 저작 도구 (서버 도메인 아님)
| 이름 | 역할 | 실행 |
|---|---|---|
| pofol | 대상 레포 git 이력을 질문 재료·Evidence 근거로 삼아, 섹션별로 사람을 캐물어(왜·대안·트레이드오프·근거) **생각을 극대화**해 프로젝트 표지·포폴 포인트를 채우는 인터뷰 엘리시테이션 스킬. 근거 강제 기재. 빠른 임시 초안이 필요하면 git-마이닝 모드(부록 A). 결과는 마크다운 + frontmatter status | 로컬·구독·Claude Code |

## FE 도메인
| slug | 역할(한 줄) | 상태 |
|---|---|---|
| fe/browse | 채용자가 렌더된 위키(published 포인트)를 둘러보는 화면 + 기본 디자인 템플릿 | done |
| fe/chat | 채용자가 챗봇과 대화하는 UI + 근거(커밋/Swagger 등) 링크 노출 | done |

## BE 도메인
| slug | 역할(한 줄) | 상태 |
|---|---|---|
| be/project | 프로젝트 인덱스(표지=1계층) 데이터 모델 — 요약·역할/기간/팀·기술스택·아키텍처개요·핵심성과 · 프로젝트 카탈로그(목록) | done |
| be/point | 포폴 포인트(2계층) 데이터 모델/양식(STAR+ADR 9섹션 + **근거 필수 필드**) · 위키 파일 저장 · 발행 status(draft↔published) | done |
| be/chat | 챗봇 응답 엔진 — published 포인트 **load-all**(API) + 근거 링크 인용 | done |

## 참조 그래프
- fe/browse → be/project     # 랜딩 프로젝트 목록 + 프로젝트 인덱스 화면(표지) 렌더
- fe/browse → be/point       # 추천·단건 published 포인트를 읽어 렌더
- fe/chat   → be/chat         # 챗봇 UI가 응답 엔진(API)을 호출
- be/chat   → be/point        # 응답 엔진이 published 포인트를 컨텍스트로 로드
- be/chat   → be/project      # "이 프로젝트 뭐예요?"에 프로젝트 표지(index)를 컨텍스트로 로드(목차-설계 §4)
- be/project → be/point       # index의 포인트 목록은 포인트 frontmatter(title/status/tags) 스캔으로 생성(목차-설계 §7.3)
- pofol → be/project       # 저작 스킬이 프로젝트 표지(index 1~5)를 인터뷰하고 기록 (로컬·구독)
- pofol → be/point         # 저작 스킬이 be/point 양식(목차)을 읽어 인터뷰하고 포인트로 기록 (로컬·구독)

## v4 확장 (2026-07-12~) — 신규 도메인·엣지 없음, 기존 도메인 확장
현재 타깃 v4([roadmap](roadmap.md))는 **새 도메인도 새 참조 엣지도 만들지 않는다.** 전부 기존 확장:

| 도메인 | v4 확장 |
|---|---|
| be/point | 마크다운 스키마 확장. ① STAR/ADR 프로즈를 **목차 스캐폴딩 + 사람 인터뷰 저작**으로 대체(pofol 2단계 결). ② **Evidence 밑 `invidence` 숨은 층** — 각 근거(커밋/PR)에 매달린 (a) 사람의 소소한 디테일·일화, (b) 코드 내용(발행 시 그 커밋의 diff/파일 1회 추출). 공개 DTO·FE는 invidence 제외, 챗봇만 읽음. git-읽기는 발행 플로우의 얇은 유틸(scripts, 새 도메인 아님) |
| be/chat | 코퍼스 조립이 be/point 확장 문서의 **visible + invidence(디테일·코드) 합집합**을 읽어 답변. + 프롬프트 캐싱·랭체인 정상화(프리픽스 고정·tone 브레이크포인트 후치·코퍼스 재배치 제거·1h TTL·stream_usage 실측) |
| be/project | 표지(index)가 **typst→SVG 압축 아키텍처 도식 애셋** 참조를 소유(architecture 필드 곁) |
| fe/browse | 포인트 페이지는 visible만 렌더(invidence 숨김) + 프로젝트 페이지에 도식 SVG 임베드 |
| fe/chat | 변화 없음(코드는 마크다운 코드펜스로 이미 렌더) |

be/project는 랜딩의 사이트 프로필(`wiki/profile.md`)과 프로필 사진(`wiki/profile/`)도 소유·서빙한다(조회·사진은 공개, 편집·업로드는 관리자 전용).

> 코드 공급 경계 결정: 별도 `be/git` 도메인을 만들지 않고 **Evidence 밑 `invidence` 하위 층**으로 흡수(같은 마크다운 파일·같은 발행 게이트 공유). 나중 v3 자동 git 분석이 실제로 필요해지면 그때 be/git로 승격 재검토.

> 안 만드는 도메인(YAGNI, 2026-07-13 피벗): be/raw·be/git(자동 소스)·be/wiki 저작 엔진(자동화)·RAG 서빙·풀 HITL 승인 → **안 함**(`pofol` 로컬 저작이 대체). 코드 공급은 be/point invidence 하위 층으로 흡수해 v4에 반영됨. 근거: [roadmap](roadmap.md) 「안 함」 · [[evidence-and-rag]]·[[authoring-local-vs-serving-api]] (메모리).
