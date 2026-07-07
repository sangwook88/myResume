---
id: sketch-vision-alignment
title: sketch 단계 신설 — 저코스트 목업으로 비전 합맞춤, qa 제거
project: fe-be-ddd
status: published
tags: [featured, 기획파이프라인, 프로세스]
commits: [b5a78b4]
updated: 2026-06-29
---

## 제목·요약
brainstorm(텍스트 브리프) 직후에 sketch(저코스트 클릭형 HTML 목업) 단계를 신설해, 도메인 분할 전에 사람과 AI가 "같은 제품을 상상하는지" 눈으로 합을 맞추게 했다. 동시에 스펙 이후의 고비용 재데모였던 qa 단계를 제거했다(sketch가 그 역할을 흡수).

## 배경
기획 전단은 brainstorm(설계 브리프) → decompose(도메인 분할)로 이어진다. 그 사이 합의가 텍스트로만 이뤄지고, 만들 것을 클릭해 확인하는 qa 단계는 스펙을 다 뽑은 뒤에 있었다.

## 문제
텍스트 합의는 오해가 남는다. 스펙을 전부 도출한 다음 데모(qa)에서 "이게 아닌데"가 나오면 재작업 비용이 크다 — 검증이 파이프라인 후반에 있어 비쌌다.

## 고려한 옵션
| 옵션 | 장점 | 단점 | 채택 |
|---|---|---|---|
| 텍스트 브리프만으로 decompose 진행 | 단계 적음 | 비전 오해가 분할까지 전파 | X |
| 스펙 후 qa 데모로 검증 | 실물 확인 | 검증이 후반 → 재작업 비쌈 / 스펙 후 재데모 중복 | X |
| decompose 전 저코스트 목업(sketch)으로 합맞춤 | 값싸게 조기 검증 / 목업이 FE 플로우를 구체화 | 목업 제작 한 단계 추가 | O |

## 결정과 근거
brainstorm 직후 sketch를 신설했다. 저코스트 클릭형 목업으로 제품 전체 비전을 눈으로 맞추고, 수정을 설계 브리프에 되먹인다. sketch 목업이 FE 플로우를 구체화하므로 decompose가 FE·BE를 firm하게 긋고 plan-fe·plan-be를 sketch 공유 소스로 한 패스에 깐다(코스펙). qa는 제거했다 — "만들 걸 클릭해 확인"하는 역할을 sketch가 앞에서 흡수하니, 스펙 후 고비용 재데모는 중복(YAGNI)이다.

## 실행
- `b5a78b4`: 파이프라인을 brainstorm → sketch → roadmap → decompose → 코스펙 → distill → arch → ticket으로 재편. sketch를 신규 추가하고, qa 경로·게이트를 sketch·distill로 교체(conventions·desk·distill·arch·ticket·dev·plan·README 참조 재배선).

## 결과
decompose 이전에 저코스트 목업으로 비전을 정렬하게 됐다. 스펙 도출이 sketch에서 나오므로 후반 재데모가 사라졌고, sketch 공유 소스로 FE·BE 코스펙을 한 패스에 까는 흐름이 생겼다.

## 회고
"검증을 앞으로 당기고 값싸게(shift-left)"가 핵심이었다. 비싼 후반 재데모(qa)보다 값싼 초반 목업(sketch)이 비전 오해를 더 일찍·싸게 잡는다. 단계를 하나 늘렸지만, 늘린 곳이 가장 값싼 지점이라 전체 비용은 오히려 줄었다.

## Evidence
| 종류 | 라벨 | 링크 |
|---|---|---|
| commit | feat(plan): sketch 단계 추가 + sketch 기반 FE/BE 코스펙, qa 제거 | https://github.com/lsc892/Project_DDD/commit/b5a78b4 |
