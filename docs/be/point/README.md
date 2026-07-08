---
kind: be
status: not-started
pattern: TS               # arch 확정 (트랜잭션 스크립트)
depends: []               # be/point는 말단(sink) — 다른 도메인을 읽지 않음
# --- implement.ps1 헤드리스 백엔드용 (선택) ---
branch: feat/be-point
base: main
engine: codex
---

# be/point

*포폴 포인트(2계층) 1개의 데이터 모델/양식(STAR+ADR 9섹션 + 근거 필수 필드)과 위키 파일 저장·발행 status(draft↔published)를 소유한다. 위키의 핵심 콘텐츠 단위.*

## 구성
- [데이터.md](데이터.md) — 포폴포인트(M) + Evidence(근거) + status enum
- [기능_추천포인트목록조회.md](기능_추천포인트목록조회.md) — 랜딩 상단 추천 published 포인트 목록 (fe/browse 랜딩)
- [기능_포인트목록조회.md](기능_포인트목록조회.md) — project 기준 published 포인트 목록 (프로젝트인덱스 · 같은 프로젝트 다른 포인트)
- [기능_포인트단건조회.md](기능_포인트단건조회.md) — id 기준 published 포인트 단건(9섹션+Evidence) (포인트상세)

## 패턴 (BE 도메인만)
- 채택: **TS(트랜잭션 스크립트)** — 파일 파싱→DTO 조회 + 발행 게이트 검증은 얇은 절차적 규칙이라 도메인 모델 불필요. ([ARCHITECTURE §4](../../arch/ARCHITECTURE.md))

## 책임지지 않는 것
- **프로젝트 표지(index 1계층) 데이터·프로젝트 목록** — be/project. 여기선 개별 포인트만.
- **챗봇 컨텍스트 로드·응답** — be/chat이 published 포인트를 읽어 감(be/chat→be/point).
- **화면·플로우·빈 상태 표현** — fe/browse.
- **포인트 저작(인터뷰·근거 강제 기재)** — pofol(로컬·구독). 여기선 데이터 모델·조회만.
