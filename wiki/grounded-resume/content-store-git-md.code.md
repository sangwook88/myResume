<!-- 자동 생성(scripts/publish.py) — 챗봇 코퍼스 전용 invidence.code. 직접 편집 금지. -->

## [[E1]]
diff --git a/docs/HOME.md b/docs/HOME.md
new file mode 100644
index 0000000..130bd5b
--- /dev/null
+++ b/docs/HOME.md
@@ -0,0 +1,30 @@
+# 도메인 지도
+
+> 범위: [roadmap](roadmap.md) **현재 타깃 v1**의 포함 기능만. v2(경험 심화)·v3(자동화·RAG) 기능은 버전 게이트에 막혀 아직 도메인으로 가르지 않음.
+> 기반: [설계 브리프](brainstorming/portfolio-agent-brief.md)
+> v1 모델: 본인이 **Claude Code(구독)로 로컬에서** 문서+대화 → 포폴 포인트를 저작(근거 강제 기재) → 발행 → 채용자가 렌더된 위키를 둘러보다 챗봇(API)에 질문.
+
+## 저작 도구 (서버 도메인 아님)
+| 이름 | 역할 | 실행 |
+|---|---|---|
+| (authoring) | 문서+대화를 받아 포폴 포인트로 정리해 위키 파일에 기록(근거 강제 기재). v1엔 별도 웹 UI 없음 — Claude Code 스킬/세션이 저작 surface, 결과는 마크다운+frontmatter status | 로컬·구독·수동 |
+
+## FE 도메인
+| slug | 역할(한 줄) | 상태 |
+|---|---|---|
+| fe/browse | 채용자가 렌더된 위키(published 포인트)를 둘러보는 화면 + 기본 디자인 템플릿 | not-started |
+| fe/chat | 채용자가 챗봇과 대화하는 UI + 근거(커밋/Swagger 등) 링크 노출 | not-started |
+
+## BE 도메인
+| slug | 역할(한 줄) | 상태 |
+|---|---|---|
+| be/point | 포폴 포인트 데이터 모델/양식(STAR+ADR 9섹션 + **근거 필수 필드**) · 위키 파일 저장 · 발행 status(draft↔published) | not-started |
+| be/chat | 챗봇 응답 엔진 — published 포인트 **load-all**(API) + 근거 링크 인용 | not-started |
+
+## 참조 그래프
+- fe/browse → be/point      # 둘러보기 화면이 published 포인트를 읽어 렌더
+- fe/chat   → be/chat        # 챗봇 UI가 응답 엔진(API)을 호출
+- be/chat   → be/point       # 응답 엔진이 published 포인트를 컨텍스트로 로드
+- (authoring) → be/point     # 저작 도구가 포인트를 be/point 양식으로 기록 (로컬·구독)
+
+> 미룬 도메인(버전 게이트): be/raw·be/git(자동 소스)·be/wiki 저작 엔진(자동화)·RAG 서빙·풀 HITL 승인 → 전부 v3. 근거: [[evidence-and-rag]]·[[authoring-local-vs-serving-api]] (메모리).
diff --git a/docs/roadmap.md b/docs/roadmap.md
index d3414e5..49a9e51 100644
--- a/docs/roadmap.md
+++ b/docs/roadmap.md
@@ -1,7 +1,8 @@
 # 버전 로드맵 — 포트폴리오 + LLM Wiki 에이전트
 
 > 기반: [설계 브리프](brainstorming/portfolio-agent-brief.md) · [리서치 노트](brainstorming/portfolio-agent-research.md)
-> 버전 개수는 가변(N) — 기능이 차면 슬롯이 생긴다. 값(수치·규칙)은 여기서 짓지 않는다.
+> 2026-06-26 스코프 재확정: v1은 **직접 작성 + 근거 강제 기재 + load-all 챗봇**. 자동 git 분석·RAG는 뒤 버전.
+> 버전 개수는 가변(N). 값(수치·규칙)은 여기서 짓지 않는다.
 
 **현재 타깃 버전: v1**   <!-- decompose/plan/ticket은 이 버전의 '포함 기능'만 다룬다 -->
 
@@ -11,51 +12,46 @@
 
 | 기능 | v1 | v2 | v3 | 비고(근거·전제) |
 |---|:--:|:--:|:--:|---|
-| **be: raw 범용 인제스트** (대외활동·프로젝트 등 수동 드랍) | ✅ |  |  | 콘텐츠 폭 넓게 — 어떤 활동이든 문서로 투입 |
-| **be: git 분석 Source Agent** (2-Pass + 증분) | ✅ |  |  | 첫 자동 소스. 고가치 선별·증분 트리거 *[입력 필요]* |
-| **be: Wiki 저작·갱신 엔진** (Wiki Agent, 2계층) | ✅ |  |  | 핵심 루프. 갱신 전략 *[입력 필요]* |
-| **be: 포폴 포인트 데이터 모델/템플릿** (STAR+ADR 9섹션·프론트매터·옵션표) | ✅ |  |  | §포폴-목차-설계에서 확정 = v1 "디자인 템플릿"의 문서축 |
-| **be: HITL 승인 상태머신** (draft→approved) | ✅ |  |  | 챗봇은 approved만 인용 — 신뢰 핵심 |
-| **be: 챗봇 응답 엔진** (load-all + 근거 인용) | ✅ |  |  | 핵심 가치. load-all 임계 *[입력 필요]* |
-| **fe: 채용자 둘러보기 화면** (렌더 위키 HTML) | ✅ |  |  | approved만 노출 |
-| **fe: 챗봇 UI** (기본 하이브리드) | ✅ |  |  | 둘러보다 질문 |
-| **fe: 디자인 템플릿** (기본 비주얼) | ✅ |  |  | v1 명시 포함 |
-| **fe: 기본 기능 UI 플로우** | ✅ |  |  | v1 명시 포함 |
-| **fe: Evidence 노출 — 기본(커밋/PR 링크)** | ✅ |  |  | 근거 인용은 v1 필수 |
-| **fe: 개발자 검토·승인 — 기본(터미널/파일 편집)** | ✅ |  |  | HITL 방식 계승, 전용 UI는 v2 |
-| **fe: Evidence 고급 UI** (각주/펜첼형 접기) |  | ✅ |  | v1 기본 링크를 다듬음 |
-| **fe: 모드 토글** (기술/HR 적응형) |  | ✅ |  | v1 단일 눈높이 답변에 얹음 |
-| **fe: 개발자 승인 전용 UI** |  | ✅ |  | v1 HITL 상태머신에 의존 |
-| **fe: 하이브리드 둘러보기 고급화** |  | ✅ |  | v1 둘러보기·챗봇에 의존 |
-| **be: 검색/서빙 레이어 Stage 1~3** (임베딩·벡터·리랭커) |  |  | ✅ | 위키가 ~50K 토큰 초과 시(Context Rot). v1은 load-all로 충분 |
-| **be: 추가 Source Agents 자동 연동** (대외활동·Notion 등) |  |  | ✅ | v1 범용 드랍을 자동화로 대체·보강 |
-| **공통: 자동 파일-드랍 트리거** (watcher) |  |  | ✅ | 외부 watcher 필요(복잡). v1은 CLI 수동 |
+| **포폴 포인트 데이터 모델/템플릿** (STAR+ADR 9섹션·프론트매터·**근거 필수 필드**) | ✅ |  |  | 직접 쓰려면 양식이 먼저. evidence 비면 무효 |
+| **수동 작성** (사람이 포인트 직접 작성 + 근거 강제 기재) | ✅ |  |  | v1 핵심. 자동 git 분석을 *대체* |
+| **발행 토글** (draft→published, 경량) | ✅ |  |  | 직접 쓰니 풀 HITL은 과함. published만 노출 |
+| **채용자 둘러보기 화면** (렌더, published만) | ✅ |  |  | "메인 페이지에 보이게" |
+| **디자인 템플릿** (기본 비주얼) | ✅ |  |  | v1 명시 포함 |
+| **Evidence 노출 — 기본** (근거 링크, 채용자 클릭-검증) | ✅ |  |  | 강제 기재 차별점의 표현. 챗봇이 원문 검색은 안 함(=load-all) |
+| **챗봇 응답 엔진** (load-all + 근거 링크 인용) | ✅ |  |  | "보다가 물어봄". RAG 아님 |
+| **챗봇 UI** (기본 하이브리드) | ✅ |  |  | 위와 짝 |
+| **Evidence 고급 UI** (각주/펜첼형 접기) |  | ✅ |  | v1 기본 링크를 다듬음 |
+| **모드 토글** (기술/HR 적응형) |  | ✅ |  | v1 단일 눈높이 답변에 얹음 |
+| **하이브리드 둘러보기 고급화** |  | ✅ |  | v1 둘러보기·챗봇에 의존 |
+| **자동 git 분석 Source Agent** (2-Pass + 증분) |  |  | ✅ | 손 기재를 자동 추출로. 고가치 선별·증분 트리거 *[입력 필요]* |
+| **raw 범용 인박스 + 추가 Source Agents** (대외활동·Notion 등) |  |  | ✅ | 자동 소스가 생길 때의 인제스트 층 |
+| **Wiki 저작·갱신 엔진** (raw→wiki LLM 저작, 2계층) |  |  | ✅ | v1은 사람이 직접 저작 → 자동 소스 들어올 때 필요 |
+| **검색/서빙 RAG** (임베딩·벡터·리랭커 — 챗봇이 근거 원문까지 검색) |  |  | ✅ | 코퍼스가 ~50K 토큰 초과(Context Rot) 또는 원문 검색(mode B) 필요 시. v1은 load-all |
+| **자동 파일-드랍 트리거** (watcher) |  |  | ✅ | 외부 watcher 필요(복잡). v1·v2는 수동 |
 | **음성/아바타 멀티모달** |  |  |  | 안 함 — 핵심(근거 Q&A)과 무관 |
-| **다중 개발자 / 공개 SaaS** |  |  |  | 안 함 — v 비전은 본인 1명 포폴 |
+| **다중 개발자 / 공개 SaaS** |  |  |  | 안 함 — 비전은 본인 1명 포폴 |
 
 ---
 
-## v1 — 실제 작업에 접지된 근거로 답하는 챗봇 + 기본 둘러보기 (MVP)
-- **목표(가치)**: 채용자가 개발자의 실제 활동(git/PR + 수동 투입한 대외활동·프로젝트)에 접지된 **근거(커밋/PR) 기반 답변**을 챗봇에게서 얻고, 렌더된 위키를 둘러볼 수 있다 — "근거 기반 답변"이라는 핵심 차별점을 끝까지 증명.
+## v1 — 직접 쓴 근거 포폴 + load-all 챗봇 (MVP)
+- **목표(가치)**: 개발자가 보여주고 싶은 프로젝트 내용을 **직접 작성**(근거 문서 강제 기재)해 메인 페이지에 렌더하고, 채용자가 둘러보다 챗봇으로 물으면 **그 내용 안에서 근거와 함께** 답한다. "근거 없이는 못 쓴다"는 강제 규칙으로 차별점(신뢰)을 증명.
 - **포함 기능**:
-  - 소스: raw 범용 드랍 + git 자동 분석 Source Agent
-  - 저작: Wiki 저작·갱신 엔진 + 포폴 포인트 데이터 모델/템플릿
-  - 신뢰: HITL 승인 상태머신(draft→approved) + 기본 승인(터미널/파일)
-  - 서빙: 챗봇 응답 엔진(load-all + 커밋/PR 링크 인용)
-  - 표현: 채용자 둘러보기 화면 + 기본 챗봇 UI + **디자인 템플릿(기본 비주얼)** + **기본 기능 UI 플로우**
-  - 조율: Orchestrator(CLI 수동 트리거)
-- **제외(다음으로)**: 모드 토글·Evidence 고급 UI·승인 전용 UI·둘러보기 고급화(→v2), 검색 레이어·추가 Source Agents·자동 트리거(→v3)
+  - 양식: 포폴 포인트 데이터 모델/템플릿(STAR+ADR + 근거 필수 필드)
+  - 작성: 수동 작성(직접 작성 + 근거 강제 기재) + 발행 토글(draft→published)
+  - 표현: 채용자 둘러보기 화면 + 디자인 템플릿 + Evidence 기본(근거 링크 클릭-검증)
+  - 서빙: 챗봇 응답 엔진(load-all + 근거 링크 인용) + 챗봇 UI
+- **제외(다음으로)**: 모드 토글·Evidence 고급 UI·둘러보기 고급화(→v2); 자동 git 분석·raw 인박스·Wiki 저작 엔진·RAG·자동 트리거(→v3)
 - **전제(의존)**: 없음(MVP).
 
-## v2 — 채용자 경험 심화 (적응형 + 근거 표현 + 승인 UI)
-- **목표**: v1의 핵심 루프 위에 채용자 경험을 다듬는다 — 기술/비기술 적응형, 근거를 깔끔히 보이기, 개발자 운영 편의.
-- **포함**: 모드 토글(기술/HR), Evidence 고급 UI(각주/펜첼형), 개발자 승인 전용 UI, 하이브리드 둘러보기 고급화.
-- **전제**: v1의 챗봇 응답 엔진·둘러보기·HITL 상태머신.
+## v2 — 채용자 경험 심화
+- **목표**: v1 핵심 루프 위에 채용자 경험을 다듬는다 — 적응형 눈높이, 근거를 깔끔히 보이기.
+- **포함**: 모드 토글(기술/HR), Evidence 고급 UI(각주/펜첼형), 하이브리드 둘러보기 고급화.
+- **전제**: v1의 챗봇 응답 엔진·둘러보기·Evidence 기본.
 
-## v3 — 규모·자동화 확장
-- **목표**: 위키가 커지고 소스가 늘어도 정확·자동으로 굴러가게.
-- **포함**: 검색/서빙 레이어 Stage 1~3(임베딩·벡터·리랭커), 추가 Source Agents 자동 연동(대외활동·Notion 등), 자동 파일-드랍 트리거(watcher).
-- **전제**: v1의 위키·챗봇, v2의 표현 층. 검색 레이어는 위키가 ~50K 토큰 초과(Context Rot) 시 의미.
+## v3 — 자동화·규모 확장
+- **목표**: 손으로 쓰던 걸 자동 추출하고, 코퍼스가 커져도 정확히 굴러가게.
+- **포함**: 자동 git 분석 Source Agent(2-Pass+증분), raw 범용 인박스 + 추가 Source Agents, Wiki 저작·갱신 엔진(raw→wiki), 검색/서빙 RAG, 자동 파일-드랍 트리거.
+- **전제**: v1의 포폴 포인트 양식·챗봇·렌더. RAG는 코퍼스가 ~50K 토큰 초과(Context Rot) 또는 근거 원문 검색(mode B)이 필요해질 때 의미.
 
 <!-- v4+ 슬롯은 기능이 차면 추가. 지금은 못 박지 않음. -->
 
@@ -63,4 +59,4 @@
 
 ## 안 함 (YAGNI)
 - **음성/아바타 멀티모달** — 핵심(근거 기반 Q&A)과 무관. 떠오르면 v3 이후 별도 재검토.
-- **다중 개발자 / 공개 SaaS** — v 비전은 본인 1명 포폴. 서비스화는 제품-시장 검증 후에나.
+- **다중 개발자 / 공개 SaaS** — 비전은 본인 1명 포폴. 서비스화는 제품-시장 검증 후에나.

## [[E2]]
diff --git a/docs/arch/ARCHITECTURE.md b/docs/arch/ARCHITECTURE.md
new file mode 100644
index 0000000..7d6fbfb
--- /dev/null
+++ b/docs/arch/ARCHITECTURE.md
@@ -0,0 +1,76 @@
+# ARCHITECTURE — 근거기반 포트폴리오 (v1)
+
+> 기획 QA·distill 완료 후 확정한 전역 기술·구조. [ticket](../../.claude/skills/ticket/SKILL.md)의 구조 근거.
+> 범위: [roadmap](../roadmap.md) **v1**. 도메인 지도: [HOME](../HOME.md).
+> v1 모델: 로컬(구독) 저작 → published 마크다운 위키 → 채용자 둘러보기 + load-all 챗봇(API).
+
+## 1. 기술 스택
+
+| 층 | 선택 | 근거 |
+|---|---|---|
+| FE 언어·프레임워크 | **TypeScript + Next.js** (React) | 채용자용 공개 위키라 SSG/SSR + SEO 필요. 콘텐츠 렌더 + 챗 스트리밍 island 한 스택. |
+| BE 언어·프레임워크 | **Python + FastAPI** | LangChain 세션 메모리 생태계 성숙 + v3 RAG 확장 유리. |
+| LLM | **Claude API — `claude-sonnet-5`, 스트리밍** | 근거기반 답변(be/chat). Opus급 품질에 저렴·빠름, 서빙 호출량에 유리. |
+| LLM 오케스트레이션 | **LangChain (Python)** | 답변 생성 + 세션 대화 이력(`RedisChatMessageHistory` 류). |
+| load-all 비용 대책 | **프롬프트 캐싱**(`cache_control`) | published 코퍼스는 크고 안정적인 prefix — 턴·사용자 간 캐시 재사용으로 입력 비용 대폭↓. |
+| 저장소 | **Redis**(세션) + **git 마크다운 파일**(콘텐츠) | 세션=핫·임시·자동만료 → Redis TTL. 콘텐츠=소중·버전관리 → git `wiki/*.md`. **관계형 DB 없음**(v1은 계정 없음). |
+| 콘텐츠 서빙 | **Python API 단일 소스** | Python이 `wiki/*.md`를 읽어 be/point·be/project API로 서빙. chat load-all도 같은 파일을 읽어 단일 소스. FE는 그 API를 fetch(SSG/SSR). |
+| 배포 | FE=정적/Edge 호스팅, BE=컨테이너 | *[입력 필요: 구체 플랫폼(Vercel/기타)·CI]* |
+
+## 2. 레이어·모듈 경계
+
+- 최상위 = **FE vs BE 2분할**. FE=플로우+표현(V), BE=데이터(M)+기능(C).
+- 디렉토리 매핑:
+  - FE: `docs/fe/browse/`·`docs/fe/chat/` → Next.js 앱(페이지·컴포넌트·챗 패널 island).
+  - BE: `docs/be/project/`·`docs/be/point/`·`docs/be/chat/` → FastAPI 서비스(도메인별 라우터·리포지토리).
+  - 콘텐츠: `wiki/<project>/index.md`(be/project) + `wiki/<project>/<id>.md`(be/point). BE만 읽는다.
+- FE는 BE 기능을 **HTTP API로만** 호출. BE는 FE를 모른다.
+
+## 3. 의존 방향 ([HOME](../HOME.md) 참조 그래프)
+
+```
+fe/browse → be/project, be/point        (HTTP)
+fe/chat   → be/chat                       (HTTP, 스트리밍)
+be/chat   → be/point, be/project          (load-all 코퍼스 읽기)
+be/project → be/point                     (index 포인트목록 = frontmatter 스캔)
+```
+- 전부 단방향·비순환. be/point가 말단(sink).
+- 전부 **호출(직접 읽기/HTTP)** — 이벤트 없음(v1 규모).
+
+## 4. 패턴 정책 (TS/DM)
+
+세 BE 도메인 모두 규칙이 얇고 절차적(조회·발행 게이트·LLM 오케스트레이션) — 풍부한 불변식 없음 → **전부 트랜잭션 스크립트(TS)**.
+
+| BE 도메인 | 패턴 | 근거 |
+|---|---|---|
+| be/point | **TS** | 파일 파싱→DTO 조회 + 발행 게이트(Evidence≥1+핵심섹션 1·3·5·9) 검증. 얇은 규칙. |
+| be/project | **TS** | 표지 조회 + 포인트목록 조립. 거의 순수 조회. |
+| be/chat | **TS** | load-all + 근거 인용 + 세션 관리 = LLM·스토어 오케스트레이션. 도메인 불변식 아님. |
+
+> 규칙이 두꺼워지면 해당 도메인만 DM으로 승격. 각 BE `README.md` 패턴 슬롯을 이 표로 채움.
+
+## 5. 데이터·영속
+
+- **콘텐츠(위키)** = git 버전관리 마크다운. frontmatter YAML(포인트: id·title·project·status·tags·commits·updated / 표지: slug·summary·role·period·teamSize·techStack·architecture·highlights). Python이 파싱해 서빙.
+- **세션** = Redis KV. `session_id`(세션 쿠키) → turns(role·text·citations). **TTL 1일 sliding**(활동마다 갱신, 만료 자동 삭제).
+- **DTO·직렬화** = FE↔BE JSON API. **키 케이스 = camelCase**(FE TS 소비, ticket에서 확정).
+- 챗 스트리밍 = SSE(FastAPI StreamingResponse ← Claude 스트리밍).
+
+## 6. 에러·경계
+
+- 없는/비공개(draft) 리소스 직접 접근 → **랜딩 리다이렉트**(draft 존재 노출 안 함).
+- 발행 게이트 미충족 → 발행 거부.
+- 챗 근거 없음 → "근거 없어 답할 수 없음"(환각 방지). 생성 실패·**30초 타임아웃** → 에러 반환(FE 재시도).
+- load-all 코퍼스가 컨텍스트 예산 초과 → v1은 예산 내 가정, 초과 시 **RAG(v3) 도입 신호**.
+
+## 7. 명명·컨벤션
+
+- 코드·식별자 영문. 주석·문서 한국어. 도메인 slug 영문(`fe/`·`be/`).
+- id·project·slug = 케밥. 날짜 = ISO `YYYY-MM-DD`. commits = git range `a..b`. period = `YYYY.MM–YYYY.MM`.
+- FE=TS(camelCase), BE=Python(snake_case) 내부. API 계약 키 케이스는 §5 슬롯.
+
+## 8. 미결
+- 배포 플랫폼·CI 구체.
+- 프롬프트 캐싱 TTL(5분 기본 vs 1시간)·브레이크포인트 배치.
+- LangChain 세션 스토어 구현 세부(Redis 연결·키 스키마).
+- 세션 `session_id` 발급·쿠키 속성(SameSite·Secure) 세부.
diff --git a/docs/be/chat/README.md b/docs/be/chat/README.md
index 5737299..0276085 100644
--- a/docs/be/chat/README.md
+++ b/docs/be/chat/README.md
@@ -1,7 +1,7 @@
 ---
 kind: be
 status: not-started
-pattern:                  # arch가 채움 (TS/DM)
+pattern: TS               # arch 확정 (트랜잭션 스크립트)
 depends: [be/point, be/project]   # load-all 코퍼스: published 포인트 + 프로젝트 표지
 # --- implement.ps1 헤드리스 백엔드용 (선택) ---
 branch: feat/be-chat
@@ -20,8 +20,7 @@ engine: codex
 - [기능_세션이력관리.md](기능_세션이력관리.md) — session_id 기준 이력 로드·저장, TTL 1일 만료 (fe/chat 양 노드)
 
 ## 패턴 (BE 도메인만)
-*ARCHITECTURE §패턴 정책 기본값. arch가 채운다.*
-- 채택: *[입력 필요: arch에서 결정 — TS/DM + 왜]*
+- 채택: **TS(트랜잭션 스크립트)** — load-all + 근거 인용 + 세션 관리는 LLM·스토어 오케스트레이션이지 도메인 불변식이 아니라 절차적 서비스로 구현. ([ARCHITECTURE §4](../../arch/ARCHITECTURE.md))
 
 ## 책임지지 않는 것
 - **챗 화면·패널·스트리밍 렌더·근거 링크 클릭 이탈** — fe/chat. 여기선 데이터·응답만 생성.
diff --git "a/docs/be/chat/\354\235\274\354\247\200.md" "b/docs/be/chat/\354\235\274\354\247\200.md"
index ffa24f4..fc87a9b 100644
--- "a/docs/be/chat/\354\235\274\354\247\200.md"
+++ "b/docs/be/chat/\354\235\274\354\247\200.md"
@@ -14,6 +14,10 @@ fe/chat qa 도출에서 신설(plan-be) + 사람 값 확정. 데이터=대화세
 - **왜:** 근거기반 신뢰가 제품 차별점이라 환각 방지 최우선. 나머지는 익명 웹 챗봇 표준 + 로드맵(load-all=v1) 정합.
 - **영향:** be/chat 비즈니스 슬롯 전부 충족 → distill 가능. 세션 스토어 구현·LLM 스택·패턴은 arch.
 
+### 2026-06-29 — arch 확정: TS + Sonnet 5 + LangChain/Redis
+- **결정:** 패턴 = TS(트랜잭션 스크립트). LLM = Claude API `claude-sonnet-5` 스트리밍 + **프롬프트 캐싱**(load-all 코퍼스 prefix 캐싱으로 비용↓). 오케스트레이션 = LangChain(Python), 세션 이력 = Redis(sliding TTL 1일).
+- **왜:** load-all+근거 인용+세션은 LLM·스토어 오케스트레이션이라 절차적 서비스가 맞음. Sonnet 5는 Opus급 품질에 저렴·빠름(서빙 호출량 유리). 캐싱이 load-all 비용 약점을 메움.
+
 ### 2026-06-29 — distill 가지치기
 - **결정:** 데이터 `expiresAt` 표기를 sliding(마지막 활동+1일)으로 정정(기능과 불일치 해소), 답변생성 예외의 "근거 없음" 중복 제거(처리에 이미 정의).
 - **왜:** 핵심 의미 보존하며 불일치·중복 제거(slim-agent).
diff --git a/docs/be/point/README.md b/docs/be/point/README.md
index 6009327..bc2163a 100644
--- a/docs/be/point/README.md
+++ b/docs/be/point/README.md
@@ -1,7 +1,7 @@
 ---
 kind: be
 status: not-started
-pattern:                  # arch가 채움 (TS/DM)
+pattern: TS               # arch 확정 (트랜잭션 스크립트)
 depends: []               # be/point는 말단(sink) — 다른 도메인을 읽지 않음
 # --- implement.ps1 헤드리스 백엔드용 (선택) ---
 branch: feat/be-point
@@ -20,8 +20,7 @@ engine: codex
 - [기능_포인트단건조회.md](기능_포인트단건조회.md) — id 기준 published 포인트 단건(9섹션+Evidence) (포인트상세)
 
 ## 패턴 (BE 도메인만)
-*ARCHITECTURE §패턴 정책 기본값. arch가 채운다.*
-- 채택: *[입력 필요: arch에서 결정 — TS/DM + 왜]*
+- 채택: **TS(트랜잭션 스크립트)** — 파일 파싱→DTO 조회 + 발행 게이트 검증은 얇은 절차적 규칙이라 도메인 모델 불필요. ([ARCHITECTURE §4](../../arch/ARCHITECTURE.md))
 
 ## 책임지지 않는 것
 - **프로젝트 표지(index 1계층) 데이터·프로젝트 목록** — be/project. 여기선 개별 포인트만.
diff --git "a/docs/be/point/\354\235\274\354\247\200.md" "b/docs/be/point/\354\235\274\354\247\200.md"
index d30aa1c..5c80d2c 100644
--- "a/docs/be/point/\354\235\274\354\247\200.md"
+++ "b/docs/be/point/\354\235\274\354\247\200.md"
@@ -14,6 +14,10 @@ fe/browse qa 매핑표에서 도출한 골격 + 사람 값 확정 완료(plan-be
 - **왜:** 개인 포폴·로컬 구독 저작 모델이라 큐레이션·경량 게이트가 적합. 근거 강제(Evidence≥1)는 제품 차별점.
 - **영향:** be/point 비즈니스 슬롯 전부 충족. 남은 건 arch의 패턴(TS/DM)뿐 → distill 가능.
 
+### 2026-06-29 — arch 패턴 확정: TS
+- **결정:** 패턴 = 트랜잭션 스크립트(TS). 스택 = Python/FastAPI, 콘텐츠는 git 마크다운을 Python이 파싱해 API 서빙.
+- **왜:** 파일 파싱→DTO 조회 + 발행 게이트 검증은 얇은 절차적 규칙이라 도메인 모델 과설계.
+
 ### 2026-06-29 — distill 가지치기
 - **결정:** Evidence kind 표 셀의 stale 표기(3종→enum 5종 참조)로 정제, 추천 입력의 자명한 메타 1줄 삭제, 단건조회 리다이렉트 중복(처리·예외)을 예외 1곳으로 통합.
 - **왜:** 핵심 의미 보존하며 군더더기·중복·불일치 제거(slim-agent).
diff --git a/docs/be/project/README.md b/docs/be/project/README.md
index 8403279..aab01b7 100644
--- a/docs/be/project/README.md
+++ b/docs/be/project/README.md
@@ -1,7 +1,7 @@
 ---
 kind: be
 status: not-started
-pattern:                  # arch가 채움 (TS/DM)
+pattern: TS               # arch 확정 (트랜잭션 스크립트)
 depends: [be/point]       # index의 포인트 목록을 be/point frontmatter 스캔으로 조립
 # --- implement.ps1 헤드리스 백엔드용 (선택) ---
 branch: feat/be-project
@@ -19,8 +19,7 @@ engine: codex
 - [기능_프로젝트인덱스조회.md](기능_프로젝트인덱스조회.md) — project 기준 표지 데이터 + published 포인트 목록 조립 (프로젝트인덱스)
 
 ## 패턴 (BE 도메인만)
-*ARCHITECTURE §패턴 정책 기본값. arch가 채운다.*
-- 채택: *[입력 필요: arch에서 결정 — TS/DM + 왜]*
+- 채택: **TS(트랜잭션 스크립트)** — 표지 조회 + 포인트목록 조립은 거의 순수 조회라 절차적 함수로 충분. ([ARCHITECTURE §4](../../arch/ARCHITECTURE.md))
 
 ## 책임지지 않는 것
 - **개별 포폴 포인트(2계층) 데이터·발행 status** — b
…(잘림)
