---
kind: be
status: done
pattern: TS               # arch 확정 (트랜잭션 스크립트)
depends: [be/point]       # index의 포인트 목록을 be/point frontmatter 스캔으로 조립
# --- implement.ps1 헤드리스 백엔드용 (선택) ---
branch: feat/be-project
base: main
engine: codex
---

# be/project

*프로젝트 인덱스(1계층 표지) 데이터 모델과 프로젝트 카탈로그(목록)를 소유한다. 채용자가 "이 프로젝트 뭐예요?"에 먼저 보는 표지 — 요약·역할/기간/팀·기술스택·아키텍처 개요·핵심 성과. 근거: [포폴-목차-설계.md §3·§4](../../포폴-목차-설계.md).*

## 구성
- [데이터.md](데이터.md) — 프로젝트(index 표지)(M)
- [기능_프로젝트목록조회.md](기능_프로젝트목록조회.md) — 랜딩 하단 프로젝트 카탈로그 (fe/browse 랜딩)
- [기능_프로젝트인덱스조회.md](기능_프로젝트인덱스조회.md) — project 기준 표지 데이터 + published 포인트 목록 조립 (프로젝트인덱스)

## 패턴 (BE 도메인만)
- 채택: **TS(트랜잭션 스크립트)** — 표지 조회 + 포인트목록 조립은 거의 순수 조회라 절차적 함수로 충분. ([ARCHITECTURE §4](../../arch/ARCHITECTURE.md))

## 책임지지 않는 것
- **개별 포폴 포인트(2계층) 데이터·발행 status** — be/point. 여기선 표지 + 포인트 *목록 조립*만(목록은 be/point에서 파생).
- **챗봇 컨텍스트 로드·응답** — be/chat이 표지를 읽어 감(be/chat→be/project).
- **화면·플로우·빈 상태 표현** — fe/browse.
- **표지 저작(인터뷰·근거)** — grill-me(로컬·구독).
