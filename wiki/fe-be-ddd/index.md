---
summary: 막연한 아이디어를 FE/BE 도메인 마크다운 위키로 구체화해 구현까지 끌고 가는 Claude Code 에이전트·스킬 번들
role: 1인 기획·설계·구현
period: 2026.06 ~ 2026.07
teamSize: 1
techStack:
  - Claude Code (agents/skills)
  - Markdown
  - Node.js
  - PowerShell
  - GitHub Actions
architecture: "Claude Code 에이전트+스킬 번들. npx 인스톨러(install.mjs)가 ~/.claude(전역) 또는 프로젝트 .claude에 평탄 설치하고 ${DDD_ROOT} 토큰을 위치 독립 참조로 치환한다. 스킬(마크다운 지침)+에이전트+템플릿/스크립트로 구성되며, 산출물은 대상 프로젝트의 docs/ 위키(HOME 참조 그래프 색인 → FE/BE 도메인 폴더)다. home-check·context-pack 등 Node 스크립트가 그래프 정합성 검증과 콜드스타트 컨텍스트 압축을 담당한다."
highlights:
  - 아이디어→구현 8단계 기획 파이프라인을 Claude Code 스킬 13종·에이전트 4종으로 자동화
  - 산출물 = 단일책임 마크다운 도메인 폴더 — 사람이 읽는 문서이자 AI가 그대로 구현하는 계약서
  - FE→BE 단방향 참조 그래프 + CI 게이트(home-check)로 위키 정합성 자동 검증
  - npx 한 줄 설치 + ${DDD_ROOT} 토큰 치환으로 위치 독립(전역/프로젝트 격리 이식)
---
