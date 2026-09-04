<!-- 자동 생성(scripts/publish.py) — 챗봇 코퍼스 전용 invidence.code. 직접 편집 금지. -->

## [[E1]]
diff --git a/.gitignore b/.gitignore
index 55fe5f7..fde4305 100644
--- a/.gitignore
+++ b/.gitignore
@@ -1,2 +1,7 @@
 # fe-be-ddd 인스톨러가 남기는 백업 (이식 불필요)
 .claude/.fe-be-ddd-backups/
+
+# Python 아티팩트
+__pycache__/
+*.pyc
+.venv/
diff --git a/backend/app/__init__.py b/backend/app/__init__.py
new file mode 100644
index 0000000..407edee
--- /dev/null
+++ b/backend/app/__init__.py
@@ -0,0 +1 @@
+# FastAPI 백엔드 앱 패키지 루트.
diff --git a/backend/app/main.py b/backend/app/main.py
new file mode 100644
index 0000000..109594f
--- /dev/null
+++ b/backend/app/main.py
@@ -0,0 +1,20 @@
+"""FastAPI 앱 팩토리·엔트리포인트.
+
+실행: `cd backend && uvicorn app.main:app --reload`
+도메인 라우터를 여기서 등록한다(현재 be/point. 후속 wave에서 be/project·be/chat 추가).
+"""
+
+from __future__ import annotations
+
+from fastapi import FastAPI
+
+from app.point.router import router as point_router
+
+
+def create_app() -> FastAPI:
+    app = FastAPI(title="근거기반 포트폴리오 API", version="0.1.0")
+    app.include_router(point_router)
+    return app
+
+
+app = create_app()
diff --git a/backend/app/point/__init__.py b/backend/app/point/__init__.py
new file mode 100644
index 0000000..a8aad2c
--- /dev/null
+++ b/backend/app/point/__init__.py
@@ -0,0 +1 @@
+# be/point 도메인: 포폴 포인트 데이터 모델·조회 API·발행 게이트.
diff --git a/backend/app/point/models.py b/backend/app/point/models.py
new file mode 100644
index 0000000..f4906c5
--- /dev/null
+++ b/backend/app/point/models.py
@@ -0,0 +1,64 @@
+"""be/point DTO (Pydantic). API 직렬화 키 케이스 = camelCase (ARCHITECTURE §5).
+
+계약 근거: tickets/be/0001-be-point.md §5.
+- PointSummary = { id, title, tags, project }
+- Point = PointSummary + { summary, sections{...}, evidence[] }
+"""
+
+from __future__ import annotations
+
+from pydantic import BaseModel, ConfigDict
+from pydantic.alias_generators import to_camel
+
+
+class CamelModel(BaseModel):
+    """모든 DTO의 공통 설정: JSON 직렬화 키는 camelCase(별칭), 내부 필드는 snake_case."""
+
+    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
+
+
+class Evidence(CamelModel):
+    """근거 링크 1건 (데이터.md#evidence). 포인트당 1개 이상 필수(발행 게이트)."""
+
+    kind: str  # commit | pr | swagger | file | link
+    label: str
+    url: str
+
+
+class Option(CamelModel):
+    """'고려한 옵션' 표의 한 행 (데이터.md §4, 고정 컬럼 옵션·장점·단점·비용/리스크·채택)."""
+
+    option: str | None = None
+    pros: str | None = None
+    cons: str | None = None
+    cost: str | None = None
+    adopted: str | None = None
+
+
+class Sections(CamelModel):
+    """9섹션 본문 중 프론트매터·요약을 뺀 나머지. 선택 섹션은 비면 None(응답에서 생략)."""
+
+    background: str | None = None
+    problem: str | None = None
+    options: list[Option] | None = None
+    decision: str | None = None
+    execution: str | None = None
+    result: str | None = None
+    retrospective: str | None = None
+
+
+class PointSummary(CamelModel):
+    """목록·추천용 요약 카드."""
+
+    id: str
+    title: str
+    tags: list[str]
+    project: str
+
+
+class Point(PointSummary):
+    """단건 조회 전체: 요약 + 9섹션 본문 + Evidence."""
+
+    summary: str
+    sections: Sections
+    evidence: list[Evidence]
diff --git a/backend/app/point/repository.py b/backend/app/point/repository.py
new file mode 100644
index 0000000..8999ac3
--- /dev/null
+++ b/backend/app/point/repository.py
@@ -0,0 +1,216 @@
+"""be/point 리포지토리: wiki/<project>/<id>.md 마크다운을 파싱해 raw dict로 로드.
+
+파일 구조 (데이터.md):
+- frontmatter YAML: id·title·project·status·tags·commits·updated
+- 본문 9섹션(H2 헤딩): 제목·요약 / 배경 / 문제 / 고려한 옵션(표) / 결정과 근거 /
+  실행 / 결과 / 회고 / Evidence(표)
+
+be/project 소유인 `index.md`는 이 도메인 대상이 아니므로 스캔에서 제외한다.
+콘텐츠 루트는 리포 루트의 `wiki/` (WIKI_ROOT 환경변수로 재정의 가능 — 검증용).
+
+이 모듈은 순수 파싱만 한다(Pydantic 미의존). DTO 조립은 service가 담당하고,
+발행 게이트(publish_errors)는 scripts/publish.py가 재사용한다.
+"""
+
+from __future__ import annotations
+
+import os
+import re
+from pathlib import Path
+from typing import Iterator
+
+import yaml
+
+# repository.py = backend/app/point/repository.py → parents[3] = 리포 루트
+_DEFAULT_WIKI = Path(__file__).resolve().parents[3] / "wiki"
+WIKI_ROOT = Path(os.environ.get("WIKI_ROOT", str(_DEFAULT_WIKI)))
+
+# 본문 텍스트 섹션(표가 아닌 것). options/evidence는 표라 별도 처리.
+_TEXT_SECTIONS = ("background", "problem", "decision", "execution", "result", "retrospective")
+
+# 표 컬럼 → DTO 필드 키워드 매핑(부분일치, 앞 항목 우선).
+_OPTION_COLS = [
+    ("옵션", "option"),
+    ("장점", "pros"),
+    ("단점", "cons"),
+    ("비용", "cost"),
+    ("리스크", "cost"),
+    ("채택", "adopted"),
+]
+_EVIDENCE_COLS = [
+    ("kind", "kind"),
+    ("종류", "kind"),
+    ("label", "label"),
+    ("라벨", "label"),
+    ("url", "url"),
+    ("링크", "url"),
+]
+
+
+def _canonical_heading(text: str) -> str | None:
+    """헤딩 문자열 → 9섹션 정규 키(부분일치). 인식 못 하면 None."""
+    t = text.strip()
+    tl = t.lower()
+    if "evidence" in tl:
+        return "evidence"
+    if "결정" in t:  # 결정과 근거 (주의: '근거' 단독으로 매칭하면 Evidence와 충돌)
+        return "decision"
+    if "요약" in t:  # 제목·요약 / 요약
+        return "summary"
+    if "배경" in t:
+        return "background"
+    if "고려" in t or "옵션" in t:  # 고려한 옵션
+        return "options"
+    if "문제" in t:
+        return "problem"
+    if "실행" in t:
+        return "execution"
+    if "결과" in t:
+        return "result"
+    if "회고" in t:
+        return "retrospective"
+    return None
+
+
+def _split_frontmatter(text: str) -> tuple[dict, str]:
+    """'---' 로 감싼 frontmatter YAML과 본문을 분리."""
+    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", text, re.DOTALL)
+    if not m:
+        raise ValueError("frontmatter('---' 블록)를 찾을 수 없음")
+    fm = yaml.safe_load(m.group(1)) or {}
+    if not isinstance(fm, dict):
+        raise ValueError("frontmatter가 매핑(YAML dict)이 아님")
+    return fm, m.group(2)
+
+
+def _parse_sections(body: str) -> dict[str, str]:
+    """본문을 헤딩 기준으로 섹션 정규키 → 원문 블록(텍스트)으로 분할."""
+    sections: dict[str, str] = {}
+    current: str | None = None
+    buf: list[str] = []
+    for line in body.splitlines():
+        h = re.match(r"^#{1,6}\s+(.*)$", line)
+        if h:
+            if current is not None:
+                sections[current] = "\n".join(buf).strip()
+            current = _canonical_heading(h.group(1))
+            buf = []
+        elif current is not None:
+            buf.append(line)
+    if current is not None:
+        sections[current] = "\n".join(buf).strip()
+    sections.pop(None, None)  # 인식 못 한 헤딩 아래 내용은 버림
+    return sections
+
+
+def _split_row(line: str) -> list[str]:
+    """마크다운 표 한 줄 → 셀 리스트."""
+    return [c.strip() for c in line.strip().strip("|").split("|")]
+
+
+def _map_col(header_cell: str, colmap: list[tuple[str, str]]) -> str | None:
+    h = header_cell.strip().lower()
+    for kw, key in colmap:
+        if kw.lower() in h:
+            return key
+    return None
+
+
+def _parse_table(block: str, colmap: list[tuple[str, str]]) -> list[dict]:
+    """마크다운 표 블록 → 행 dict 리스트(헤더 컬럼을 DTO 키로 매핑)."""
+    if not block:
+        return []
+    lines = [l for l in block.splitlines() if l.strip().startswith("|")]
+    if len(lines) < 2:
+        return []
+    keys = [_map_col(c, colmap) for c in _split_row(lines[0])]
+    rows: list[dict] = []
+    for line in lines[2:]:  # [1]은 구분선(---)
+        cells = _split_row(line)
+        if not any(c for c in cells):
+            continue
+        row = {k: c for k, c in zip(keys, cells) if k}
+        if row:
+            rows.append(row)
+    return rows
+
+
+def load_raw(path: Path) -> dict:
+    """마크다운 파일 1개 → raw dict(status 포함). 파싱 실패는 예외로 전파."""
+    text = path.read_text(encoding="utf-8")
+    fm, body = _split_frontmatter(text)
+    parsed = _parse_sections(body)
+
+    updated = fm.get("updated")
+    if hasattr(updated, "isoformat"):  # yaml이 date로 파싱한 경우
+        updated = updated.isoformat()
+
+    tags = fm.get("tags") or []
+    if isinstance(tags, str):
+        tags = [tags]
+
+    sections: dict = {}
+    for key in _TEXT_SECTIONS:
+        val = parsed.get(key)
+        if val:
+            sections[key] = val
+    options = _parse_table(parsed.get("options", ""), _OPTION_COLS)
+    if options:
+        sections["options"]
…(잘림)

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
