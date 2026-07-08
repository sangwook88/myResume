'use client';

// fe/browse v2 (A) — 포인트 하단 인라인 추천질문. 읽던 흐름 안에서 클릭 →
// 챗봇 열림 + 그 질문 자동 전송(패턴: 스타터를 인터페이스에 직접 배치해 수동↔능동 다리).
import { askChat } from '@/lib/askChat';

export default function AskChips({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;
  return (
    <section className="ask-inline">
      <div className="section-label">이 포인트에 대해 물어보기</div>
      <div className="ask-chips">
        {questions.map((q) => (
          <button key={q} type="button" className="ask-chip" onClick={() => askChat(q)}>
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}
