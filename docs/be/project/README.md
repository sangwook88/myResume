---
kind: be
status: not-started
pattern:                  # arch가 채움 (TS/DM)
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
*ARCHITECTURE §패턴 정책 기본값. arch가 채운다.*
- 채택: *[입력 필요: arch에서 결정 — TS/DM + 왜]*

## 책임지지 않는 것
- **개별 포폴 포인트(2계층) 데이터·발행 status** — be/point. 여기선 표지 + 포인트 *목록 조립*만(목록은 be/point에서 파생).
- **챗봇 컨텍스트 로드·응답** — be/chat이 표지를 읽어 감(be/chat→be/project).
- **화면·플로우·빈 상태 표현** — fe/browse.
- **표지 저작(인터뷰·근거)** — grill-me(로컬·구독).
