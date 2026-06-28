---
kind: fe
status: in-progress
pattern:
depends: [be/point, be/chat]
# --- implement.ps1 헤드리스 백엔드용 (선택, Agent 병렬이면 비워둬도 됨) ---
branch: feat/fe-browse
base: main
engine: codex
---

# fe/browse

*채용자가 렌더된 위키(published 포인트)를 둘러보는 화면. 랜딩(추천 포인트+프로젝트) → 프로젝트 인덱스 → 포폴 포인트 상세 3계층 + 전역 챗봇 진입(FAB).*

## 구성
- [플로우.md](플로우.md) — 화면 전이 + FE 전체 값
- [요소/랜딩.md](요소/랜딩.md) — 상단 추천 포인트 + 하단 프로젝트 목록
- [요소/프로젝트-인덱스.md](요소/프로젝트-인덱스.md) — 한 프로젝트의 index.md 렌더(요약·역할·스택·아키텍처·성과·포인트 목록)
- [요소/포폴-포인트-상세.md](요소/포폴-포인트-상세.md) — 포폴 포인트 1개의 9섹션(STAR+ADR) + Evidence 렌더

## 패턴 (BE 도메인만)
*FE 도메인이므로 비움.*

## 책임지지 않는 것
- **챗봇 대화 자체** — fe/chat 도메인. 여기선 전역 FAB로 *진입구*만 연다.
- **포인트 데이터 모델·발행 status·로드** — be/point. 여기선 호출(링크)만.
- **챗봇 응답 엔진(load-all·근거 인용)** — be/chat.
- **인라인 텍스트 선택-질문** — v3로 연기(로드맵). v1 진입점은 전역 FAB 단독.
