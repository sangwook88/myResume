<!-- 자동 생성(scripts/publish.py) — 챗봇 코퍼스 전용 invidence.code. 직접 편집 금지. -->

## [[E1]]
diff --git "a/docs/\355\217\254\355\217\264-\353\252\251\354\260\250-\354\204\244\352\263\204.md" "b/docs/\355\217\254\355\217\264-\353\252\251\354\260\250-\354\204\244\352\263\204.md"
index a93776b..ecd8169 100644
--- "a/docs/\355\217\254\355\217\264-\353\252\251\354\260\250-\354\204\244\352\263\204.md"
+++ "b/docs/\355\217\254\355\217\264-\353\252\251\354\260\250-\354\204\244\352\263\204.md"
@@ -137,8 +137,59 @@ updated: 2026-06-07
 
 ---
 
-## 8. 다음 단계 (미결)
+## 8. 검색/서빙 레이어 (RAG 기법을 LLM Wiki에 적용)
+
+### 8.1 핵심 재구성: 위키 = 저작, RAG = 서빙
+
+LLM Wiki("전체를 컨텍스트에")와 RAG("질문마다 검색")는 충돌이 아니라 **작동 시점이 다르다.**
+- **위키** = 지식이 정제·축적되는 저작 레이어 (raw → HITL → approved 문서)
+- **RAG 검색** = 질문 시점에 *어떤 위키를 컨텍스트에 올릴지* 고르는 서빙 레이어
+
+포트폴리오가 작으면 approved 전부를 컨텍스트에 넣으면 된다(=순수 LLM Wiki).
+검색은 문서가 늘어 컨텍스트 예산을 넘을 때 "무엇을 고를까"를 담당한다.
+그리고 §7의 구조(프론트매터·섹션·옵션표)가 각 RAG 레이어를 더 싸고 정확하게 만든다.
+
+### 8.2 검색 레이어 ↔ 위키 구조 매핑
+
+| RAG 레이어 | 위키에서의 적용 | 위키 이점 |
+|---|---|---|
+| **L1 문서 필터링** | `status:approved`만 검색 + 프론트매터(`project`/`tags`) 메타 사전필터 | 휴리스틱 노이즈 제거가 아니라 구조화 필드 필터 → 신뢰도 ↑ |
+| **L2 청킹/Contextual** | 섹션이 곧 청크 경계. 청크 앞에 `[project·title·섹션]` 접두어 = Contextual prefix를 LLM 호출 없이 확보 | Contextual Retrieval의 비싼 부분을 구조가 대체 |
+| **L3 하이브리드** | BM25(기술명·고유명사) + dense(의미), RRF 결합. `tags`/`tech` 필드 가중 | 정규화된 필드로 BM25 정밀도 ↑ |
+| **L4 Reranker** | top-K 섹션을 cross-encoder 재정렬 | 섹션이 자기완결적이라 점수 깨끗 |
+
+### 8.3 Small-to-big (LLM Wiki 정신 유지)
+
+검색은 *섹션 청크* 단위로 하되, 컨텍스트엔 **그 청크의 부모 포폴 포인트 문서 전체**를 올린다.
+"단위마다 전체 맥락을 본다"는 LLM Wiki 정신을 지키면서, *어떤 단위*를 고를지만 검색에 맡긴다.
+답변엔 §5의 Evidence(커밋/PR)를 출처로 인용 → NotebookLM식 근거 제시.
+
+### 8.4 성장 사다리 (4레이어를 실용 순서로) — **v1 = Stage 1**
+
+- **Stage 0 — Load-all (검색 없음):** approved 전부를 컨텍스트에. 합계가 예산 안이면 최선.
+  → v1에 "문서 적으면 전부 로드"하는 지름길로 내장.
+- **Stage 1 — 메타필터 + dense + Small-to-big (← v1 목표):**
+  ①`status:approved`+`project`/`tags` 필터 → ②dense 임베딩 top-K 섹션 → ③부모 문서 통째 로드.
+- **Stage 2 — 하이브리드(BM25+dense, RRF):** 기술명·고유명사 정확도 필요해지면 추가.
+- **Stage 3 — Reranker + Contextual prefix:** 후보가 많아 정밀 재정렬이 필요하면 추가.
+
+핵심: Stage 1의 골격(필터 → 검색 → small-to-big)만 제대로 잡으면 Stage 2·3은
+"검색 단계 안에 모듈을 끼워넣는" 일이라 무리 없이 자란다.
+
+### 8.5 설계 메모 / 결정 필요
+
+- **활성화 임계치:** 전체 approved 토큰 합 ≤ 컨텍스트 예산이면 Stage 0(load-all), 넘으면 Stage 1.
+  합계는 인덱스/프론트매터로 싸게 추정. (정확한 임계 비율은 튜닝값)
+- **임베딩 모델:** 본문이 **한국어**이므로 다국어/한국어 지원 dense 임베더 필수. (모델 선정은 구현 단계)
+- **청크 단위:** §5 템플릿의 섹션 단위. 옵션표는 통째로 하나의 청크.
+- `[project·title·섹션]` 접두어는 비용이 거의 없어 v1(Stage 1)부터 붙여도 무방.
+
+---
+
+## 9. 다음 단계 (미결)
 
 - [ ] 이 템플릿을 에이전트 프롬프트로 옮기는 작업 (Git Agent → Wiki Agent 연계) — *구현 계획 단계*
+- [ ] 임베딩 모델 선정 (한국어 지원) 및 활성화 임계치 튜닝값 — *구현 단계*
 
 > ①프론트매터 스키마 ②인덱스 링크 규칙 ③옵션 표 컬럼은 §7에서 확정됨.
+> 검색/서빙 레이어 방향(실용 우선, v1=Stage 1)은 §8에서 확정됨.

## [[E2]]
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

## [[E3]]
diff --git a/backend/app/chat/__init__.py b/backend/app/chat/__init__.py
new file mode 100644
index 0000000..0099b20
--- /dev/null
+++ b/backend/app/chat/__init__.py
@@ -0,0 +1,5 @@
+"""be/chat 도메인: load-all 답변 생성·근거 인용·세션 이력·맥락 제안질문.
+
+패턴 = TS(트랜잭션 스크립트, ARCHITECTURE §4). LLM·Redis 오케스트레이션이며
+도메인 불변식은 없다. 코퍼스는 be/point·be/project를 읽기만 한다(단방향).
+"""
diff --git a/backend/app/chat/corpus.py b/backend/app/chat/corpus.py
new file mode 100644
index 0000000..37384a4
--- /dev/null
+++ b/backend/app/chat/corpus.py
@@ -0,0 +1,168 @@
+"""load-all 코퍼스 조립 (기능_답변생성.md).
+
+published 포인트 전문(9섹션 본문 + Evidence)과 프로젝트 표지를 be/point·be/project의
+**공개 서비스 시그니처로만** 읽어(내부 수정 없음) 하나의 안정적인 prefix 컨텍스트
+문자열로 조립한다. 이 prefix 는 크고 안정적이므로 프롬프트 캐싱(cache_control)의
+캐시 대상이 된다(ARCHITECTURE §1 load-all 비용 대책).
+
+RAG 아님 — v1 은 전부 로드한다. 컨텍스트 예산 초과 시 로그 경고만 남기고 그대로
+시도한다(티켓 §6, 초과는 RAG(v3) 도입 신호).
+
+전체 published 열거 경로(공개 계약만 사용):
+  project_service.list_projects() → 각 slug 의 표지 get_index()
+  → point_service.list_by_project(slug) → 각 id 의 전문 get_published()
+"""
+
+from __future__ import annotations
+
+import logging
+from dataclasses import dataclass, field
+
+from app.chat.models import Citation
+from app.point import service as point_service
+from app.point.models import Point
+from app.project import service as project_service
+from app.project.models import ProjectIndex
+
+logger = logging.getLogger(__name__)
+
+# v1 load-all 예산 경고 임계치(대략 문자 수). 초과해도 막지 않고 경고만(티켓 §6).
+_BUDGET_WARN_CHARS = 400_000
+
+
+@dataclass
+class CorpusBundle:
+    """조립된 코퍼스와 인용 매핑.
+
+    - text: LLM system prefix 로 넣을 전체 컨텍스트 문자열.
+    - evidence: 인용 토큰(E1, E2 …) → Citation. 모델이 사용한 토큰을 되돌려 인용을 만든다.
+    - point_count: 포함된 published 포인트 수. 0 이면 빈 코퍼스(근거 없음).
+    """
+
+    text: str
+    evidence: dict[str, Citation] = field(default_factory=dict)
+    point_count: int = 0
+
+    @property
+    def has_content(self) -> bool:
+        """답변 근거가 될 published 포인트가 하나라도 있는가."""
+        return self.point_count > 0
+
+
+def _render_cover(idx: ProjectIndex) -> str:
+    lines = [
+        f"## 프로젝트: {idx.slug}",
+        f"- 한줄요약: {idx.summary}",
+        f"- 역할: {idx.role}",
+        f"- 기간: {idx.period}",
+        f"- 팀 규모: {idx.team_size}",
+        f"- 기술 스택: {', '.join(idx.tech_stack)}",
+        f"- 아키텍처: {idx.architecture}",
+    ]
+    if idx.highlights:
+        lines.append("- 핵심 성과:")
+        lines.extend(f"  - {h}" for h in idx.highlights)
+    return "\n".join(lines)
+
+
+def _render_point(point: Point, evidence: dict[str, Citation], counter: list[int]) -> str:
+    """포인트 1건을 코퍼스 블록으로. Evidence 는 인용 토큰을 부여해 registry 에 등록한다."""
+    lines = [f"### 포인트 [{point.id}]: {point.title} (프로젝트: {point.project})"]
+    if point.tags:
+        lines.append(f"- 태그: {', '.join(point.tags)}")
+    if point.summary:
+        lines.append(f"- 요약: {point.summary}")
+
+    sec = point.sections
+    labeled = [
+        ("배경", sec.background),
+        ("문제", sec.problem),
+        ("결정과 근거", sec.decision),
+        ("실행", sec.execution),
+        ("결과", sec.result),
+        ("회고", sec.retrospective),
+    ]
+    for title, body in labeled:
+        if body:
+            lines.append(f"- {title}: {body}")
+
+    if sec.options:
+        lines.append("- 고려한 옵션:")
+        for o in sec.options:
+            cells = [
+                x for x in (o.option, o.pros, o.cons, o.cost, o.adopted) if x
+            ]
+            lines.append(f"  - {' | '.join(cells)}")
+
+    if point.evidence:
+        lines.append("- 근거(Evidence) — 인용 시 아래 토큰을 사용:")
+        for ev in point.evidence:
+            counter[0] += 1
+            token = f"E{counter[0]}"
+            evidence[token] = Citation(kind=ev.kind, label=ev.label, url=ev.url)
+            lines.append(f"  - [[{token}]] kind={ev.kind} | {ev.label} | {ev.url}")
+
+    return "\n".join(lines)
+
+
+def build_corpus(context_point_id: str | None = None) -> CorpusBundle:
+    """published 전체를 load-all 해 캐시 가능한 컨텍스트로 조립한다.
+
+    context_point_id(진입 맥락)가 있으면 그 포인트를 코퍼스 맨 앞에 '가장 관련 있는
+    포인트'로 우선 배치한다(기능_답변생성.md). 없는/비공개 맥락이면 무시한다.
+    """
+    evidence: dict[str, Citation] = {}
+    counter = [0]
+    blocks: list[str] = []
+    point_count = 0
+
+    priority_id: str | None = None
+    if context_point_id:
+        priority = point_service.get_published(context_point_id)
+        if priority is not None:
+            priority_id = priority.id
+            blocks.append("# 가장 관련 있는 포인트(진입 맥락)")
+            blocks.append(_render_point(priority, evidence, counter))
+            point_count += 1
+
+    blocks.append("# 전체 포트폴리오 코퍼스")
+    for proj in project_service.list_projects():
+        idx = project_service.get_index(proj.slug)
+        if idx is None:
+            continue
+        blocks.append(_render_cover(idx))
+        for summ in point_service.list_by_project(proj.slug):
+            if summ.id == priority_id:
+                continue  # 맨 앞에 이미 넣음(중복 방지)
+            point = point_service.get_published(summ.id)
+            if point is None:
+                continue
+            blocks.append(_render_point(point, evidence, counter))
+            point_count += 1
+
+    text = "\n\n".join(blocks)
+    if len(text) > _BUDGET_WARN_CHARS:
+        logger.warning(
+            "load-all 코퍼스가 예산 경고 임계치 초과(%d자) — v1 은 그대로 시도하되 "
+            "RAG(v3) 도입 신호로 본다(티켓 §6).",
+            len(text),
+        )
+    return CorpusBundle(text=text, evidence=evidence, point_count=point_count)
+
+
+def build_point_context(point_id: str) -> str | None:
+    """제안질문 생성용: 단일 포인트 핵심 섹션(제목·요약·문제·결정과 근거) 컨텍스트.
+
+    없거나 비공개(published 아님)면 None(호출측이 빈 배열로 폴백).
+    """
+    point = point_service.get_published(point_id)
+    if point is None:
+        return None
+    lines = [f"제목: {point.title}"]
+    if point.summary:
+        lines.append(f"요약: {point.summary}")
+    if point.sections.problem:
+        lines.append(f"문제: {point.sections.problem}")
+    if point.sections.decision:
+        lines.append(f"결정과 근거: {point.sections.decision}")
+    return "\n".join(lines)
diff --git a/backend/app/chat/models.py b/backend/app/chat/models.py
new file mode 100644
index 0000000..c6363c3
--- /dev/null
+++ b/backend/app/chat/models.py
@@ -0,0 +1,51 @@
+"""be/chat DTO (Pydantic). API 직렬화 키 케이스 = camelCase (ARCHITECTURE §5).
+
+계약 근거: tickets/be/0003-be-chat.md §5 · docs/be/chat/데이터.md.
+- Citation = { kind, label, url }              (be/point evidence.kind 재사용)
+- Turn     = { role, text, citations[] }
+- ChatRequest = { question, context?: pointId }
+- Session  = { sessionId, context, turns[], createdAt, expiresAt }  (내부 저장용)
+
+camelCase 직렬화 규약(CamelModel)은 be/point 공개 모델을 그대로 재사용한다
+(단일 API 계약 유지 — 읽기 재사용, be/point 내부는 수정하지 않는다).
+"""
+
+from __future__ import annotations
+
+from app.point.models import CamelModel
+
+
+class Citation(CamelModel):
+    """답변이 인용한 근거 1건. be/point Evidence(kind·label·url)를 그대로 참조한다."""
+
+    kind: str  # commit | pr | swagger | file | link (be/point evidence.kind 재사용)
+    label: str
+    url: str
+
+
+class Turn(CamelModel):
+    """대화 한 턴. assistant 턴만 citations 를 채운다(user 턴은 빈 배열)."""
+
+    role: str  # user | assistant
+    text: str
+    citations: list[Citation] = []
+
+
+class ChatRequest(CamelModel):
+    """POST /api/chat 요청 바디. session_id 는 세션 쿠키로 별도 수신(바디에 없음)."""
+
+    question: str
+    context: str | None = None  # 진입 맥락 = 보던 포인트 id 또는 null(무맥락)
+
+
+class Session(CamelModel):
+    """대화 세션 1묶음(데이터.md#대화세션). Redis 에 JSON 으로 직렬화 저장한다.
+
+    expires_at 은 표시·감사용이며 실제 만료는 Redis TTL(sliding)이 강제한다.
+    """
+
+    session_id: str
+    context: str | None = None
+    turns: list[Turn] = []
+    created_at: str
+    expires_at: str
diff --git a/backend/app/chat/router.py b/backend/app/chat/router.py
new file mode 100644
index 0000000..4ca5643
--- /dev/null
+++ b/backend/app/chat/router.py
@@ -0,0 +1,78 @@
+"""be/chat FastAPI 라우터 (티켓 §5, ARCHITECTURE §5 SSE).
+
+- POST /api/chat            : SSE 스트리밍 답변. session_id 는 세션 쿠키로 수신,
+
…(잘림)
