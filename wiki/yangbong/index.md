---
name: 양봉 ㈜ — BDSGPT · AuraSpot
summary: 부동산(BDSGPT)과 주거공간 운세(AuraSpot) 두 앱에서 백엔드와 AI를 담당했다. OpenAI RAG 챗봇·서버리스 백엔드·실시간 채팅·결제 연동.
role: 백엔드 · AI 담당 (UI·앱 기본 구조 설계는 대표/공동 개발자)
period: 2025.08 ~ 재직중
teamSize: 2
techStack:
  - Flutter (앱)
  - Kotlin / Android 네이티브 (차기 앱 전환)
  - OpenAI API (RAG 챗봇)
  - Supabase (PostgreSQL · 서버리스)
  - FCM (푸시 알림)
architecture: "Supabase(PostgreSQL) 기반 서버리스 위에 앱이 붙고 OpenAI API로 챗봇을 서빙한다. BDSGPT는 아파트 단위 캐싱 테이블로 반복 조회의 토큰 소모를 없앴고, AuraSpot은 초기 설계 때 BDSGPT의 테이블 대부분을 복제해 같은 스키마 위에서 출발했다."
highlights:
  - OpenAI API 기반 RAG 챗봇 개발 — 부동산 데이터를 근거로 답하는 대화형 검색
  - Supabase(PostgreSQL) 서버리스 아키텍처 설계 및 백엔드 프로세스 자동화
  - 실시간 채팅 시스템 설계 · FCM 푸시 알림 · 결제 시스템 연동
  - 차기 앱을 Flutter에서 Android 네이티브로 전환 결정 (라이브러리·OS 권한 제약 + 업계 정합성)
---
