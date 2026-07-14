'use client';

// fe/browse v2 (B) — 섹션 옆 "이거 물어보기" 버튼. 그 섹션 맥락 질문으로 챗봇 프리시드.
// (텍스트 드래그 선택형은 v3 인라인 선택-질문 — 여기선 버튼형까지만.)
import { askChat } from '@/lib/askChat';

export default function AskSectionButton({ question }: { question: string }) {
  return (
    <button
      type="button"
      className="ask-sec"
      title="이 내용을 챗봇에 질문하기"
      onClick={() => askChat(question)}
    >
      챗봇에 질문
    </button>
  );
}
