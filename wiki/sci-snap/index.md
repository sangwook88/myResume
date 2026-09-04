---
name: SCI-Snap — 사진으로 과학을 묻는 챗봇
summary: 사진을 찍으면 사물을 인식하고 거기서 과학 현상(예: 흰색 탁한 물 → 백수효과)을 뽑아, 초등 교과서를 근거로 어린이 눈높이에 맞춰 설명하는 앱. STDev Science Hackathon 4인 팀 프로젝트.
role: 챗봇 백엔드(AWS Lambda) · 앱 프론트엔드(Flutter)
period: 2026.04.12 ~ 2026.04.27
teamSize: 4
techStack:
  - AWS Lambda (서버리스 API)
  - GPT-4o · gpt-4o-mini (Vision · 의도분류)
  - Supabase (대화 이력 · 하이브리드 검색 RPC)
  - text-embedding-3-large (임베딩)
  - YOLOv8 · FlutterFlow
architecture: "AWS Lambda 단일 핸들러가 mode(default·child·detect·child_detect)로 분기한다. child 모드는 의도 분류(gpt-4o-mini)로 잡담과 과학 질문을 가른 뒤, 사진·텍스트에서 objects·science_concepts·keywords 를 뽑아 Supabase 하이브리드 검색(벡터 + 풀텍스트 RRF)으로 초등 과학 교과서를 찾고, 그 근거로 어린이 눈높이 답변을 생성한다. 대화 이력은 conversation_id 로 Supabase 에 보관한다."
highlights:
  - 사진 → 사물 인식 → 과학 현상 추출 → 교과서 근거 설명까지 한 흐름으로 연결
  - 하이브리드 검색(벡터 + 풀텍스트 RRF)으로 교과서 근거 검색
  - 의도 분류로 잡담이면 RAG 를 건너뛰어 비용·지연 절감
  - 팀 전원이 직장·일정으로 대회 당일에만 작업 가능한 조건에서 4개 응답 모드를 갖춘 서버리스 API 완성
  - 시연에서 사업화를 권하는 반응
---
