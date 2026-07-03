# ARCHITECTURE — 근거기반 포트폴리오 (v1)

> 기획 QA·distill 완료 후 확정한 전역 기술·구조. [ticket](../../.claude/skills/ticket/SKILL.md)의 구조 근거.
> 범위: [roadmap](../roadmap.md) **v1**. 도메인 지도: [HOME](../HOME.md).
> v1 모델: 로컬(구독) 저작 → published 마크다운 위키 → 채용자 둘러보기 + load-all 챗봇(API).

## 1. 기술 스택

| 층 | 선택 | 근거 |
|---|---|---|
| FE 언어·프레임워크 | **TypeScript + Next.js** (React) | 채용자용 공개 위키라 SSG/SSR + SEO 필요. 콘텐츠 렌더 + 챗 스트리밍 island 한 스택. |
| BE 언어·프레임워크 | **Python + FastAPI** | LangChain 세션 메모리 생태계 성숙 + v3 RAG 확장 유리. |
| LLM | **Claude API — `claude-sonnet-5`, 스트리밍** | 근거기반 답변(be/chat). Opus급 품질에 저렴·빠름, 서빙 호출량에 유리. |
| LLM 오케스트레이션 | **LangChain (Python)** | 답변 생성 + 세션 대화 이력(`RedisChatMessageHistory` 류). |
| load-all 비용 대책 | **프롬프트 캐싱**(`cache_control`) | published 코퍼스는 크고 안정적인 prefix — 턴·사용자 간 캐시 재사용으로 입력 비용 대폭↓. |
| 저장소 | **Redis**(세션) + **git 마크다운 파일**(콘텐츠) | 세션=핫·임시·자동만료 → Redis TTL. 콘텐츠=소중·버전관리 → git `wiki/*.md`. **관계형 DB 없음**(v1은 계정 없음). |
| 콘텐츠 서빙 | **Python API 단일 소스** | Python이 `wiki/*.md`를 읽어 be/point·be/project API로 서빙. chat load-all도 같은 파일을 읽어 단일 소스. FE는 그 API를 fetch(SSG/SSR). |
| 배포 | FE=정적/Edge 호스팅, BE=컨테이너 | *[입력 필요: 구체 플랫폼(Vercel/기타)·CI]* |

## 2. 레이어·모듈 경계

- 최상위 = **FE vs BE 2분할**. FE=플로우+표현(V), BE=데이터(M)+기능(C).
- 디렉토리 매핑:
  - FE: `docs/fe/browse/`·`docs/fe/chat/` → Next.js 앱(페이지·컴포넌트·챗 패널 island).
  - BE: `docs/be/project/`·`docs/be/point/`·`docs/be/chat/` → FastAPI 서비스(도메인별 라우터·리포지토리).
  - 콘텐츠: `wiki/<project>/index.md`(be/project) + `wiki/<project>/<id>.md`(be/point). BE만 읽는다.
- FE는 BE 기능을 **HTTP API로만** 호출. BE는 FE를 모른다.

## 3. 의존 방향 ([HOME](../HOME.md) 참조 그래프)

```
fe/browse → be/project, be/point        (HTTP)
fe/chat   → be/chat                       (HTTP, 스트리밍)
be/chat   → be/point, be/project          (load-all 코퍼스 읽기)
be/project → be/point                     (index 포인트목록 = frontmatter 스캔)
```
- 전부 단방향·비순환. be/point가 말단(sink).
- 전부 **호출(직접 읽기/HTTP)** — 이벤트 없음(v1 규모).

## 4. 패턴 정책 (TS/DM)

세 BE 도메인 모두 규칙이 얇고 절차적(조회·발행 게이트·LLM 오케스트레이션) — 풍부한 불변식 없음 → **전부 트랜잭션 스크립트(TS)**.

| BE 도메인 | 패턴 | 근거 |
|---|---|---|
| be/point | **TS** | 파일 파싱→DTO 조회 + 발행 게이트(Evidence≥1+핵심섹션 1·3·5·9) 검증. 얇은 규칙. |
| be/project | **TS** | 표지 조회 + 포인트목록 조립. 거의 순수 조회. |
| be/chat | **TS** | load-all + 근거 인용 + 세션 관리 = LLM·스토어 오케스트레이션. 도메인 불변식 아님. |

> 규칙이 두꺼워지면 해당 도메인만 DM으로 승격. 각 BE `README.md` 패턴 슬롯을 이 표로 채움.

## 5. 데이터·영속

- **콘텐츠(위키)** = git 버전관리 마크다운. frontmatter YAML(포인트: id·title·project·status·tags·commits·updated / 표지: slug·summary·role·period·teamSize·techStack·architecture·highlights). Python이 파싱해 서빙.
- **세션** = Redis KV. `session_id`(세션 쿠키) → turns(role·text·citations). **TTL 1일 sliding**(활동마다 갱신, 만료 자동 삭제).
- **DTO·직렬화** = FE↔BE JSON API. **키 케이스 = camelCase**(FE TS 소비, ticket에서 확정).
- 챗 스트리밍 = SSE(FastAPI StreamingResponse ← Claude 스트리밍).

## 6. 에러·경계

- 없는/비공개(draft) 리소스 직접 접근 → **랜딩 리다이렉트**(draft 존재 노출 안 함).
- 발행 게이트 미충족 → 발행 거부.
- 챗 근거 없음 → "근거 없어 답할 수 없음"(환각 방지). 생성 실패·**30초 타임아웃** → 에러 반환(FE 재시도).
- load-all 코퍼스가 컨텍스트 예산 초과 → v1은 예산 내 가정, 초과 시 **RAG(v3) 도입 신호**.

## 7. 명명·컨벤션

- 코드·식별자 영문. 주석·문서 한국어. 도메인 slug 영문(`fe/`·`be/`).
- id·project·slug = 케밥. 날짜 = ISO `YYYY-MM-DD`. commits = git range `a..b`. period = `YYYY.MM–YYYY.MM`.
- FE=TS(camelCase), BE=Python(snake_case) 내부. API 계약 키 케이스는 §5 슬롯.

## 8. 미결
- 배포 플랫폼·CI 구체.
- 프롬프트 캐싱 TTL(5분 기본 vs 1시간)·브레이크포인트 배치.
- LangChain 세션 스토어 구현 세부(Redis 연결·키 스키마).
- 세션 `session_id` 발급·쿠키 속성(SameSite·Secure) 세부.
