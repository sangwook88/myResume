'use client';

// fe/chat — 대화 로그. 말풍선 멀티턴 + 답변 하단 근거 링크(외부 새 탭).
// role="log" + aria-live="polite"(요소/질문-응답 접근성). 스트리밍 중엔 로딩 인디케이터.
import { useEffect, useRef } from 'react';
import type { Citation } from '@/lib/chatClient';

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  /** 답변 끝 인용 근거(bot 전용, 없으면 undefined). */
  citations?: Citation[];
}

const KIND_CLASS = new Set(['commit', 'pr', 'swagger']);
function citationClass(kind: string): string {
  const k = kind.toLowerCase();
  return KIND_CLASS.has(k) ? k : '';
}

export default function MessageList({
  messages,
  loading,
  error,
  emptyHint,
  onRetry,
}: {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  emptyHint: string;
  onRetry: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  // 새 토큰·메시지마다 최신으로 스크롤.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading, error]);

  const last = messages[messages.length - 1];
  const showTyping = loading && (!last || last.role !== 'bot' || last.text === '');

  return (
    <div className="log" role="log" aria-live="polite">
      {messages.length === 0 && !loading && !error && (
        <div className="chat-empty">
          <span className="big" aria-hidden="true">💬</span>
          {emptyHint}
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} className={`bubble ${m.role === 'user' ? 'me' : 'bot'}`}>
          {m.text}
          {m.citations && m.citations.length > 0 && (
            <div className="evi">
              <div className="lbl">근거</div>
              {m.citations.map((c, j) => (
                <a key={j} href={c.url} target="_blank" rel="noopener noreferrer">
                  <span className={`tag2 ${citationClass(c.kind)}`}>{c.kind}</span>
                  <span className="lbltext">{c.label}</span>
                  <span className="ext" aria-hidden="true">새 탭 ↗</span>
                </a>
              ))}
            </div>
          )}
        </div>
      ))}

      {showTyping && (
        <div className="typing" aria-label="답변 생성 중">
          <span></span><span></span><span></span>
        </div>
      )}

      {error && (
        <div className="chat-error" role="alert">
          {error}
          <div>
            <button type="button" onClick={onRetry}>다시 시도</button>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
