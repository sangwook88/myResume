---
name: setting
description: 로컬 개발 서버를 한 번에 띄운다 — 백엔드(FastAPI/Swagger)와 프론트엔드(Next.js dev)를 각각 백그라운드로 실행하고 접속 URL을 알려준다. "/setting", "서버 띄워줘", "개발 서버 켜줘", "백엔드 프론트 둘 다 실행" 류에 사용.
---

# Setting — 로컬 개발 서버 기동

백엔드(FastAPI + Swagger)와 프론트엔드(Next.js) dev 서버를 **둘 다 백그라운드로** 띄우고,
접속 URL을 사용자에게 알려준다. **모든 응답은 한글로 작성한다.**

경로 전제 (이 레포 기준):
- 프로젝트 루트: `c:/Users/safi2/Documents/GitHub/Project_PO`
- 백엔드: `backend/` (venv = `backend/.venv`, uvicorn = `backend/.venv/Scripts/uvicorn.exe`)
- 프론트엔드: `frontend/`

## 1. 프리플라이트 (막히면 여기서 멈추고 사용자에게 알림)

기동 전에 아래를 확인한다. 없으면 서버가 안 뜨니, 부족한 것만 짚어 사용자에게 안내한다.

- **BE venv**: `backend/.venv/Scripts/uvicorn.exe` 존재?
  - 없으면 → venv 미생성. 안내: `cd backend; python -m venv .venv; .venv\Scripts\pip install -r requirements.txt`
- **BE .env**: `backend/.env` 존재? 그리고 `ANTHROPIC_API_KEY`가 placeholder가 아닌 실제 키(`sk-ant-…`)인가?
  - 없으면 → `backend/.env.example`를 복사해 채우라고 안내. (챗봇 호출 시 필요. 없어도 둘러보기 페이지·서버 기동은 됨 — 경고만.)
  - **주의**: uvicorn 은 `.env` 를 자동 로드하지 않는다 → 반드시 `--env-file .env` 로 띄워야 챗봇 LLM 인증이 된다(아래 기동 명령 참고).
- **Redis(챗봇 세션)**: 6379 리스닝? (`Get-NetTCPConnection -LocalPort 6379`)
  - 이 PC엔 **Memurai**(Windows 네이티브 Redis)가 서비스로 설치돼 자동 시작된다 — 보통 그냥 떠 있음.
  - 안 떠 있으면 → `Start-Service Memurai` 안내. (Redis 없으면 둘러보기는 되지만 **챗봇 세션 로드에서 실패**.)
- **FE 의존성**: `frontend/node_modules` 존재?
  - 없으면 → 먼저 `cd frontend; npm install` 을 돌려 설치한 뒤 진행.

이미 켜져 있는지도 본다: 8000/3000 포트가 이미 떠 있으면 중복 기동하지 말고, "이미 실행 중"이라고 알린다.

## 2. 서버 기동 (둘 다 백그라운드)

두 서버 모두 **`run_in_background: true`** 로 띄운다 (장기 실행이라 포그라운드로 잡으면 안 됨).

- **백엔드** — 작업 디렉터리 `backend/`, venv 바이너리를 직접 호출(활성화 불필요):
  ```
  cd backend && .venv/Scripts/uvicorn.exe app.main:app --reload --env-file .env
  ```
  (`app.main` 이 import 되려면 반드시 `backend/`에서 실행해야 한다. `--env-file .env` 는
  `ANTHROPIC_API_KEY` 를 프로세스 환경에 로드해 챗봇 LLM 인증을 가능케 한다 — 빼면
  챗봇이 "답변 생성 중 오류"로 실패한다.)

- **프론트엔드** — 작업 디렉터리 `frontend/`:
  ```
  cd frontend && npm run dev
  ```

## 3. 기동 확인

띄운 뒤 몇 초 뒤 백그라운드 출력을 확인한다:
- BE: 로그에 `Application startup complete` 가 뜨면 정상.
- FE: 로그에 `Ready in ...` / `Local: http://localhost:3000` 이 뜨면 정상.

포트가 바뀌었으면(예: 3000 점유 시 Next가 3001로 뜸) 실제 로그의 포트를 반영해 알린다.

## 4. 사용자에게 보고

접속 URL을 명확히 정리해 알린다:

- **백엔드 Swagger UI**: http://127.0.0.1:8000/docs  ← 각 API를 Try it out 으로 호출
- **백엔드 API 예시**: http://127.0.0.1:8000/api/projects
- **프론트엔드**: http://localhost:3000

주의도 함께:
- 루트(`http://127.0.0.1:8000/`)는 라우트가 없어 404가 정상 — Swagger는 `/docs` 로 접속.
- 두 서버 모두 `--reload` / dev 모드라 코드 저장 시 자동 재시작된다.
- 끄려면 각 백그라운드 프로세스를 종료하면 된다.
