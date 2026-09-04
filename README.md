# Grounded-Resume — 근거기반 이력서

채용자가 published 위키를 둘러보고, 결정마다 **커밋·PR 근거**로 답하는 챗봇에 물어보는 포트폴리오.
콘텐츠는 관계형 DB 없이 **git 마크다운**이라, **레포를 포크해 셀프호스팅**하는 배포 모델이다.

- **콘텐츠**: `wiki/<project>/index.md`(표지) + `wiki/<project>/<id>.md`(STAR+ADR 9섹션 포인트, 근거 필수)
- **BE**: FastAPI — 위키를 파싱해 camelCase JSON으로 서빙(`be/point`·`be/project`), 챗봇은 published 코퍼스 load-all + Claude 스트리밍(`be/chat`)
- **FE**: Next.js — 둘러보기 3계층 + 우하단 챗봇 FAB
- **저장소**: git(콘텐츠) + Redis(챗봇 세션)

## 사전 준비

| 필요 | 버전/비고 |
|---|---|
| Node.js | 18+ (프론트) |
| Python | 3.12+ (백엔드) |
| Redis | 챗봇 세션용, `localhost:6379`. Windows=[Memurai](https://www.memurai.com/) 서비스 / Linux·Mac=`redis-server` 또는 `docker run -p 6379:6379 redis` |
| Anthropic API 키 | 챗봇 답변용(`sk-ant-…`). 둘러보기만 쓸 거면 없어도 됨 |

## 셋업

```bash
git clone https://github.com/<you>/Project_PO && cd Project_PO
```

**1) 백엔드**
```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # Windows
# .venv/bin/pip install -r requirements.txt        # Linux/Mac
cp .env.example .env                                # .env 의 ANTHROPIC_API_KEY 를 실제 키로 채운다
```

**2) 프론트엔드**
```bash
cd ../frontend
npm install
cp .env.example .env.local                          # NEXT_PUBLIC_API_BASE (기본 http://localhost:8000)
```

**3) Redis** — Windows는 Memurai 설치 시 서비스로 자동 상주. 그 외는 위 표 참고.

## 실행

**개발(핫리로드)**
```bash
# 백엔드 — .env 를 로드하려면 --env-file 필수(안 그러면 챗봇 인증 실패)
cd backend && .venv/Scripts/uvicorn.exe app.main:app --reload --env-file .env
# 프론트엔드
cd frontend && npm run dev            # http://localhost:3000
```
> Claude Code 사용자는 `/setting` 스킬로 BE·FE를 한 번에 띄울 수 있다.

**프로덕션**
```bash
cd backend && .venv/Scripts/uvicorn.exe app.main:app --env-file .env    # --reload 없음
cd frontend && npm run build && npm run start
```
- BE/FE 오리진이 다르면 BE 환경변수 `CORS_ORIGINS`(쉼표구분)로 FE 오리진을 허용한다(기본 `http://localhost:3000`).
- HTTPS 배포 시 세션 쿠키 `Secure` 를 켜고, 리버스 프록시/플랫폼에서 TLS 를 종단한다.

접속: 둘러보기 `http://localhost:3000` · API 문서(Swagger) `http://localhost:8000/docs`

## 콘텐츠 저작

포인트는 `wiki/<slug>/` 아래 마크다운으로 직접 쓴다. **발행 게이트**(근거≥1 + 핵심 섹션)를 통과해야 published 로 노출된다:
```bash
python scripts/publish.py <point-id>     # draft → published (게이트 미충족이면 거부)
```
Claude Code 사용자는 `/pofol` 스킬로 레포 git 이력에서 표지+포인트 초안을 저작할 수 있다.
양식·규약은 [ARCHITECTURE](docs/arch/ARCHITECTURE.md) 참고.

## 챗봇 RAG (선택, 고급)

기본 챗봇은 published 전량을 **load-all** 해 답한다(소규모 포폴엔 이게 더 완전하고 프롬프트 캐시로 저렴). 포인트가 충분히(대략 20+) 쌓여 컨텍스트가 부담될 때만, 질문 기반 **시맨틱 top-K(RAG)** 로 전환할 수 있다 — 외부 벡터 DB 없이 로컬 ONNX 임베딩 + 파일 인덱스다.

```bash
cd backend
.venv/Scripts/pip install -r requirements-rag.txt              # fastembed(+numpy) 설치
.venv/Scripts/python.exe scripts/build_rag_index.py           # 인덱스 빌드(위키 바뀌면 재실행)
# .env 에 CHAT_RAG_ENABLED=1 추가 후 BE 재시작
```
RAG 를 끄면(기본) fastembed 없이도 챗봇은 load-all 로 정상 동작한다.
