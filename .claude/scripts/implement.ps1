<#
.SYNOPSIS
    구현 티켓(tickets/<side>/NNNN-*.md) 또는 도메인 폴더 1개를 구현 엔진(codex 기본 / claude)에 넘겨 새 브랜치에서 "구현만" 시킨다.
.DESCRIPTION
    자기완결 도메인 폴더/페이지(또는 티켓)를 입력으로: ① 프런트매터(branch/base/status/engine) 읽기
    ② base에서 branch 체크아웃 ③ 엔진을 헤드리스로 띄워 "이 티켓만 보고 구현". 커밋·푸시는 사람.
    -Ticket/-Domain 은 전체 경로 또는 측 상대 이름(번호·slug)으로 받는다. 측 상대면 -Side 가 가리키는 tickets/<side>·docs/<side> 밑에서 찾는다.
.PARAMETER Ticket   티켓 .md 경로 또는 측 상대 이름. (Ticket 또는 Domain 중 하나 필수)
.PARAMETER Domain   도메인 폴더 경로(docs/be/<name>/ 또는 docs/fe/<name>/) 또는 측 상대 이름. 폴더 README.md 프런트매터를 읽고 폴더 전체를 계약서로 구현. (하위호환: 단일 .md 도 허용)
.PARAMETER Side     be | fe. 측 상대 이름을 줄 때 어느 측에서 찾을지. 전체 경로면 생략 가능.
.PARAMETER Base     분기 기준. 미지정 시 입력 base, 없으면 main.
.PARAMETER Engine   codex | claude. 미지정 시 입력 engine, 없으면 codex.
.PARAMETER NoBranch 브랜치 안 따고 현재 브랜치에서.
.PARAMETER NewTerminal  (별칭 -Orca) 인라인으로 돌리지 않고 새 Orca IDE 터미널 탭을 띄워 그 안에서 구현시킨다(서브에이전트).
                        새 탭이 스스로 브랜치 체크아웃 + 엔진 실행을 하도록 implement.ps1 을 인라인 모드로 재귀 호출한다. Orca 터미널에서만 동작.
.PARAMETER Worktree  Orca 격리 git 워크트리를 새로 만들어(메인 체크아웃 무오염) 그 안의 새 탭에서 엔진이 구현하게 한다.
                     ORCA-HANDOFF 로 worktreeId/path/branch/terminalHandle 을 출력 → 감독(Claude)이 완료 대기·검수·알림. Orca 터미널에서만 동작.
.PARAMETER DryRun   무엇을 할지만 출력.
.EXAMPLE
    pwsh scripts/implement.ps1 -Side be 0001-order-calc      # tickets/be/0001-order-calc.md 자동 해석
.EXAMPLE
    powershell scripts/implement.ps1 -Side be 0001-order-calc -Engine codex -NewTerminal  # 새 Orca 터미널에서 codex 가 구현
.EXAMPLE
    pwsh scripts/implement.ps1 -Side fe -Domain checkout       # docs/fe/checkout/ 자동 해석
.EXAMPLE
    pwsh scripts/implement.ps1 -Ticket tickets/be/0001-foo.md  # 전체 경로면 -Side 불필요
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$Ticket,
    [string]$Domain,
    [ValidateSet('be', 'fe')][string]$Side,
    [string]$Base,
    [ValidateSet('codex', 'claude')][string]$Engine,
    [switch]$NoBranch,
    [Alias('Orca')][switch]$NewTerminal,
    [switch]$Worktree,
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Fail($m) { Write-Host "[implement] 오류: $m" -ForegroundColor Red; exit 1 }
function Info($m) { Write-Host "[implement] $m" -ForegroundColor Cyan }

$repo = (& git rev-parse --show-toplevel 2>$null); if (-not $repo) { Fail "git 리포가 아닙니다." }
$repo = $repo.Trim()

# 측 상대 이름(번호·slug) → tickets/<side>·docs/<side> 밑에서 해석. 전체 경로면 그대로.
function Resolve-Side([string]$p, [string]$kind) {
    if (-not $p) { return $p }
    if (Test-Path $p) { return $p }
    if (-not $Side) { Fail "'$p' 는 전체 경로가 아닙니다 — 측 상대 이름이면 -Side be|fe 를 주세요." }
    $base = if ($kind -eq 'ticket') { "tickets/$Side" } else { "docs/$Side" }
    foreach ($cand in @((Join-Path $base $p), (Join-Path $base "$p.md"))) {
        if (Test-Path (Join-Path $repo $cand)) { return $cand }
    }
    return $p
}

if ($Ticket -and $Domain) { Fail "-Ticket 과 -Domain 중 하나만 주세요." }
if ($Domain) { $inputPath = Resolve-Side $Domain 'domain'; $isDomain = $true }
elseif ($Ticket) { $inputPath = Resolve-Side $Ticket 'ticket'; $isDomain = $false }
else { Fail "-Ticket 또는 -Domain 경로가 필요합니다." }
if (-not (Test-Path $inputPath)) { Fail "입력 없음: $inputPath" }
$ticketFull = (Resolve-Path $inputPath).Path
$isDir = (Get-Item $ticketFull).PSIsContainer
if ($isDomain) {
    if ($isDir) { $kind = '도메인 폴더'; $fmFile = Join-Path $ticketFull 'README.md'; if (-not (Test-Path $fmFile)) { Fail "도메인 폴더에 README.md 없음: $inputPath" } }
    else { $kind = '도메인 페이지'; $fmFile = $ticketFull }
}
else { $kind = '티켓'; $fmFile = $ticketFull }
$ticketRel = $ticketFull.Substring($repo.Length).TrimStart('\', '/') -replace '\\', '/'
$raw = Get-Content -Raw -Encoding UTF8 $fmFile

$fm = @{}
$m = [regex]::Match($raw, '(?s)^﻿?---\s*\r?\n(.*?)\r?\n---\s*\r?\n')
if ($m.Success) {
    foreach ($line in ($m.Groups[1].Value -split "`n")) {
        $kv = [regex]::Match($line, '^\s*([A-Za-z_]+)\s*:\s*(.+?)\s*(#.*)?$')
        if ($kv.Success) { $fm[$kv.Groups[1].Value] = $kv.Groups[2].Value.Trim() }
    }
}
$branch = $fm['branch']
if (-not $Base) { $Base = $fm['base']; if (-not $Base) { $Base = 'main' } }
if (-not $Engine) { $Engine = $fm['engine']; if (-not $Engine) { $Engine = 'codex' } }
$status = $fm['status']
if ($status -eq 'draft') { Fail "티켓 status 가 'draft' — 미결 갈림길. status: ready 로 닫으세요." }
if ($isDomain) {
    $slotFiles = if ($isDir) { Get-ChildItem -Path $ticketFull -Recurse -Filter *.md } else { Get-Item $ticketFull }
    foreach ($sf in $slotFiles) { if ((Get-Content -Raw -Encoding UTF8 $sf.FullName) -match '\[입력 필요') { Fail "도메인 문서에 '[입력 필요]' 슬롯이 남아 있습니다: $($sf.Name) — 채운 뒤 다시 실행하세요." } }
}
if (-not $NoBranch -and -not $branch) { Fail "프런트매터에 branch 가 없습니다. -NoBranch 를 쓰거나 branch: 를 채우세요." }
Info "${kind}: $ticketRel / 엔진: $Engine / status: $status"

# ── Orca IDE 통합 ── (새 탭 / 격리 워크트리에서 구현시키기)
function Resolve-Orca {
    if ($env:TERM_PROGRAM -ne 'Orca') { Fail "Orca IDE 터미널에서만 동작합니다(현재 TERM_PROGRAM=$($env:TERM_PROGRAM))." }
    $gc = Get-Command 'orca' -ErrorAction SilentlyContinue
    if ($gc) { return $gc.Source }
    foreach ($cand in @(
            (Join-Path $env:LOCALAPPDATA 'Programs\orca\resources\bin\orca.cmd'),
            (Join-Path ${env:ProgramFiles} 'orca\resources\bin\orca.cmd'))) {
        if ($cand -and (Test-Path $cand)) { return $cand }
    }
    Fail "orca CLI(resources/bin/orca.cmd) 를 못 찾음 — Orca 설치 경로 확인."
}

# 격리 git 워크트리를 새로 만들어(메인 체크아웃 무오염) 그 안의 새 탭에서 엔진이 구현.
# 완료 대기·검수·알림은 감독(Claude)이 ORCA-HANDOFF 값으로 이어받는다.
if ($Worktree) {
    $orca = Resolve-Orca
    $wtName = [IO.Path]::GetFileNameWithoutExtension($ticketRel)
    # 워크트리 탭에서 이 스크립트를 인라인 모드(-NoBranch, 워크트리가 이미 자기 브랜치)로 직접 실행.
    $inner = "& `"$PSCommandPath`" -Ticket `"$ticketRel`" -Engine $Engine -NoBranch"
    if ($DryRun) {
        Info "[dry-run] 워크트리 생성 + 새 터미널:"
        Write-Host "  `"$orca`" worktree create --repo path:$repo --name $wtName --base-branch $Base --no-parent --json"
        Write-Host "  `"$orca`" terminal create --worktree id:<신규wtId> --title impl:$wtName --command `"$inner`" --focus --json"
        exit 0
    }
    Info "격리 워크트리 생성: $wtName (base: $Base)"
    $wtOut = & $orca worktree create --repo "path:$repo" --name $wtName --base-branch $Base --no-parent --json 2>&1 | Out-String
    $wtId = $null; $wtPath = $null; $wtBranch = $null
    try { $j = $wtOut | ConvertFrom-Json; $wtId = $j.result.worktree.id; $wtPath = $j.result.worktree.path; $wtBranch = $j.result.worktree.branch } catch {}
    if (-not $wtId) { Write-Host $wtOut; Fail "워크트리 생성 실패(이미 있으면 'orca worktree rm --worktree name:$wtName --force')." }
    Info "워크트리 경로: $wtPath / 브랜치: $wtBranch"
    Info "새 Orca 터미널에서 $Engine 구현 시작..."
    $tOut = & $orca terminal create --worktree "id:$wtId" --title "impl:$wtName" --command $inner --focus --json 2>&1 | Out-String
    $handle = $null
    try { $handle = ($tOut | ConvertFrom-Json).result.terminal.handle } catch {}
    if (-not $handle) { Write-Host $tOut; Fail "터미널 생성 실패(워크트리는 남음: $wtPath)." }
    Write-Host ""
    Write-Host "ORCA-HANDOFF worktreeId=$wtId"
    Write-Host "ORCA-HANDOFF worktreePath=$wtPath"
    Write-Host "ORCA-HANDOFF worktreeBranch=$wtBranch"
    Write-Host "ORCA-HANDOFF terminalHandle=$handle"
    Write-Host ""
    Info "감독: 완료 대기 → `"$orca`" terminal wait --terminal $handle --for tui-idle --json"
    Info "감독: 검수     → git -C `"$wtPath`" diff $Base"
    exit 0
}

# 인라인 대신 (현재 체크아웃 공유) 새 터미널 탭을 띄워 그 안에서 구현시킨다.
# 새 탭 cwd = 워크트리 루트. 새 탭이 스스로 브랜치 체크아웃 + 엔진 실행을 하도록
# implement.ps1 을 인라인 모드(-NewTerminal 없이)로 재귀 호출한다.
if ($NewTerminal) {
    $orca = Resolve-Orca
    $sideArg = if ($Side) { $Side } elseif ($ticketRel -match '/(be|fe)/') { $Matches[1] } else { '' }
    # 새 탭 셸은 이미 PowerShell 이므로 powershell.exe 를 중첩하지 않고 & 로 이 스크립트를
    # 인라인 모드(-NewTerminal 없이)로 직접 실행한다. 절대경로+큰따옴표로 공백에 안전.
    $inner = "& `"$PSCommandPath`" -Ticket `"$ticketRel`" -Engine $Engine"
    if ($sideArg) { $inner += " -Side $sideArg" }
    if ($Base) { $inner += " -Base $Base" }
    $title = 'impl:' + [IO.Path]::GetFileNameWithoutExtension($ticketRel)
    if ($DryRun) {
        Info "[dry-run] 새 Orca 터미널 생성 명령:"
        Write-Host "  `"$orca`" terminal create --worktree active --title `"$title`" --command `"$inner`" --focus --json"
        exit 0
    }
    Info "새 Orca 터미널에서 구현 시작 → $title (엔진: $Engine)"
    $out = & $orca terminal create --worktree active --title $title --command $inner --focus --json 2>&1 | Out-String
    $handle = $null
    try { $handle = ($out | ConvertFrom-Json).result.terminal.handle } catch {}
    if ($handle) {
        Info "터미널 핸들: $handle"
        Info "진행 읽기:  `"$orca`" terminal read --terminal $handle --json"
        Info "완료 대기:  `"$orca`" terminal wait --terminal $handle --for tui-idle --json"
    }
    else { Write-Host $out }
    exit 0
}

$dirty = (& git -C $repo status --porcelain)
if ($dirty -and -not $DryRun) {
    Write-Host "[implement] 경고: 워킹 트리에 커밋 안 된 변경." -ForegroundColor Yellow
    $dirty | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" }
    $ans = Read-Host "계속할까요? (y/N)"; if ($ans -notmatch '^[Yy]') { Fail "중단." }
}

if (-not $NoBranch) {
    $exists = (& git -C $repo branch --list $branch)
    if ($DryRun) { Info "[dry-run] base '$Base' → '$branch' 체크아웃" }
    elseif ($exists) { Info "'$branch' 존재 → 체크아웃"; & git -C $repo checkout $branch | Out-Null }
    else {
        Info "base '$Base' 에서 '$branch' 생성"
        & git -C $repo fetch origin $Base --quiet 2>$null
        & git -C $repo checkout -b $branch $Base | Out-Null
        if ($LASTEXITCODE -ne 0) { Info "base '$Base' 없음 → 현재 HEAD 에서 분기"; & git -C $repo checkout -b $branch | Out-Null }
    }
}
$curBranch = (& git -C $repo rev-parse --abbrev-ref HEAD).Trim()
Info "작업 브랜치: $curBranch"

$prompt = @"
너는 이 리포에서 $kind 1개를 구현하는 에이전트다. 지금 브랜치는 '$curBranch'.
읽을 ${kind}: $ticketRel  (도메인 폴더면 그 안의 README·플로우/요소 또는 데이터/기능 문서를 전부 읽어라)
규약 SoT: docs/arch/ARCHITECTURE.md (먼저 읽어라).
규칙(엄수):
1. $kind 를 끝까지 읽고 「구현목표/수용기준」(도메인 폴더면 데이터.md·기능_*.md 또는 플로우·요소)대로만 구현한다.
2. 「경계 — 하지 말 것」을 절대 어기지 않는다: 지정 범위 밖 수정·재설계·리네이밍·겸사겸사 리팩터·새 의존 추가 금지. 의존 도메인은 읽기만.
3. 코드 영문 / 주석·문서 한국어. 명명·직렬화는 ARCHITECTURE 컨벤션을 따른다.
4. 「수용 기준」을 모두 충족한다(엣지 케이스 행이 있으면 각 행도).
5. 모호해 추측이 필요하거나 '[입력 필요]' 슬롯이 남았으면 구현하지 말고 무엇이 막혔는지 한국어로 보고하고 멈춘다.
6. 끝나면 변경 요약 + 수용 기준 충족 여부 + (해당되면) 일지에 남길 결정 1줄을 보고한다. push 는 하지 마라.
지금 $kind 를 구현하라.
"@

function Resolve-Bin([string[]]$names) {
    foreach ($n in $names) { $c = Get-Command $n -ErrorAction SilentlyContinue; if ($c) { return $c.Source } }
    return $null
}
if ($DryRun) { Info "[dry-run] 엔진=$Engine. 프롬프트:"; Write-Host $prompt; exit 0 }

if ($Engine -eq 'codex') {
    $bin = Resolve-Bin @('codex', 'codex.cmd', 'codex.exe')
    if (-not $bin) { Fail "codex 실행 파일을 못 찾음. PATH 확인 또는 -Engine claude." }
    Info "codex 실행 (workspace-write)..."
    & $bin 'exec' '--cd' $repo '--sandbox' 'workspace-write' $prompt
}
else {
    $bin = Resolve-Bin @('claude', 'claude.cmd', 'claude.exe')
    if (-not $bin) { Fail "claude 실행 파일을 못 찾음. PATH 확인 또는 -Engine codex." }
    Info "claude 실행 (헤드리스)..."
    & $bin '-p' $prompt
}
$code = $LASTEXITCODE
Write-Host ""
if ($code -eq 0) { Info "엔진 종료(exit 0). 'git -C `"$repo`" diff' 로 검토 후 커밋·푸시는 직접." }
else { Write-Host "[implement] 엔진 비정상 종료(exit $code)." -ForegroundColor Yellow }
exit $code
