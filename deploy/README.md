# 배포 — Docker Compose (셀프호스팅)

FE(Next.js) · BE(FastAPI) · Redis 를 **Caddy 한 오리진 뒤**에 묶어 올린다. 한 오리진이라
챗봇 세션 쿠키(`SameSite=Lax`)가 first-party 로 동작하고 CORS 도 필요 없다.

```
브라우저 → Caddy(:80/:443) ┬ /api/*  → backend:8000  (FastAPI, SSE 스트리밍)
                           └ 그 외    → frontend:3000 (Next.js standalone)
backend → redis:6379 (세션·질문로그) · Anthropic API (챗봇 답변)
backend ← ../wiki (read-only 마운트 = 콘텐츠 단일 소스)
```

## 준비물
- Docker + Docker Compose v2
- Anthropic API 키
- (공개 배포 시) 도메인 + 서버의 80·443 포트 개방

## 실행

```bash
cd deploy
cp .env.example .env          # ANTHROPIC_API_KEY, SITE_ADDRESS 채우기
docker compose up -d --build  # 최초 빌드 + 기동
```

- **로컬 테스트**: `.env` 의 `SITE_ADDRESS=:80` → http://localhost 접속.
- **공개 배포**: `SITE_ADDRESS=example.com` → Caddy 가 HTTPS 자동 발급. https://example.com 접속.
- Swagger(`/docs`)는 **의도적으로 공개 프록시하지 않는다**(내부 도구). 볼 땐 백엔드 포트를 임시 노출하거나
  `docker compose exec` 로 접근한다. 예: 임시로 `docker compose exec backend curl -s localhost:8000/openapi.json`.

확인:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/            # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/projects # 200
```

## 콘텐츠(포폴) 갱신
콘텐츠는 이미지에 굽지 않고 `../wiki` 를 read-only 로 마운트한다.
```bash
git pull                                   # 포폴 마크다운 갱신
docker compose restart backend             # 즉시 반영(또는 ISR 300s 대기)
```

## 코드 변경 후 재배포
```bash
git pull
docker compose up -d --build               # 바뀐 이미지만 재빌드·교체
```

## 로그 · 중지
```bash
docker compose logs -f backend             # (또는 frontend / caddy)
docker compose down                        # 중지(볼륨=redis·caddy 인증서는 보존)
```

## GitHub Actions 자동배포 (선택)

`main` 에 push 하면 [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) 이 배포 호스트로 SSH 접속해
`git pull` → `deploy/.env`(시크릿 주입) → `docker compose up -d --build` 를 돌린다. 시크릿의 단일 출처는
GitHub 이고, 호스트엔 배포 시점에만 `.env` 로 써진다.

### 1) 배포 호스트 사전 준비 (1회)
- Docker + Docker Compose v2 설치, 80·443 개방
- 포크 레포를 클론(예: `git clone https://github.com/sangwook88/myResume.git ~/Project_PO`), `main` 추적
- Actions 러너가 접속할 SSH 공개키를 호스트 `~/.ssh/authorized_keys` 에 등록

### 2) GitHub → Settings → Secrets and variables → Actions

**Secrets** (암호화·마스킹):

| 이름 | 값 |
|---|---|
| `DEPLOY_HOST` | 배포 서버 IP/도메인 |
| `DEPLOY_USER` | SSH 사용자명 |
| `DEPLOY_SSH_KEY` | 그 사용자의 **개인키**(PEM 전체). 공개키는 호스트 authorized_keys 에 |
| `DEPLOY_SSH_PORT` | (선택) 비표준 포트. 없으면 22 |
| `ANTHROPIC_API_KEY` | Claude 키 `sk-ant-...` |
| `CHAT_ADMIN_TOKEN` | (선택) 질문로그 관리자 토큰. 비우면 admin API 는 404 |

**Variables** (비밀 아님):

| 이름 | 값 |
|---|---|
| `SITE_ADDRESS` | `example.com`(HTTPS 자동) 또는 `:80`(로컬 HTTP). 없으면 `:80` |
| `DEPLOY_PATH` | 호스트상의 레포 경로. 없으면 `~/Project_PO` |

### 3) 배포
- 자동: `main` push
- 수동: Actions 탭 → **Deploy** → Run workflow

빌드가 실패하면 기존 컨테이너가 그대로 떠 있어(무중단), 배포 후 backend 헬스체크(최대 30초)로 확인한다.

## 주의
- `deploy/.env` 는 시크릿이라 커밋 금지(`.gitignore` 처리됨). `.env.example` 만 버전관리.
- Redis 는 `appendonly` 로 디스크 영속 → 재시작에도 세션·질문로그 보존. 볼륨 `redis-data` 삭제 시 초기화.
- RAG(선택)를 켜려면 backend 이미지에 `requirements-rag.txt` 설치 + 인덱스 빌드가 추가로 필요하다(루트 README §RAG). 기본 배포는 load-all 로 동작.
