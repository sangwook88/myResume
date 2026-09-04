---
id: v1-load-all-not-rag
title: "v1 챗봇 서빙: RAG 대신 load-all + 프롬프트 캐싱"
project: grounded-resume
status: published
tags: [설계결정, 챗봇]
commits: [a3e354b, 2e1024f, 4a2e075]
updated: 2026-06-27
---

## 제목·요약
근거기반 챗봇의 v1 서빙을 벡터 검색(RAG)이 아니라 published 코퍼스를 통째로 주입하는 load-all로 정했다. 코퍼스가 크고 안정적인 prefix라, 프롬프트 캐싱(cache_control)으로 입력 비용을 방어한다. RAG는 필요 신호가 올 때(v3) 도입한다.

## 배경
챗봇은 published 포인트를 근거로만 답해야 한다. 근거를 어떻게 모델에 넣을지 — 관련 조각만 검색해 넣을지(RAG), 전부 넣을지(load-all) — 가 서빙 아키텍처의 첫 갈림길이었다.

## 문제
RAG는 임베딩 모델·벡터 인덱스·청킹·검색 튜닝을 요구한다. v1 규모(포인트 수십 개)에서 이 복잡도는 과설계고, 잘못 튜닝하면 오히려 관련 근거를 놓쳐 답변 품질이 떨어진다.

## 고려한 옵션
| 옵션 | 장점 | 단점 | 채택 |
|---|---|---|---|
| RAG (벡터 검색) | 대규모 코퍼스 확장성 | 임베딩·인덱스·청킹·튜닝 비용 / 소규모엔 과설계 / 검색 실패 리스크 | X (v3로) |
| load-all (전부 주입) | 누락 없음 · 단순 · 캐싱으로 비용 방어 | 컨텍스트 예산 상한 존재 | O |

## 결정과 근거
v1은 load-all로 간다. published 코퍼스는 크지만 안정적인 prefix라 프롬프트 캐싱의 캐시 대상이 되어, 턴·사용자 간 재사용으로 입력 비용이 크게 준다. 소규모에서 "전부 주입"은 검색 실패가 원천적으로 없어 근거 누락이 없다. 컨텍스트 예산 초과는 막지 않고 경고만 남기며, 그 초과 자체가 RAG(v3) 도입 신호가 된다. 위키 구조를 RAG 4레이어에 매핑해 v1=Stage1(load-all)에서 시작해 점증 성장하는 사다리로 설계했다.

## 실행
- `a3e354b`: 검색/서빙 레이어 설계 — 위키 구조↔RAG 4레이어 매핑, Small-to-big, Stage 0~3 성장 사다리(v1=Stage1) 정의.
- `2e1024f`: v1 스코프에서 RAG를 명시적으로 v3로 제외.
- `4a2e075`: be/chat 구현 — published load-all 코퍼스 + cache_control 프롬프트 캐싱으로 실제 서빙.

## 결과
v1 챗봇이 임베딩·인덱스 없이 동작한다. 근거 누락 없이 답하고, 프롬프트 캐싱으로 반복 호출 입력 비용을 낮췄다. 규모가 커져 예산을 넘기면 그때 RAG로 진화할 수 있게 사다리를 남겨뒀다.

## 회고
"확장성 있는 정답(RAG)"을 v1부터 넣는 대신, 지금 규모에 맞는 단순한 수단(load-all)을 택하고 성장 경로만 열어둔 YAGNI 판단이었다. 복잡도는 필요가 증명될 때 도입하는 게 싸다.

## Evidence
| 종류 | 라벨 | 링크 |
|---|---|---|
| commit | [Docs] 검색/서빙 레이어(RAG 4레이어 매핑·Stage 사다리, v1=Stage1) | https://github.com/sangwook88/Grounded-Resume/commit/a3e354b |
| commit | [Docs] v1 스코프 재확정 — RAG를 v3로 제외 | https://github.com/sangwook88/Grounded-Resume/commit/2e1024f |
| commit | [Feat] be/chat — load-all 코퍼스 + 프롬프트 캐싱 구현 | https://github.com/sangwook88/Grounded-Resume/commit/4a2e075 |
