# 포트폴리오 + LLM Wiki 에이전트 — 리서치 노트

> 작성일: 2026-06-26
> 초점: 채용자-쪽 경험·웹사이트 (하이브리드 둘러보기+챗봇, 기술/비기술 채용자 둘 다)
> 기반 기획: [포폴-목차-설계.md](../포폴-목차-설계.md)
> 방법: 데스크 조사(WebSearch/WebFetch) 3트랙 병렬. 모든 외부 수치·사실에 출처. **우리가 정할 프로젝트 값은 여전히 슬롯.**

---

## 1. 시장·경쟁

### 1.1 유사 제품·솔루션

**포트폴리오 챗봇 / "나와 대화하는 포트폴리오"**
- **smart-portfolio** (medevs) — Next.js 15 + RAG(pgvector+LangChain+OpenAI). TS 설정 파일·Markdown 임베딩. **git 분석 없음**. [GitHub](https://github.com/medevs/smart-portfolio)
- **anujjainbatu/portfolio** — JSON 1개 편집 → Gemini 챗봇 자동 생성. 수동 설정 전용. [GitHub](https://github.com/anujjainbatu/portfolio)
- **source-persona** (해커톤, 종료) — 음성 AI 트윈. Gemini + Neural TTS. **HR/Tech Lead 모드 전환 + Seniority Slider** 구현. PDF 이력서 + GitHub JSON. 단 커밋 해시 인용·트레이드오프 구조 없음. [DEV](https://dev.to/vero-code/source-persona-ai-twin-md9)
- **Chatfolio** — 이력서 업로드 → 챗봇 SaaS. git 없음. 서비스 종료/인수 가능성. [Dang.ai](https://dang.ai/tool/ai-chatbot-for-portfolio-websites-chatfolio)

**git 히스토리 → 포폴/서사 자동 생성**
- **GitStory** — 커밋 → 서사 엔터테인먼트(애니메/셰익스피어). Claude 3.5. 채용자 Q&A·트레이드오프 없음. [Devpost](https://devpost.com/software/gitstory)
- **GitFolio AI** / **Gitfolio(dcoder)** — GitHub 프로필 → 정적 포폴 사이트. 통계·언어 감지 수준. 챗봇·의사결정 이유 없음. [GitFolio](https://www.gitfolio.site/) · [Gitfolio](https://gitfolio.dcoder.io/)
- **GitResume** — multi-agent, 역할 감지 94% 주장. GitHub API rate limit·monorepo 취약. 챗봇 없음. [Devpost](https://devpost.com/software/gitresume-transform-your-github-into-professional-analysis)
- **readme-ai** — repo → README 자동 생성. [GitHub](https://github.com/eli64s/readme-ai)

**채용자 측(공급자) 도구**
- **Prog.ai** — GitHub 커밋 분석 + LinkedIn 매칭으로 개발자 스킬 추론. 연 10억 커밋 처리. Free~$530/월. **후보를 찾는 도구**(개발자 본인의 포폴 챗봇 아님). [TechCrunch](https://techcrunch.com/2023/03/03/prog-ai-wants-to-help-recruiters-find-technical-talent-by-inferring-skills-from-github-code/)

**관련 연구·패턴**
- **Karpathy LLM Wiki** (2026 gist, 5,000+ stars) — RAG 대신 LLM이 위키를 읽고 갱신·축적. [Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) · [해설](https://www.mindstudio.ai/blog/karpathy-llm-wiki-knowledge-base-pattern)
- **Lore Protocol** (arXiv) — 커밋을 "결정 기록(Decision Shadow=버려진 대안·제약)"으로 구조화. 이 공백을 메우는 포폴 제품은 미발견. [arXiv](https://arxiv.org/abs/2603.15566)

### 1.2 차별점·빈틈 (시장 공백)
- **공백 A — "왜 그 결정을 했는가"를 답하는 제품이 없다.** 조사한 모든 포폴 챗봇은 "무엇을 했다(What)"만 답함. 트레이드오프(Why)를 구조화 보유·응답하는 제품 미발견.
- **공백 B — git diff/커밋을 직접 출처로 인용하는 챗봇이 없다.** source-persona도 GitHub JSON 참조일 뿐 커밋 해시/PR 인용 구조 아님.
- **공백 C — git 분석 + HITL(개발자 승인) 루프 결합 제품이 없다.** 기존 도구는 분석→자동 출력 단방향.
- **공백 D — 기술/비기술 적응형 응답 프로덕션 제품이 드물다.** source-persona가 모드 전환을 했으나 해커톤·종료.

### 1.3 채용자 페인
- **P1 스크리닝 시간 압박** — 초기 이력서 검토 평균 11.2초(과거 "6초"의 업데이트). [StandoutCV](https://standout-cv.com/usa/stats-usa/how-long-recruiters-spend-looking-at-resume)
- **P2 AI 생성 이력서 급증 → 업무 증가** — 채용자 64%가 유사 AI 이력서 급증 경험, 스크리닝 부담 증가. [HeroHunt](https://www.herohunt.ai/blog/ai-adoption-in-recruiting-2025-year-in-review/)
- **P3 역량 진위 검증 어려움** — 56%가 AI 스크리닝이 자격자를 거를까 우려. [Truffle](https://www.hiretruffle.com/blog/best-ai-recruitment-statistics)
- **P4 AI 출력물 신뢰 부족** — 채용 관리자 54%가 AI 생성 자료 우려, 미국 성인 66%가 AI 채용 결정 시 지원 기피. [DemandSage](https://www.demandsage.com/ai-recruitment-statistics/)
- **P5 기술직 채용 장기화** — 엔지니어링 평균 62일. 70%가 부적격 지원자 지속 유입 보고. [HackerEarth](https://www.hackerearth.com/blog/10-best-technical-screening-services-to-evaluate-developer-skills-in-2026)
- **P6 포폴에서 "왜"를 못 찾는다** — AI 부정행위 급증으로 대면 면접 비중 24%(2022)→38%(2025). 포폴 단계에서 판단력·트레이드오프 확인 수단 부재. [InterviewQuery](https://www.interviewquery.com/p/ai-interview-trends-tech-hiring-2025)

### 1.4 가설 검증 (H1~H3)
- **H1(근거 기반 답변이 차별점)** — 근거: AI 출력 불신 통계(P4), NotebookLM 사례(소스 접지 환각 ~13% vs 미접지 ~40%), Air Canada 챗봇 법적 패소(무근거 답변 책임). **반증/단서:** "포폴 챗봇 환각→채용자 이탈"의 정량 데이터는 없음 → 1차 조사 필요.
- **H2(시장 빈틈)** — 근거 강함: 조사 제품 전부 수동 설정·git 미접지·트레이드오프 부재. Lore Protocol이 "커밋은 Decision Shadow를 버린다" 명시. **단서:** 빈틈이 "미수요"인지 "미공급"인지 구분 필요. 채용자가 실제로 커밋 링크를 클릭하는지 행동 데이터 없음.
- **H3(하이브리드가 더 맞다)** — 정황 근거: 채용자는 About→프로젝트 순 수동 탐색 + 선택적 심화 선호. 비기술 채용자는 구조화 탐색 + 필요 시 질문 선호 시사. **단서:** chat-only vs 하이브리드 직접 비교 UX 연구 없음.

### 1.5 거시 환경 (PEST/5Forces 요약)
- **시장규모:** AI 이력서 스크리닝/매칭 $1.62B(2025)→$4.16B(2031), 17% CAGR. 포폴 챗봇은 후보자 측 틈새. [Mordor](https://www.mordorintelligence.com/industry-reports/ai-resume-screening-and-matching-market)
- **사회:** AI 생성물 범람으로 "진짜 증거"의 신호가치 상승. 87% 기업이 AI 리크루팅 도구 사용.
- **기술:** LLM Wiki 패턴 공통 언어화, 컨텍스트 창 1M 확대로 "전체 위키 로딩" 비용 현실화.
- **경쟁강도:** 진입 장벽 낮음(개인 1~2일 MVP), 프로덕션급 상업 제품은 드묾. 구매자(채용자) 사용 비용 0 → 교섭력 높음.

---

## 2. 외부 API·자원

### 2.1 Git 저장소 접근
- **로컬 blobless clone** (`--filter=blob:none`) — 커밋 트리·메타만 받고 `git log`는 full과 동일 성능. 레이트리밋 없음. Pass1(`git log --oneline` 전체, ~50KB) 일괄 읽기에 최적. [GitHub Blog](https://github.blog/open-source/git/get-up-to-speed-with-partial-clone-and-shallow-clone/)
- **GitHub REST API** — PAT 5,000 req/h, 커밋 `per_page` 최대 100. 3,000커밋 로그 ~30회 호출(범위 내). 변경 300파일 초과 커밋은 diff 페이지네이션·타임아웃 위험. [Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- **GraphQL** — 인증 필수, 5,000점/h, 2,000점/분.
- **GitHub MCP 서버** (공식, MIT/Apache) — REST 5,000 RPH 상속, 자체 스로틀 없음 → 에이전트 자동 순회 시 할당량 소진 위험, 백오프 필수. [GitHub](https://github.com/github/github-mcp-server)

### 2.2 LLM API — Claude (Anthropic)
| 모델 | 컨텍스트 | 입력 $/MTok | 출력 $/MTok |
|---|---|---|---|
| Opus 4.8 | 1M | $5 | $25 |
| Sonnet 4.6 | 1M | $3 | $15 |
| Haiku 4.5 | 200k | $1 | $5 |
- **프롬프트 캐싱:** 캐시 히트 시 입력가 0.1배(90% 절감). 위키가 자주 안 바뀌면 챗봇 비용 급감. [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- **Batch API:** 비동기 50% 할인 → Git/Wiki Agent 배치 갱신에 적합.
- **Agent SDK** — Python/TS, 서브에이전트(독립 컨텍스트) 내장, MCP 클라이언트 내장. [Docs](https://code.claude.com/docs/en/agent-sdk/overview)
- 50K 토큰 위키 가정 시 Sonnet 입력 $0.15/회, 캐시 히트 $0.015/회.

### 2.3 한국어 임베딩 (LLM Wiki는 기본 불필요 — 위키 초과 시점에 필요)
- **BGE-M3** (MIT, 무료) — 1,024차원, 8,192토큰 입력, Dense+Lexical+ColBERT 통합, MIRACL 한국어 포함. 다국어 최선 후보. [HF](https://huggingface.co/BAAI/bge-m3)
- **multilingual-e5-large** (MIT) — 1,024차원, Mr.TyDi 한국어 MRR@10 62.5. [HF](https://huggingface.co/intfloat/multilingual-e5-large)
- **상용:** OpenAI text-embedding-3-large($0.13/MTok, 3072d 축소가능), Cohere embed-v4($0.12/MTok, 128k컨텍스트, 한국어 포함).

### 2.4 벡터 저장 (필요 시)
- **pgvector** (MIT) — Postgres 있으면 추가비용 0. 소규모 최적.
- **sqlite-vec** (MIT/Apache) — 단일파일 최경량, 외부 서버 불필요.
- **LanceDB** (Apache 2.0) — 임베디드/서버리스.

### 2.5 호스팅
| 플랫폼 | 정적 무료 | 챗봇 백엔드 | 슬립 | 메모 |
|---|---|---|---|---|
| Vercel Hobby | 무제한 | 가능(함수 300s) | 없음 | Next.js 최적, 상업용은 Pro $20/월 |
| Cloudflare Pages+Workers | 무제한 | Workers 무료(제한적) | 없음 | 엣지 |
| Render Free | 무제한 | 가능 | 15분 비활성 슬립 | DB 30일 만료 |
- [Vercel Limits](https://vercel.com/docs/functions/limitations) — Fluid Compute로 Hobby도 함수 300s(구형 "60초" 정보는 오래됨). LLM 대기 시간은 CPU 활성 시간 미포함.

### 2.6 검색 보강 (나중 단계)
- FlashRank(Apache, 4~150MB), rank_bm25, BGE-reranker(MIT). LLM Wiki Stage0/1에선 불필요.

---

## 3. 기술 타당성

### 3.1 LLM Wiki — 가능하나 규모 상한 존재
- 정보가 제한·구조화된 포폴 도메인엔 적합. **깨지는 지점:** ~10M 토큰 초과 시 RAG 필요(수백~수천 문서까지는 위키 유효). [MindStudio](https://www.mindstudio.ai/blog/karpathy-llm-wiki-pattern-knowledge-base-without-rag)
- **Context Rot(Chroma 2025):** 200K 윈도우 모델도 **~50K 토큰부터 성능 저하**, 정보가 중간에 있으면 정확도↓(U자형). Opus 4가 가장 느린 저하. → **위키를 50K 토큰 이하로 유지**하면 안전 구간. [Chroma](https://www.trychroma.com/research/context-rot)
- **신선도:** "오래된 정보는 정보 없음보다 나쁘다" — 갱신 루프 필수. 인간 큐레이션 전제.

### 3.2 대량 git 분석 — 2-Pass + 증분은 검증된 패턴
- 대형 repo는 5,600만~6,900만 토큰 → 모든 컨텍스트 초과. 필터링 시 ~180만으로 압축. [GitIngest 분석](https://www.blopig.com/blog/2025/09/understand-large-codebases-faster-using-gitingest/)
- 실측: 143커밋 1회 호출 ~$0.05. `git log --oneline` 선별 → 선택 diff만 조회 합리적. [사례](https://brtkwr.com/posts/2026-03-02-rewriting-git-history-with-llm-conventional-commits/)
- 증분: GCC(arXiv 2508.00031) — `commit.md`+해시 체크포인트로 마지막 처리 지점 복원 검증.
- diff 직접 입력 비효율 → 파싱 레이어 분리 권장. 환각: 큰 diff에서 컨텍스트 로트로 중간 커밋 누락 위험.
- **기존 도구:** GitSummarize, git-ai-summarize(Claude 기반 OSS), Repomix(MIT, 26K stars, 토큰효율 패킹). 단 포폴 서사 특화는 직접 구현 필요.

### 3.3 에이전트 오케스트레이션
- Claude Agent SDK 멀티에이전트 공식 지원(`managed-agents` 베타). 코디네이터-서브에이전트, 병렬/순차/전문화. 단일 depth 위임, 세션당 25 스레드. 에이전트 간 컨텍스트 비공유(파일시스템·자격증명만 공유). [Docs](https://platform.claude.com/docs/en/managed-agents/multi-agent)
- **파일 드랍 트리거:** Claude Code Hooks는 Claude 세션 내 이벤트용. **OS 레벨 폴더 감시(파일 드랍 발동)는 외부 watcher(Python watchdog / Node chokidar) + API 호출 조합 필요** — 순수 Hooks만으로는 불명확. [Hooks](https://code.claude.com/docs/en/hooks-guide)
- Git/Wiki/Chatbot 3단 구성은 공식 권장 패턴과 부합. MCP 권한을 에이전트별로 세밀 제어 가능.

### 3.4 HITL 승인
- **Collaborative Drafting** best practice: 에이전트가 CONFIDENT/UNCERTAIN/PLACEHOLDER 구역 표시 초안 → 인간 편집. 편집이 단순 승인/거부보다 품질 42%↑(MS Research 인용). [HITL 패턴](https://dev.to/taimoor__z/-human-in-the-loop-hitl-for-ai-agents-patterns-and-best-practices-5ep5)
- **Approval Gate:** 되돌릴 수 없는 액션 전 명시 승인.
- 구현: Claude SDK `requires_action`(저빈도 포폴에 도입 비용 낮음) vs LangGraph `interrupt()`(성숙, 영속 체크포인트, 버그 #6208 주의).
- 이는 §포폴-목차-설계의 `draft → approved` status 상태머신·🤖/✍️ 출처 표기와 정확히 맞물림.

### 3.5 Build vs Buy 요약
| 레이어 | Buy 후보 | Build |
|---|---|---|
| 위키 저작 | 없음(패턴만) | 마크다운 + Claude API |
| Git 분석 | GitSummarize, git-ai-summarize, Repomix(패킹) | 2-Pass + 증분 직접 |
| 오케스트레이션 | Claude Agent SDK | LangGraph |
| 파일 드랍 트리거 | — | watchdog/chokidar + API |
| HITL | LangGraph interrupt | Claude SDK requires_action |
| RAG 서빙 | LlamaIndex/LangChain | 직접(Stage0이면 불필요) |

---

## 4. 시사점 (거시 목표에 주는 함의 — 우리 값은 여전히 슬롯)

1. **차별점이 시장 공백과 정확히 일치.** 우리 설계의 "옵션·결정·근거(트레이드오프)" + "커밋/PR Evidence 인용" + "git 분석→HITL 승인 루프"는 공백 A·B·C를 정면으로 메운다. → 거시 가치 명제로 채택 가치 큼.
2. **신뢰가 핵심 가치 축.** 채용자 페인 P4·P6 + NotebookLM 근거 데이터가 "근거 기반 답변"을 핵심 가치로 지지(H1). Evidence 인용을 챗봇 답변의 1급 시민으로.
3. **위키를 작게 유지하는 게 기술 제약이자 설계 원칙.** Context Rot은 ~50K 토큰부터 → §검색/서빙 설계의 Stage0(load-all) 임계치는 *기술 근거가 있는 슬롯*. 정확한 임계 비율은 `[입력 필요]`.
4. **하이브리드+적응형이 빈 시장.** H3 정황 근거 + source-persona(종료)의 모드 전환 선례 → 기술/비기술 적응형 응답 UX가 차별점이나, 직접 검증 데이터는 없음(1차 조사 대상).
5. **MVP 비용·인프라 현실적.** 로컬 blobless clone + Claude(캐싱·배치) + Vercel Hobby + Stage0 load-all이면 임베딩/벡터DB 없이 시작 가능. 임베딩·리랭커는 위키가 50K 토큰 넘는 시점의 슬롯.
6. **자동 트리거는 재검토 필요.** "폴더 드랍 시 자동 발동"은 순수 Hooks로 불명확 → 외부 watcher 필요 or CLI 명령 트리거로 단순화 가능(미결 사항과 연결).

### 미해소·1차 조사 필요
- 포폴 챗봇 환각→채용자 이탈 정량 데이터 없음 (H1 직접검증)
- 채용자 커밋 링크 클릭률·행동 데이터 없음
- chat-only vs 하이브리드 비교 UX 연구 없음 (H3)
- LLM Wiki 갱신 비용 실측·포폴 위키의 Context Rot 특화 데이터 없음
- Claude Agent SDK 멀티에이전트 베타 GA 일정 미확인
