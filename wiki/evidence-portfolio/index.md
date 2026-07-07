---
name: 근거기반 포트폴리오 (Project_PO)
summary: 커밋·PR로 검증되는 근거기반 포트폴리오 — 채용자가 위키를 둘러보고 챗봇에 근거로 묻는다. 콘텐츠는 DB 없이 git 마크다운.
role: 1인 기획·설계·구현
period: 2026.06 ~ 2026.07
teamSize: 1
techStack:
  - Next.js (FE · SSG/ISR)
  - FastAPI (BE · 콘텐츠 서빙)
  - LangChain + Claude Sonnet 5 (챗봇)
  - Redis (세션 TTL)
  - git Markdown (콘텐츠 저장소)
architecture: "콘텐츠는 관계형 DB 없이 git 마크다운 위키(wiki/<project>/*.md)이고, FastAPI(be/point·be/project)가 이를 파싱해 camelCase JSON으로 서빙하면 Next.js가 SSG/ISR로 fetch한다. be/chat은 published 코퍼스를 load-all해 Claude(프롬프트 캐싱)로 SSE 스트리밍 답변 + Evidence 인용하고, 세션은 Redis(TTL 1일 sliding)에 둔다."
highlights:
  - 콘텐츠 저장소로 관계형 DB 대신 git 마크다운 채택 → 클론·포크로 셀프호스팅하는 배포 모델
  - 발행 게이트 — Evidence(커밋·PR·Swagger) 최소 1개 없으면 published 불가로 "근거 강제"
  - load-all + 프롬프트 캐싱으로 published 코퍼스를 Claude에 통째로 주입, 답변에 Evidence 인용 + 근거 없으면 거부(환각 방지)
  - v1은 RAG 대신 load-all로 단순화(RAG는 v3로 미룸), 저작은 로컬 Claude Code(무과금)·챗봇만 API
---
