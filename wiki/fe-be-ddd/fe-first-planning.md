---
id: fe-first-planning
title: 기획 전단을 FE-first로 — BE를 FE 플로우에서 도출
project: fe-be-ddd
status: published
tags: [featured, 설계결정, 기획파이프라인]
commits: [80472c1, 4f8ca48]
updated: 2026-06-27
---

## 제목·요약
FE/BE 도메인을 기획할 때 순서 없는 "짝(peer)"이던 plan-fe·plan-be를, "FE 선행 → BE 도출"로 명시했다. BE는 FE 요소의 호출에서 파생되는 종속 산출물로 규정하고, decompose 단계의 BE 경계는 잠정(provisional)으로 두었다가 plan-fe 뒤에 도출·확정한다.

## 배경
이 프레임워크는 FE=플로우+표현, BE=데이터+기능으로 도메인을 가른다. plan-fe와 plan-be가 순서 없이 나란한 짝으로 서술돼 있어, 무엇을 먼저 확정할지가 모호했다.

## 문제
BE(데이터·기능)를 먼저 확정하면, FE가 실제로 무엇을 호출하는지 모른 채 데이터 모델을 추측하게 된다 → 안 쓰는 필드·기능이 생기고, FE를 짜다 보면 BE를 되돌려 고치는 재작업이 발생한다.

## 고려한 옵션
| 옵션 | 장점 | 단점 | 채택 |
|---|---|---|---|
| FE·BE 무순서 짝(peer) | 유연 | 무엇을 먼저 고정할지 모호 / 추측·재작업 | X |
| BE-first (데이터부터 확정) | 데이터 모델 안정 | FE 호출을 모른 채 추측 → 안 쓰는 스키마 낭비 | X |
| FE-first (플로우부터 → BE 도출) | FE 실제 호출에서 BE가 파생 → 낭비 없음 | FE 플로우가 막연하면 BE 도출을 미뤄야 | O |

## 결정과 근거
FE-first로 확정했다. FE 플로우가 부르는 것에서 BE 데이터·기능을 도출하면, 실제로 쓰이는 것만 BE에 남아 추측·낭비가 사라진다. decompose에서 BE 경계는 잠정으로 긋고 plan-fe 뒤 도출·확정하며, FE 플로우가 막연하면 BE 분할을 미뤄도 된다. 중요한 통찰: **기획 순서는 FE→BE(도출)이지만 구현 순서는 BE→FE(의존)** — FE가 부르는 기능이 먼저 있어야 하므로 구현 정렬은 반대다. 참조 방향(FE→BE 단방향)과도 정렬된다.

## 실행
- `80472c1`: plan-fe에 FE-first 명시(step 5를 BE 도출로, step 6에서 plan-be 호출을 표준 다음 단계로), plan-be 전제를 plan-fe 선행으로, decompose는 BE 경계를 잠정으로, README·conventions에 기획 순서(FE-first)와 구현 순서(BE-first)를 구분 명시.
- `4f8ca48` (PR #10): 위 재정렬 병합.

## 결과
기획이 FE 플로우가 이끌고 BE가 그 호출에서 도출되는 단방향 흐름이 됐다. "쓰지도 않을 BE"를 미리 추측하는 낭비가 제거됐고, 참조 그래프의 FE→BE 단방향과 일관성을 이뤘다.

## 회고
기획 순서와 구현 순서가 반대라는 게 핵심 통찰이었다. 사람은 화면(FE)으로 제품을 상상하므로 기획은 FE에서 출발해야 자연스럽고, 기계는 의존이 먼저 있어야 하므로 구현은 BE에서 출발해야 한다. 두 순서를 뒤섞지 않고 분리해 명문화한 것이 성과다.

## Evidence
| 종류 | 라벨 | 링크 |
|---|---|---|
| commit | feat(plan): 기획 전단을 FE-first로 — BE를 FE 플로우에서 도출 | https://github.com/lsc892/Project_DDD/commit/80472c1 |
| pr | 기획 전단 FE-first 재정렬 (#10) | https://github.com/lsc892/Project_DDD/pull/10 |
