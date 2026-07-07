---
id: publish-gate-evidence
title: "발행 게이트: 근거 없이는 published 불가"
project: evidence-portfolio
status: published
tags: [설계결정, be]
commits: [d8df3ed, c7f0989]
updated: 2026-07-04
---

## 제목·요약
포인트를 draft에서 published로 올릴 때 코드로 검증하는 발행 게이트를 뒀다. Evidence(커밋·PR·Swagger 링크) 최소 1개 + 핵심 섹션(제목·요약 / 문제 / 결정과 근거 / Evidence)이 없으면 발행을 거부한다. "근거기반"을 문서 권고가 아니라 게이트로 강제한다.

## 배경
이 제품의 정체성은 "근거기반"이다. 그런데 사람이 포인트를 쓸 때 근거 없이 성과만 자랑하면 포폴이 공허해지고, 정체성이 말뿐이 된다.

## 문제
"근거를 달자"는 가이드 문서는 잘 지켜지지 않는다. 근거의 존재를 어떻게 보장할 것인가 — 신뢰에 맡길지, 시스템이 강제할지.

## 고려한 옵션
| 옵션 | 장점 | 단점 | 채택 |
|---|---|---|---|
| 문서 가이드(권고) | 유연 · 구현 0 | 안 지켜짐 → 근거 없는 포인트가 공개됨 | X |
| 발행 게이트(코드 강제) | 근거 없으면 published 불가 → 정체성 보장 | 저작자가 근거를 채워야 함(의도된 마찰) | O |

## 결정과 근거
draft → published 승격에 게이트를 건다. 검증 = Evidence ≥ 1개 AND 핵심 섹션(1 제목·요약 / 3 문제 / 5 결정과 근거 / 9 Evidence)이 채워짐. 미충족이면 승격을 거부하고 사유를 출력한다. 근거를 채우는 마찰은 버그가 아니라 기능이다 — "근거기반"을 파일 상태(status)로 강제해 서빙 계층은 published만 노출하면 되게 했다. 검증 로직은 be/point 리포지토리에 두고 CLI(`scripts/publish.py`)가 재사용한다(단일 소스).

## 실행
- `d8df3ed`: be/point 구현 — 포인트 조회 API + 발행 게이트(`publish_errors`: 제목·요약·문제·결정과 근거·Evidence≥1 검증). draft는 서빙에서 비노출(302), published만 조회.
- `c7f0989`: ARCHITECTURE에서 발행 게이트 미충족 → 발행 거부를 에러·경계 규약으로 명문화, be/point 패턴(TS) 확정.

## 결과
근거 없는 포인트는 애초에 published가 될 수 없다. 서빙(둘러보기·챗봇)은 published만 읽으므로, 공개되는 모든 포인트가 최소 1개의 실증 근거를 갖는다. 게이트 검증이 API·CLI 단일 소스라 저작·서빙이 같은 규칙을 공유한다.

## 회고
정체성("근거기반")을 슬로건이 아니라 실행 가능한 게이트로 번역한 게 핵심이었다. 저작자에게 근거를 요구하는 마찰을 일부러 남겨, 제품이 주장하는 가치를 코드가 보장하게 했다.

## Evidence
| 종류 | 라벨 | 링크 |
|---|---|---|
| commit | [Feat] be/point — 포인트 조회 API·발행 게이트 | https://github.com/lsc892/Project_PO/commit/d8df3ed |
| commit | [Docs] arch 확정 — 발행 게이트 미충족→거부 규약 | https://github.com/lsc892/Project_PO/commit/c7f0989 |
