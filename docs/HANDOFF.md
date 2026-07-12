# 세션 핸드오프 — v1 구현 (다른 머신에서 이어받기)

> ⚠️ **[보관용 · 완료됨]** v1 Wave 4 FE 구현 인계용 시점 스냅샷(2026-07-04). **v1·v2 구현이 모두 끝나 인계 대상 없음.** 지금 셋업·구동은 [README](../README.md), 계약·규약은 [ARCHITECTURE](arch/ARCHITECTURE.md)를 본다. 아래는 당시 기록으로만 유효.

> 목적: 기획 전단이 끝난 v1 도메인 5개 중 **BE 3개 완료 + FE 스캐폴드**까지 된 상태에서, 다른 컴퓨터/세션이 **Wave 4(fe/browse·fe/chat UI)**를 이어 구현하도록 인계한다.
> 규약 SoT: [docs/arch/ARCHITECTURE.md](arch/ARCHITECTURE.md). 도메인 지도: [docs/HOME.md](HOME.md).
> 최종 갱신: 2026-07-04 (desk 오케스트레이션이 세션 한도로 Wave 4 직전 중단됨).

---

## 1. 현재 상태 (git)

| 커밋 | 내용 |
|---|---|
| `d8df3ed` | be/point 구현(조회 API·발행 게이트) |
| `09f0649` | be/project 구현(카탈로그·인덱스 조립) |
| `4a2e075` | be/chat 구현(load-all 답변생성·세션·제안질문) |
| (uncommitted) | frontend 스캐폴드 + HOME 상태표 + 본 문서 |

HOME 도메인 상태: **be/point·be/project·be/chat = done**, **fe/browse·fe/chat = done** (Wave 4 구현 완료 — 아래 §4 파일 작성됨, typecheck·`next build` 통과. 남은 검증은 BE 기동 스모크(사람 몫)).

## 2. 완료된 것 (Wave 1–3, BE)

`backend/` — Python + FastAPI. 실행: `uvicorn app.main:app` (main.py에 세 라우터 등록됨). 의존: `backend/requirements.txt`(fastapi·pydantic·pyyaml·langchain-anthropic·redis).

- **be/point** `backend/app/point/{models,repository,service,router}.py` + `scripts/publish.py` + `wiki/.gitkeep`
- **be/project** `backend/app/project/{models,repository,service,router}.py`
- **be/chat** `backend/app/chat/{models,corpus,session,service,router}.py`

콘텐츠 = git 마크다운 `wiki/<project>/index.md`(표지) + `wiki/<project>/<id>.md`(포인트). **관계형 DB 없음.** 예시 위키는 커밋 안 함(저작은 로컬).

### BE 검증 상태
- 구조·계약: mock/fake 주입 + 임시 venv로 통과(be/point·project 픽스처 검증, be/chat 50개 계약 통과).
- **미검증(사람 몫, 막힘 아님):** 실제 Claude API 키 + Redis 인스턴스로 통합 스모크. `.env`에 `ANTHROPIC_API_KEY`, 로컬 Redis 필요.

## 3. FE가 소비할 BE API 계약 (camelCase JSON)

**be/point**
- `GET /api/points/recommended` → `PointSummary[]` (featured 우선 + 동점 `updated` 최신순, 상위 3)
- `GET /api/points?project=<slug>` → `PointSummary[]` (published만; 없는 project=`[]`)
- `GET /api/points/{id}` → `Point` (published). draft/없는 id → **302 → `/`**
  - `Point.options[]` = `{option,pros,cons,cost,adopted}`; `evidence[]` = `{kind,label,url}`; 선택 섹션은 없으면 필드 생략(exclude_none)

**be/project**
- `GET /api/projects` → `ProjectSummary[]` (카탈로그; published 포인트 0개 프로젝트는 후순위)
- `GET /api/projects/{slug}` → `ProjectIndex` (표지 6요소 + `points: PointSummary[]`(be/point 파생). 없는 slug → **302 → `/`**)

**be/chat**
- `POST /api/chat` (SSE 스트리밍) — body `{ question, context?: pointId }`, `session_id`은 **세션 쿠키**(서버 발급). 응답: 토큰 스트림 + 답변 끝 근거(Citation). 타임아웃 30초. 근거 없으면 "답할 수 없음"류.
- `GET /api/chat/suggestions?point=<id>` → `string[]`(3). 없는/비공개 포인트 → `[]`

## 4. 남은 일 — Wave 4 (FE, 병렬 가능)

`frontend/` — Next.js 14 App Router + TS. **이미 스캐폴드된 것**(읽고 재사용):
- `frontend/package.json`·`tsconfig.json`·`next.config.mjs`·`.env.example`·`.gitignore`
- `frontend/lib/api.ts`(BE fetch 래퍼)·`lib/chatClient.ts`(SSE)·`lib/staticSuggestions.ts`(무맥락 기본 질문)·`lib/types.ts`(DTO 타입)
- **아직 없는 것 = 이번에 구현**:

### 4a. fe/browse — 티켓 [tickets/fe/0001-fe-browse.md](../tickets/fe/0001-fe-browse.md)
- `app/layout.tsx` (공통 레이아웃 + `<ChatFab/>` 상시 + 기본 디자인 템플릿)
- `app/page.tsx` (랜딩: 추천 포인트 상단 + 프로젝트 목록 하단)
- `app/projects/[slug]/page.tsx` (표지 6요소 + published 포인트 목록; 0개면 목록 슬롯 숨김)
- `app/points/[id]/page.tsx` (9섹션 + Evidence 외부 새 탭 + 같은 프로젝트 다른 포인트)
- `components/ChatFab.tsx` (전역 우하단 FAB, fe/chat 진입구. 포인트상세에서 열면 포인트 id 맥락 전달)
- 전이는 [플로우.md](fe/browse/플로우.md)에 그려진 것만. 없는/draft 접근은 BE가 302 `/`.

### 4b. fe/chat — 티켓 [tickets/fe/0002-fe-chat.md](../tickets/fe/0002-fe-chat.md)
- `components/chat/ChatPanel.tsx` (데스크톱 우하단 패널 / 모바일 전체화면, 열림·닫기·Esc·포커스)
- `components/chat/MessageList.tsx` (말풍선 멀티턴 + 답변 하단 근거 링크 외부 새 탭, `role="log"`)
- `components/chat/Composer.tsx` (입력창 + 제안 질문 칩; 하이브리드: 무맥락=staticSuggestions, 맥락=`/api/chat/suggestions`)
- 세션은 서버 쿠키(be/chat) 그대로 — **로컬 저장 금지**. 스트리밍 소비는 `lib/chatClient.ts`.
- UI 충실 참고: [_qa/browse.html](fe/browse/_qa/browse.html) · [_qa/chat.html](fe/chat/_qa/chat.html)

## 5. 구현 중 확정된 결정 (계약 세부)
- API JSON = **camelCase**(be/point `CamelModel` 재사용, 단일 계약).
- be/chat 세션: Redis 직접 스토어, 키 `chat:session:{id}`, TTL **86400s sliding**(load/save마다 EXPIRE 갱신).
- be/chat 근거 인용: 코퍼스 Evidence에 토큰 `[[E1]]` 부여 → 모델이 `###CITATIONS###` 뒤에 사용 토큰 나열 → 서비스가 registry 매핑(구분자 뒷부분은 사용자 미노출).
- be/chat LLM: `langchain-anthropic`, `claude-sonnet-5`, 스트리밍 + system prefix `cache_control`(프롬프트 캐싱).
- be/point 옵션표 컬럼(옵션·장점·단점·비용/리스크·채택) → camelCase 매핑. project slug 정본 = 디렉토리 이름.

## 6. 재개 절차 (다른 머신)
1. `git clone` / `git pull` — 위 커밋들 + 이 문서 확인.
2. BE: `cd backend && pip install -r requirements.txt` → `.env`에 `ANTHROPIC_API_KEY` + Redis 기동 → `uvicorn app.main:app --reload`.
3. FE: `cd frontend && npm install` → `.env`에 BE base URL(`.env.example` 참고) → `npm run dev`.
4. Wave 4 구현: fe/browse·fe/chat 티켓대로 위 §4 파일 작성(계약 §3·§5 고정). `lib/*`는 이미 있으니 읽고 재사용.
5. 티켓 단위로 구현·로컬 커밋. **push·merge·PR은 사람.**

## 7. 제약 (신성불가침)
- 규약 SoT = ARCHITECTURE.md. **계약(§3·§5)·경계·기획을 바꾸지 않는다** — 바꿔야 하면 멈추고 사람에게(intake) 반환.
- 배정 도메인(fe/browse·fe/chat) 밖(backend·BE 계약) 수정 금지. 관계형 DB 도입 금지. (인라인 선택-질문은 당시 v3로 금지였으나 이후 프로토타입 범위로 구현 완료 — `SelectionAsk.tsx`.)
- **push 하지 않는다.** 로컬 커밋까지만.

## 8. 포인터
- 도메인 계약: `docs/fe/browse/`·`docs/fe/chat/`(플로우·요소) / `docs/be/*/`(데이터·기능). 일지는 쓰기 전용(참고만).
- 티켓: `tickets/fe/0001-fe-browse.md`·`tickets/fe/0002-fe-chat.md`.
- 아키텍처: `docs/arch/ARCHITECTURE.md`. 미결(§8): 배포 플랫폼·CI, 프롬프트 캐싱 TTL 튜닝, 세션 쿠키 속성.
