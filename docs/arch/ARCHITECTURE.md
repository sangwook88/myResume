# ARCHITECTURE — 근거기반 포트폴리오 (v1)

> 기획 QA·distill 완료 후 확정한 전역 기술·구조. [ticket](../../.claude/skills/ticket/SKILL.md)의 구조 근거.
> 범위: [roadmap](../roadmap.md) **v1** (+ 하단 **v4 확장** 결정). 도메인 지도: [HOME](../HOME.md).
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

> **승인된 쓰기 경계 확장(2026-07-14):** 관리자 전용 be/point API가 단락 첨부 이미지를 `wiki/<project>/assets/`에 원자적으로 저장한다. 이미지는 git 콘텐츠의 일부이며 자동 커밋하지 않는다. 공개 API는 저장된 래스터 이미지(png·jpeg·gif·webp)만 서빙한다.

> **승인된 사이트 프로필 경계 확장(2026-07-14):** 랜딩의 사이트 단일 프로필은 새 도메인 없이 기존 랜딩 콘텐츠·정적 애셋 소유자인 be/project가 `wiki/profile.md`(frontmatter+자기소개 본문)와 `wiki/profile/` 사진으로 소유한다. 프로필 조회·사진 서빙은 공개하고 편집·사진 업로드만 공용 관리자 토큰으로 보호하며, `profile.md`는 be/point 재귀 스캔에서 제외한다.

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

- **콘텐츠(위키)** = git 버전관리 마크다운 + 포인트 부속 래스터 이미지(`wiki/<project>/assets/`). frontmatter YAML(포인트: id·title·project·status·tags·commits·updated / 표지: slug·summary·role·period·teamSize·techStack·architecture·highlights). Python이 파싱·서빙하며, 관리자가 업로드한 이미지 파일도 사람이 나중에 수동 커밋한다.
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

## 8. 미결 → 확정 (v1 마감)
- **배포**: 셀프호스팅(각자 포크) 확정 — 관리형 플랫폼 강제 없음. 셋업·구동 절차는 [README](../../README.md). CI는 v1 미도입(선택).
- **프롬프트 캐싱**: `cache_control: ephemeral`(기본 ~5분) 확정 — v1 트래픽·코퍼스 규모엔 충분. 브레이크포인트 = system prefix(코퍼스) 1개. → **v4-B에서 정상화·확장**(프리픽스 안정성 수정 + TTL 1h). 아래 v4 확장 참조.
- **세션 스토어(Redis)**: 구현 확정 — 키 `chat:session:{session_id}`, JSON 1개, TTL 86400초 sliding(load·save마다 갱신).
- **세션 쿠키**: 서버 발급 opaque `session_id`, `HttpOnly`·`SameSite=Lax`·`Max-Age=86400`. `Secure`는 HTTPS 배포 시 켠다(플랫폼/리버스 프록시에서 TLS 종단).
- **be/point 이미지 쓰기 경계**: 오너 승인 확장. `POST /api/points/admin/{point_id}/images`만 관리자 인증 후 래스터 이미지를 쓰고, `GET /api/points/assets/{project}/{filename}`은 published 페이지 렌더를 위해 공개한다. 삭제·목록·변환·자동 git 커밋은 하지 않는다.

---

## v4 확장 결정 (2026-07-12)

> 범위: [roadmap](../roadmap.md) **v4** — 새 도메인·참조 엣지 없음, 기존 도메인 확장만. 패턴(TS/DM) 무변(§4 그대로 — 새 기능 전부 TS). 아래는 §1·§5·§8에 얹는 델타. 정책값은 plan-be 확정 완료(각 도메인 `일지.md`), 여기선 기술·구조(메커니즘)만 결정.

### v4-A. 콘텐츠 하이브리드 (be/point invidence)
- **스택 무변** — git 마크다운 파싱(TS)에 사이드카·숨은 섹션 파싱만 추가. 새 런타임 의존 없음.
- **저장·영속(§5 델타):**
  - invidence.detail = 포인트 문서 내 **숨은 섹션** `## 챗봇전용 [[E##]]` 블록(Evidence 토큰별, 사람 인터뷰 저작). 공개 파서는 무시, 챗봇 전용 접근자만 읽음.
  - invidence.code = 사이드카 파일 `wiki/<project>/<id>.code.md`(발행 시 git 추출로 채움).
- **접근 경로 물리 분리:** 공개 조회 3함수(`get_published` 등)는 invidence 미포함 유지 → 공개 DTO·fe/browse 렌더엔 invidence 안 샘. be/chat 코퍼스만 **챗봇 전용 접근자**(챗봇컨텍스트조회 = visible+invidence 합집합)로 읽는다. 참조 그래프 무변(be/chat→be/point 유효, 접근자만 교체).
- **코퍼스 렌더:** invidence(detail·code)는 각 Evidence 토큰 `[[E##]]` **밑에 비인용 컨텍스트**로 붙는다 — Citation은 Evidence만, invidence는 인용 대상 아님. invidence는 **발행-시점 고정**이라 v4-B 캐시 프리픽스 안 코퍼스의 일부(커질수록 캐싱 이득↑).
- **발행코드추출(빌드타임 유틸):** 발행 플로우(`scripts/publish.py`)에서 Evidence kind=commit·pr의 ref(커밋 해시)에서 변경 hunk를 git으로 **1회** 추출해 `.code.md`에 기록. 서빙 시 git 무접근. 재발행=덮어씀. ref 해석 실패=code 비우고 발행 진행(발행 안 막음, git 미설치 처리와 동일). 발행 게이트 영향 없음(Evidence≥1 불변).

### v4-B. 프롬프트 캐싱 정상화 (be/chat)
현 코드 결함 4개(프리픽스 불안정·관측 불가)를 고쳐 load-all 코퍼스 캐시를 실제로 성립시킨다.

| 결함 (현 코드) | v4 수정 |
|---|---|
| tone(`{tone}`)이 코퍼스 위 프리픽스 안 — 모드(technical↔hr) 전환 시 전량 미스 (`service.py:44-60`) | tone·진입맥락 포인터를 **브레이크포인트 뒤 2번째 system 블록**(캐시 밖)으로 이동 |
| `build_corpus`가 진입 포인트를 코퍼스 맨 앞 재배치 — 진입점마다 프리픽스 상이 (`corpus.py:130-136`) | 재배치 제거, **코퍼스 정준 순서 고정**. 진입 맥락은 꼬리에 짧은 **포인터**(`[E##]에서 진입`)로만 |
| `cache_control: ephemeral` 기본(~5분) — 뜸한 방문 간 캐시 만료 | **`ttl: "1h"`** + anthropic-beta `extended-cache-ttl-2025-04-11` 헤더 |
| `ChatAnthropic(streaming=True)`에 `stream_usage` 미설정 — cache_read 관측 불가 (`service.py:96-101`) | **`stream_usage=True`** — `usage_metadata`의 cache_read/write 로깅으로 실측 |

- **프롬프트 구조 (확정 — 가변 꼬리 = 2번째 system 블록):**
  ```
  SystemMessage(content=[
    {type:text, text: 고정지시 + 코퍼스,  cache_control:{type:ephemeral, ttl:"1h"}},  # ← 캐시 프리픽스(안정)
    {type:text, text: tone + 진입맥락 포인터},                                          # ← 캐시 밖 꼬리
  ])
  HumanMessage(질문)                              # 순수 질문(세션 Turn 에도 순수 저장 — 이력 오염 없음)
  ```
- 캐시는 **API 키(조직) 단위 공유** → 익명 방문자끼리 같은 코퍼스 프리픽스를 재사용(앞 방문자가 데운 캐시에 무임승차). 발행으로 코퍼스가 바뀌면 프리픽스 갱신(정상, 가끔).
- **RAG(v3) 경로는 캐싱 범위 밖** — top-K는 질문마다 프리픽스가 달라 프리픽스 안정 전제가 깨짐. 캐싱은 load-all 경로 전용(`_RAG_ENABLED` 기본 OFF와 정합).
- **캐시 핀/keep-alive 안 함(확정):** Anthropic 캐시는 영구 pin이 없고 최대 TTL 1h. 발행 때 데워도 1h 무방문이면 식음 → "계속 올려두기"는 하트비트(1h마다 더미 요청)로만 흉내 가능한데, 뜸한 포폴 트래픽에선 하트비트 상시비(월 ~$7)가 콜드 쓰기 간헐비(~18센트/회)보다 비쌈. 촘촘하면 실제 질문이 알아서 갱신. → **lazy 1h TTL 유지 + `stream_usage`로 미스율 실측**, 데이터가 keep-alive를 정당화하면 그때 도입(측정 우선).

### v4-C. 아키텍처 도식 (be/project typst→SVG)
- **스택(§1 델타):** **typst PyPI 패키지**(`pip install typst`, Rust 바인딩) 추가 — **발행/빌드 전용 의존**(서빙 런타임 아님). 발행 계열 requirements로 분리(발행 안 하는 포크엔 불필요). 별도 바이너리·CLI 불필요 → 포크 셀프호스팅 `pip install`에 자연 편입.
- **파이프라인:** 발행/빌드 시 `도식컴파일`이 `typst.compile()`로 `wiki/<project>/architecture.typ` → `wiki/<project>/architecture.svg` **1회** 생성, 표지 `architectureDiagram`=그 SVG 경로. 서빙은 **정적 SVG만**(런타임 typst 무접근 — invidence.code와 같은 빌드타임 결).
- **렌더:** SVG는 벡터 마크업이라 fe/browse가 React에서 `<img>`/인라인 임베드(다크모드 CSS·무손실 확대). 브라우저·서버에 typst 불필요.
- **실패 처리:** 컴파일 실패(미설치·문법오류)=발행 스크립트가 사람에게 프롬프트(비우고 진행 `architectureDiagram=null` / 중단), 기본=비우고 진행(architecture 텍스트 유효). 재빌드=덮어씀. 소스 없으면 스킵(`architectureDiagram=null`).

### v4 패턴 (§4) — 무변
새 기능 3개 전부 기존 도메인 안, 전부 **TS**: 챗봇컨텍스트조회(합집합 조립)·발행코드추출(git 1회 읽기)·도식컴파일(typst 1회 호출) — 얇은 절차. be/point·be/project `README.md` 패턴 슬롯 그대로(승격 없음).

### v4 미결
- code 사이드카 크기 상한 **수치값**(초과 시 앞부분 자름+`…(잘림)`) = 구현 튜닝(dev 몫).
- 그 외 정책 슬롯 0 — plan-be 확정 완료.
