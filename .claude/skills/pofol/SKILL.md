---
name: pofol
description: 코드 레포 1개(로컬 경로 또는 GitHub URL)를 근거기반 포트폴리오 항목으로 저작한다 — git 이력을 캐서 표지(index.md)와 STAR+ADR 포인트를 wiki/<slug>/ 에 쓰고, 실제 커밋·PR을 Evidence로 인용한 뒤 발행 게이트로 검증한다. "포폴 만들어줘", "이 레포 포폴로 올려줘", "레포 문서화", "/pofol" 류에 사용.
---

# pofol — 레포 → 근거기반 포트폴리오 항목 저작

코드 레포 1개를 `wiki/<slug>/` 항목(표지 + 포인트 N개)으로 만든다. **근거 = 실제 git 커밋·PR**이다.
**모든 응답은 한글.** 저작은 로컬 Claude Code에서 하므로 API 과금이 없다(서빙 챗봇만 API).

## 절대 규칙 (값을 짓지 않는다)

- **사람만 아는 값은 짓지 않는다**: `role`·`teamSize`는 사용자에게 묻고, 없으면 `[입력 필요]` 슬롯으로 둔다. `period`는 커밋 날짜에서 뽑아 **제안**하되 사용자 확인을 받는다.
- **Evidence는 실재하는 커밋/PR만**. 해시·PR 번호·날짜는 git에서 확인한 것만 쓴다(추측 금지). 날짜는 `git log --date=short`.
- 포인트 서사(문제·결정·회고)는 **커밋 메시지 본문에 실제로 적힌 내용**에서 도출한다. 없는 성과를 지어내지 않는다.

## 0. 입력

- **대상 레포**: 로컬 경로 또는 GitHub `owner/repo`(URL). 불명확하면 묻는다.
- **사람만 아는 값**: role(예 "1인 기획·설계·구현")·teamSize. 먼저 물어보거나, 못 받으면 `[입력 필요]`로 두고 진행.
- **slug**: kebab. 보통 레포명. `wiki/<slug>/` 폴더가 항목 단위. 포인트의 `project:` 는 이 slug와 반드시 일치.

## 1. 수집 (git 이력 마이닝)

- GitHub면 스크래치패드에 클론: `gh repo clone <owner>/<repo> -- --depth 200` (gh 경로: `C:\Program Files\GitHub CLI\gh.exe`). 로컬이면 그 경로 사용.
- **표지 재료**: `README`·`package.json`/매니페스트에서 이름·한줄요약·기술스택·구조를 읽는다.
- **포인트 재료**: `git log --oneline`, 타입 분포, 그리고 **ADR감 커밋 아크**를 찾는다 —
  결정(옵션 있는)·리팩토링·기능 재설계·아키텍처 단순화. 각 아크의 커밋 본문(`git log -1 --format='%s%n%b' <hash>`)·PR 번호·날짜(`--date=short`)를 확보.

## 2. 표지 `wiki/<slug>/index.md`

frontmatter (be/project 계약): `name`(표시 이름)·`summary`·`role`·`period`·`teamSize`·`techStack`(목적 라벨 붙이면 좋음)·`architecture`(2문장 내 압축)·`highlights`(3~4개, 실제 사실). role/teamSize 미확정이면 `[입력 필요]`.

> **문구 압축 (표지·포인트 공통)**: `summary`는 **핵심 한 문장으로 압축**한다 — 콤마로 절을 잇달아 나열하지 말고, 채용자가 3초에 이해하는 한 문장. 처음부터 압축해서 쓴다(장황하게 쓴 뒤 나중에 줄이지 않는다). `architecture`도 2문장 내로, `highlights`는 각 한 줄.

## 3. 포인트 `wiki/<slug>/<id>.md` (STAR+ADR 9섹션)

be/point 파서가 인식하는 **H2 헤딩 그대로** 쓴다(부분일치):
`## 제목·요약` / `## 배경` / `## 문제` / `## 고려한 옵션`(표) / `## 결정과 근거` / `## 실행` / `## 결과` / `## 회고` / `## Evidence`(표).

- frontmatter: `id`(kebab)·`title`·`project`(=slug)·`status: draft`·`tags`·`commits`(해시 리스트)·`updated`(ISO, 실제 커밋 날짜).
  - `title`: **핵심만 짧게, "주제: 요점" 콜론형 권장**(카드에서 안 감기게). 콜론이 들어가면 frontmatter에서 **반드시 따옴표로 감싼다** — `title: "콘텐츠 저장소: 관계형 DB 대신 git 마크다운"`. 안 그러면 YAML 파싱이 깨진다.
  - `tags`: `featured`는 홈 추천에 노출된다 — **전 포인트에 남발하지 말고 포트폴리오 전체에서 대표작 2~3개만** 준다(전부 featured면 추천이 "최신 3개"로 무의미해지고 한 프로젝트만 노출됨).
- **고려한 옵션 표** 컬럼: `옵션 | 장점 | 단점 | 채택`(O/X). 결정에 대안이 있었으면 꼭 채운다(ADR 핵심).
- **Evidence 표** 컬럼: `종류 | 라벨 | 링크`. 링크 = `https://github.com/<owner>/<repo>/commit/<hash>` 또는 `/pull/<n>`.
- 좋은 항목이 되려면 **한 프로젝트당 3~5 포인트**를 권장(성격이 겹치지 않게: 설계결정/기술깊이/리팩토링/프로세스 등으로 분산).

## 4. 발행 게이트 검증

각 포인트마다 `backend/.venv/Scripts/python.exe scripts/publish.py <id>` 실행.
게이트 = title + 요약(1) + 문제(3) + 결정과 근거(5) + Evidence≥1(9). 통과 시 `status: published`로 승격, 미충족이면 사유를 보고하고 그 포인트를 보강한다.

## 5. 미리보기·보고

- 반영 확인: BE는 wiki 파일을 요청마다 읽으므로 재기동 불필요. `/setting`으로 서버가 떠 있으면 브라우저(localhost:3000)에서 바로 보인다.
- 사용자에게 보고: 만든 표지·포인트 목록, `[입력 필요]`로 남긴 값(role/teamSize/period 확인), 다음 제안(포인트 추가 / 커밋).
- **커밋은 사용자가 요청할 때만**. push 안 함.
