---
kind: be
status: not-started
pattern: TS               # arch 확정 (트랜잭션 스크립트)
depends: [be/point, be/project]   # load-all 코퍼스: published 포인트 + 프로젝트 표지
# --- implement.ps1 헤드리스 백엔드용 (선택) ---
branch: feat/be-chat
base: main
engine: codex
---

# be/chat

*챗봇 응답 엔진. published 코퍼스(포인트 + 프로젝트 표지)를 load-all해 질문에 근거와 함께 답하고, 맥락 기반 제안 질문을 만들며, 세션 단위 대화 이력을 보관한다. RAG 아님(v1=load-all).*

## 구성
- [데이터.md](데이터.md) — 대화세션(M, session_id·턴·TTL) + role enum. 코퍼스는 be/point·be/project 참조(소유 아님)
- [기능_답변생성.md](기능_답변생성.md) — 질문 → published load-all + 근거 인용, 스트리밍 (fe/chat 질문응답)
- [기능_제안질문생성.md](기능_제안질문생성.md) — 포인트 맥락 기반 제안 질문 (fe/chat 챗봇열림)
- [기능_세션이력관리.md](기능_세션이력관리.md) — session_id 기준 이력 로드·저장, TTL 1일 만료 (fe/chat 양 노드)

## 패턴 (BE 도메인만)
- 채택: **TS(트랜잭션 스크립트)** — load-all + 근거 인용 + 세션 관리는 LLM·스토어 오케스트레이션이지 도메인 불변식이 아니라 절차적 서비스로 구현. ([ARCHITECTURE §4](../../arch/ARCHITECTURE.md))

## 책임지지 않는 것
- **챗 화면·패널·스트리밍 렌더·근거 링크 클릭 이탈** — fe/chat. 여기선 데이터·응답만 생성.
- **포폴 포인트 데이터·발행 status** — be/point(읽기만).
- **프로젝트 표지 데이터** — be/project(읽기만).
- **무맥락 기본 제안 질문** — FE 정적 자원(맥락 제안 질문만 여기서 생성).
- **세션 id 발급 위치·쿠키 처리** — 전송 계약은 FE, 여기선 `session_id`로 이력을 키잉만.
