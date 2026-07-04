// fe/chat — 무맥락(전역) 기본 제안질문. 정적 FE 자원.
// 포인트 맥락에서는 be/chat GET /api/chat/suggestions 를 우선 쓰고,
// 그 응답이 비어 있거나 무맥락 진입이면 이 목록으로 폴백한다.
export const STATIC_SUGGESTIONS: string[] = [
  "어떤 프로젝트들을 진행했나요?",
  "가장 어려웠던 기술 문제는 무엇이었나요?",
  "백엔드 경험을 요약해 주세요",
  "성능을 개선한 사례가 있나요?",
];
