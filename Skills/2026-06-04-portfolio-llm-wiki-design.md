# 개발자 포트폴리오 + LLM WIKI 에이전트 시스템 — 브레인스토밍 (진행 중)

> 저장 일시: 2026-06-04  
> 상태: 브레인스토밍 중 (미완성 — 웹사이트 설계 이후 계속 이어서 진행)

---

## 프로젝트 개요

채용자가 포트폴리오 챗봇에게 질문을 던지면, 개발자가 실제로 한 작업 내역을 기반으로 정확하게 답변하는 시스템. RAG 대신 **LLM WIKI** 방식을 사용한다.

### LLM WIKI란?

Karpathy의 [원문](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)에 기반한 방식.

- **RAG**: 질문 시점마다 벡터 DB에서 관련 청크 검색 → LLM에 동적 주입
- **LLM WIKI**: 개발자 정보를 하나의 구조화된 위키 문서로 미리 정리 → LLM이 항상 전체 컨텍스트를 보유

핵심 차이점: 위키는 "축적되는 아티팩트"로, 새 정보가 들어올 때마다 LLM이 위키를 읽고, 이해하고, 갱신한다. 단순 청킹/검색이 아니라 지식이 쌓이는 구조.

---

## 폴더 구조

```
raw/
  <project-a>/            ← 이 폴더에 파일 넣으면 hook 발동
    git_analysis.md       ← Git Agent가 생성
    ci_cd.md              ← Git Agent (인프라 분석 결과)
    docs.md               ← 개발 문서 직접 드랍 가능
    ...
  <project-b>/
    ...

wiki/
  <project-a>.md          ← Wiki Agent가 유지·갱신
  <project-b>.md
  index.md                ← 전체 프로젝트 카탈로그
  log.md                  ← 인제스트·갱신 이력 (append-only)
```

### 동작 원칙
- `raw/`는 읽기 전용 inbox — LLM이 수정하지 않음
- `wiki/`는 Wiki Agent 전용 출력 — 다른 에이전트가 직접 쓰지 않음
- 어떤 Source Agent든 `raw/<project>/`에 파일만 넣으면 자동으로 wiki에 반영됨

---

## 에이전트 구성

| 에이전트 | 역할 | 입력 | 출력 |
|---|---|---|---|
| **Git Agent** | git 히스토리 + 인프라 파일 분석 | git repo 경로 | `raw/<project>/git_analysis.md` |
| **Wiki Agent** | raw 파일 읽고 wiki 갱신 | `raw/<project>/*` | `wiki/<project>.md`, `wiki/log.md` |
| **Orchestrator** | 언제 무엇을 실행할지 조율 | 이벤트/설정 | 각 에이전트 트리거 |
| **Chatbot** | wiki 읽고 채용자 질문 응답 | `wiki/` | 자연어 응답 |

### 설계 원칙
- Source Agents (Git Agent 등)는 `raw/`에만 기록 — wiki 직접 접근 금지
- Wiki Agent만 `wiki/`를 수정 — 단일 책임
- 나중에 Notion Agent, Jira Agent 등 추가 시 `raw/`에 파일만 넣으면 자동 연동

---

## Git Agent 상세 설계

### 핵심 문제
커밋 3000개의 diff를 전부 읽으면 토큰 재앙. 핵심만 골라 읽어야 한다.

### 해결 방식: A+C 하이브리드

**최초 실행 (Approach A — LLM-First 2패스)**
```
Pass 1 (저렴):
  git log --oneline 전체 (~3000개, ~50KB)
  → LLM이 클러스터 분류 + 고가치 커밋 선별 (top 50~100개)

Pass 2 (핀포인트):
  선택된 커밋만 diff 조회
  → 실제 변경 내용 분석
  → 포폴 포인트 후보 목록 생성

Pass 3 (인프라):
  .github/workflows/, Dockerfile, docker-compose.yml,
  migrations/, k8s/ 등 직접 읽기
  → CI/CD·서버·DB 관련 위키 항목 추출
```

**이후 갱신 (Approach C — 증분 처리)**
```
마지막 분석 커밋 해시 저장
→ 신규 커밋만 처리 (git log <last_hash>..HEAD)
→ 기존 git_analysis.md에 병합
→ Wiki Agent 자동 트리거
```

### Human-in-the-Loop
- Git Agent는 wiki를 직접 쓰지 않음
- 대신 "포폴 포인트 후보 목록"을 터미널에 출력
- 개발자가 검토·선택·편집 후 승인
- 승인된 내용만 `raw/<project>/git_analysis.md`에 저장
- Wiki Agent가 이를 감지해 wiki 갱신

---

## 구현 방향

- **에이전트 구현**: Claude Code / Agent SDK 기반
- **포트폴리오 웹사이트**: 미정 (에이전트 시스템 설계 완료 후 결정)

---

## 미결 사항

- [ ] 포트폴리오 웹사이트 프레임워크 결정 (Next.js / React+API / 정적 HTML 등)
- [ ] Orchestrator의 트리거 방식 상세 설계 (파일 watcher? cron? CLI 명령?)
- [ ] Wiki Agent의 갱신 전략 (전체 재작성 vs 섹션 단위 패치)
- [ ] Chatbot의 wiki 로딩 방식 (전체 포함 vs 프로젝트별 동적 선택)
- [ ] git repo 접근 방식 (로컬 clone? GitHub API? MCP?)
