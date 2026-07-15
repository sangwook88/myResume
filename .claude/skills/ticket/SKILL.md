---
name: ticket
description: 정제(distill)와 아키텍처가 끝난 도메인을 콜드 스타트로 구현 가능한 자기완결 티켓(tickets/<fe|be>/NNNN-<slug>.md)으로 그릴하고 의존 순서 플로우를 그리는 스킬(기획 전단 종료). 책임 도메인 분류 → 구조 결정(ARCHITECTURE 패턴 기본값 계승 vs 대안) → 엣지케이스 심층 분석. 산출 티켓은 scripts/implement.ps1 -Side <fe|be>로 구현 엔진에 넘겨 새 브랜치에서 "구현만" 시킨다. 티켓만 쓴다(코드·엔진 호출 안 함). "티켓 만들어줘", "이거 티켓화", "티켓 플로우 그려", "ticket" 류에 사용.
---

# ticket — 구현 티켓 + 의존 플로우 (기획 전단 7단계, 종료)

도메인을 자기완결 티켓으로 그릴하고 의존 순서를 그린다. 전제: [distill](../distill/SKILL.md)로 도메인 정제 + [arch](../arch/SKILL.md)로 `docs/arch/ARCHITECTURE.md` 확정. 규약: [docs/conventions.md](${DDD_ROOT}/docs/conventions.md). 산출: `tickets/<fe|be>/NNNN-<slug>.md`.

구현 엔진은 티켓 밖을 안 건드린다 → 모호하면 구현이 샌다. 작성 전 그릴로 갈림길을 닫고 한 장에 ①책임 도메인 ②구조(패턴) ③엣지케이스를 못 박는다. **티켓만 쓴다 — 코드도 엔진 호출도 안 한다**(검수 게이트).

## 1. 시작 전 읽기 (이 순서)
1. `docs/arch/ARCHITECTURE.md` §1 기술 스택 · §4 패턴 정책 — 스택·레이어·패턴 기본값.
2. `docs/CONTEXT.md` + `docs/HOME.md` — FE/BE 도메인 지형·참조 그래프.
3. 후보 도메인 폴더 `docs/be/<name>/`(데이터.md·기능_*.md) 또는 `docs/fe/<name>/`(플로우.md·요소/*.md). 일지는 안 읽는다(write-only).
4. 만질 코드 — 해당 도메인 소스(있으면).
5. `tickets/<fe|be>/` 기존 티켓 — 번호 채번 + 미완 충돌 확인.

## 2. 책임 도메인 분류
| 항목 | 값 |
|---|---|
| 1차 책임 도메인 | `be/<name>`(데이터·규칙 소유자) 또는 순수 플로우면 `fe/<name>` |
| 단계 | M / C(BE) · V(FE) — 복합이면 모두 |
| 가로지르는 도메인 | FE→BE·BE→BE 의존으로 닿는 도메인(참조 방향) |
| 분류 근거 | "데이터/규칙 가진 곳이 책임진다" — CONTEXT 어휘로 1~2줄 |

경계 애매하면 가르지 말고 **첫 갈림길**로 묻는다. 보통 BE 기능 티켓(C)과 그것을 부르는 FE 플로우 티켓(V)을 따로 끊는다.

## 3. 구조 결정 — 패턴 타협
ARCHITECTURE §4 도메인 기본값(TS/DM)에서 출발. 기능 성격이 기본값과 맞으면 그대로 + *왜* 한 줄. 어긋나면 트레이드오프 제안(A 기존 계승 / B 대안), 한 번에 한 갈림길, skeptic 기본. 규약 이탈이면 티켓에 근거 + 도메인 `일지` 한 줄. 코드로 답할 수 있으면 직접 읽는다.

## 4. 엣지 케이스 심층 분석
한 패스로 전수 스윕: 경계값(0·음수·최대·빈 컬렉션) / 상태·순서(중복·동시·재진입·잘못된 시점) / 수명(정리 시점) / 통지(늦은 구독·중복 발화) / 데이터 결손(id 미스·행 없음) / 상호작용(가로지름 충돌·순환). 각 케이스를 표로(`케이스 / 기대 동작 / 처리 위치`), plan-fe/plan-be에서 확정한 분기를 근거로. 모르면 추측 말고 갈림길로.

## 5. 티켓 작성
[templates/ticket.md](${DDD_ROOT}/templates/ticket.md)를 복제해 채운다:
- 경로: `tickets/<fe|be>/NNNN-<영문-slug>.md` (NNNN = 그 측 폴더 기존 최대 +1, 4자리).
- 프런트매터 필수: `id` · `branch`(feat/<slug>) · `base`(기본 main) · `domain`(fe/<name> 또는 be/<name>) · `stage`(M/C/V) · `pattern`(TS/DM, ARCHITECTURE 기준) · `engine`(codex/claude) · `status: ready` · `created`.
- **자기완결성** — 콜드 에이전트가 이 티켓만 읽고 구현 가능한가? 변경 파일 경로·시그니처·DTO 필드 구체적. "적절히"·"알아서" 금지.
- **범위 경계(하지 말 것)** 필수.
- **`engine: codex` 면 「QA 하지 말 것」을 §8 범위 경계에 명시.** codex 는 구현만 한다 — QA(테스트 실행·수동 검증·수용 기준 판정)는 §7-1 감독 루프에서 Claude 가 한다(4단계 검수). 그래서 codex 티켓의 §8 에 한 줄 박는다: *"QA·검증 금지 — 구현만. 테스트 실행·수동 검증·수용 기준 판정은 하지 않는다(감독 Claude 몫)."* `engine: claude` 면 이 줄은 넣지 않는다(스스로 검증).

## 6. 의존 순서 플로우
`docs/HOME.md` 참조 그래프로 티켓을 **wave/순서**로 묶는다 — BE 먼저(FE가 부르는 기능이 있어야 하므로), 그 BE를 부르는 FE는 뒤. BE 간 의존은 단방향 순서대로. 순환 보이면 멈추고 decompose 경계 재검토 안내. 출력: 티켓 번호 × 순서 표.

## 7. 종료 → 핸드오프
1. 티켓 경로 목록 + 책임 도메인 + 핵심 구조 결정 + 의존 순서 + 미결 1줄.
2. 구조 이탈 결정했으면 도메인 `일지` 기록 확인.
3. 안내 — **티켓 검수 후** 아래로(스킬이 직접 호출하지 않는다):
   ```
   pwsh "${DDD_ROOT}/scripts/implement.ps1" -Side be -Ticket tickets/be/NNNN-<slug>.md
   pwsh "${DDD_ROOT}/scripts/implement.ps1" -Side fe -Ticket tickets/fe/NNNN-<slug>.md
   ```
   `base`에서 `branch`를 따 `engine`에게 "이 티켓만 구현"시킨다. 검토·커밋·푸시는 사람.

### 7-1. `/ticket <engine>` — Orca 격리 워크트리에서 codex CLI 자동 구현 + Claude 감독
`/ticket codex`(또는 `/ticket claude`)처럼 **엔진 인자**가 오면 아래 감독 루프를 돈다. 전제: `TERM_PROGRAM=Orca`.

1. **티켓 작성 → 사람 확인(검수 게이트).** "이 티켓 구현할까요?" 확인 없이는 아래로 못 넘어간다. 엔진 인자가 있어도 **사람 확인이 게이트**다.
2. **격리 워크트리에서 codex CLI 착수.** 확인되면 메인 스레드가 실행:
   ```
   powershell "${DDD_ROOT}/scripts/implement.ps1" -Side <be|fe> -Ticket <경로> -Engine <codex|claude> -Worktree
   ```
   `-Worktree` 는 `orca worktree create` 로 **새 격리 git 워크트리**(메인 체크아웃 무오염)를 만들고, 그 안의 **새 탭에 대화형 codex CLI(TUI)를 띄운다**(`codex -s workspace-write -a never`, 승인 없이 자동 진행 — 눈으로 보인다). 한국어 구현 프롬프트는 워크트리의 `.orca/impl-prompt.md`(UTF-8, git exclude 처리)에 기록하고 codex 에는 "그 파일을 읽어 그대로 구현하라"는 **ASCII 한 줄**만 넘긴다 — 한글을 argv 로 주면 `codex.cmd`→`cmd.exe` 의 ANSI 재인코딩으로 `?` 로 깨지므로. 출력의 `ORCA-HANDOFF worktreeId/worktreePath/worktreeBranch/terminalHandle` 를 받아 둔다.
3. **완료 대기(Claude).** `orca terminal wait --terminal <handle> --for tui-idle --json` (넉넉히 `--timeout-ms`) — codex 가 초기 프롬프트를 다 처리하고 idle 로 돌아오면 완료. 필요하면 `orca terminal read --terminal <handle> --json` 로 진행을 확인한다.
4. **검수(Claude = 목표 달성 판정).** 티켓의 「구현목표/수용기준」·「경계(하지 말 것)」을 다시 읽고 `git -C "<worktreePath>" diff <base>` 로 실제 변경을 대조한다 — 수용 기준을 모두 충족했는가, 경계를 넘지 않았는가. 미충족이면 무엇이 빠졌는지 정리해 그 탭에 후속 지시(`orca terminal send`)하거나 사람에게 갈림길로 올린다.
5. **완료 알림.** 다 되면 "됐다"고 알린다 — 대화로 보고 + (자리 비움 대비) `PushNotification` 으로 핑. 변경 요약·수용 기준 충족 여부·워크트리 브랜치(`<worktreeBranch>`)를 함께 준다. 병합·커밋·푸시는 사람. 워크트리 정리는 `orca worktree rm --worktree name:<slug> --force`.

> 가벼운 대안(격리 불필요): `-Worktree` 대신 `-NewTerminal`(별칭 `-Orca`) — 현재 체크아웃을 공유하는 새 탭에서 같은 방식(대화형 codex CLI + 파일 프롬프트)으로 구현하되, 브랜치 체크아웃이 메인 창에도 반영된다.
