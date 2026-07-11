'use client';

// fe/chat — 대화 로그. 말풍선 멀티턴 + 답변 하단 근거 링크(외부 새 탭).
// role="log" + aria-live="polite"(요소/질문-응답 접근성). 스트리밍 중엔 로딩 인디케이터.
// 봇 답변은 마크다운으로 렌더(react-markdown+gfm) — 목록·코드·표·강조를 서식대로.
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Citation, PointRef } from '@/lib/chatClient';

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  /** 답변 끝 인용 근거(bot 전용, 없으면 undefined). */
  citations?: Citation[];
  /** 인용 근거가 나온 출처 포인트(bot 전용) — 둘러보기 딥링크(v2 하이브리드). */
  points?: PointRef[];
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

  // 스트리밍 토큰마다 스크롤하면 읽는 중에 화면이 계속 밀려 방해된다 →
  // "새 턴(말풍선 추가·에러)"일 때만 최신으로 이동하고, 답변이 흘러내리는 동안엔
  // 스크롤을 건드리지 않아 사용자가 위에서부터 읽을 수 있게 한다.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, error]);

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
          {m.role === 'bot' ? (
            <div className="md">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, ...props }) => (
                    <a target="_blank" rel="noopener noreferrer" {...props} />
                  ),
                }}
              >
                {m.text}
              </ReactMarkdown>
            </div>
          ) : (
            m.text
          )}
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
          {m.points && m.points.length > 0 && (
            <div className="rel-points">
              <div className="lbl">관련 포인트</div>
              {m.points.map((p) => (
                <Link
                  key={p.id}
                  className="rel-point"
                  href={`/points/${encodeURIComponent(p.id)}`}
                >
                  <span className="lbltext">{p.title}</span>
                  <span className="chev" aria-hidden="true">›</span>
                </Link>
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
