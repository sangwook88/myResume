// fe/browse ↔ fe/chat 다리(v2 하이브리드 고급화): 콘텐츠에서 챗봇을 열고
// 주어진 질문을 자동 전송하도록 트리거하는 경량 커스텀 이벤트. ChatFab가 수신한다.

export const ASK_EVENT = 'portfolio:ask';

export interface AskDetail {
  question: string;
}

/** 챗봇을 열고 주어진 질문을 자동 전송한다(읽다가 → 묻기 다리). */
export function askChat(question: string): void {
  if (typeof window === 'undefined') return;
  const q = question.trim();
  if (!q) return;
  window.dispatchEvent(new CustomEvent<AskDetail>(ASK_EVENT, { detail: { question: q } }));
}
