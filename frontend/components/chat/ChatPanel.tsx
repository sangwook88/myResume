'use client';

// fe/chat — 챗봇 패널 컨테이너. 데스크톱=우하단 패널 / 모바일=전체화면(CSS).
// 상태 전이(플로우.md): 챗봇열림→질문응답→(이어)질문응답 / 근거링크 새 탭 / 닫기 복귀.
// 세션은 서버 쿠키(be/chat)로 관리 — 로컬 저장 없음. 스트리밍 소비는 lib/chatClient.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSuggestions, streamChat } from '@/lib/chatClient';
import type { Citation } from '@/lib/chatClient';
import { STATIC_SUGGESTIONS } from '@/lib/staticSuggestions';
import MessageList, { type ChatMessage } from './MessageList';
import Composer from './Composer';

const EMPTY_HINT =
  '이 포트폴리오에 대해 무엇이든 물어보세요. 답변에는 근거(커밋·PR·Swagger)가 함께 표시됩니다.';

export default function ChatPanel({
  contextPointId,
  initialQuestion,
  onClose,
}: {
  contextPointId: string | null;
  initialQuestion?: string | null;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(
    contextPointId ? [] : STATIC_SUGGESTIONS,
  );
  const [mode, setMode] = useState<'technical' | 'hr'>('technical');

  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string>('');

  // 진입 맥락별 제안 질문(하이브리드): 포인트 맥락이면 be/chat 동적, 비면 정적 폴백.
  useEffect(() => {
    if (!contextPointId) return;
    const ctrl = new AbortController();
    fetchSuggestions(contextPointId, ctrl.signal).then((items) => {
      setSuggestions(items.length > 0 ? items : STATIC_SUGGESTIONS);
    });
    return () => ctrl.abort();
  }, [contextPointId]);

  // 실제 닫기(× / Esc) 시 진행 중 스트림을 취소하고 상위에 알린다.
  // NOTE: 언마운트 cleanup 으로 abort 하면 React Strict Mode(dev)의 팬텀 언마운트에
  // 오발화해 자동전송(initialQuestion) 스트림을 죽인다(가드 때문에 재전송도 안 됨).
  // 그래서 abort 는 '진짜 닫기' 경로에만 건다.
  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    onClose();
  }, [onClose]);

  // Esc → 닫고 FAB로 포커스 복귀(복귀는 ChatFab가 담당).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const send = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text || loading) return;
      lastQuestionRef.current = text;
      setError(null);
      setLoading(true);
      // 내 말풍선 + 빈 봇 말풍선(스트리밍으로 채워짐).
      setMessages((prev) => [...prev, { role: 'user', text }, { role: 'bot', text: '' }]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // 마지막(봇) 메시지에만 반영하는 헬퍼.
      const patchBot = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => {
          const next = [...prev];
          const i = next.length - 1;
          if (i >= 0 && next[i].role === 'bot') next[i] = fn(next[i]);
          return next;
        });

      streamChat(
        { question: text, context: contextPointId, mode },
        {
          onToken: (t) => patchBot((m) => ({ ...m, text: m.text + t })),
          onCitations: (cits: Citation[]) => patchBot((m) => ({ ...m, citations: cits })),
          onPoints: (pts) => patchBot((m) => ({ ...m, points: pts })),
          onDone: () => setLoading(false),
          onError: (msg) => {
            // 빈 봇 말풍선은 제거하고 에러+재시도 노출.
            setMessages((prev) => {
              const next = [...prev];
              const i = next.length - 1;
              if (i >= 0 && next[i].role === 'bot' && next[i].text === '') next.pop();
              return next;
            });
            setError(msg);
            setLoading(false);
          },
        },
        ctrl.signal,
      );
    },
    [contextPointId, loading, mode],
  );

  const retry = useCallback(() => {
    if (lastQuestionRef.current) send(lastQuestionRef.current);
  }, [send]);

  // 콘텐츠(AskChips·섹션 버튼)에서 넘어온 질문 자동 전송. 같은 질문은 1회만.
  const autoSentRef = useRef<string | null>(null);
  useEffect(() => {
    const q = initialQuestion?.trim();
    if (q && autoSentRef.current !== q) {
      autoSentRef.current = q;
      send(q);
    }
  }, [initialQuestion, send]);

  const ctxLabel = contextPointId ? '맥락: 이 포인트' : '맥락: 전역';

  return (
    <div className="panel" role="dialog" aria-label="포트폴리오 챗봇" aria-modal="false">
      <div className="ph">
        <span className="dot" aria-hidden="true"></span>
        <span className="ttl">포트폴리오 챗봇</span>
        <span className={`ctx ${contextPointId ? '' : 'none'}`}>{ctxLabel}</span>
        <button className="x" type="button" title="닫기 (Esc)" aria-label="닫기" onClick={handleClose}>
          ×
        </button>
      </div>

      <div className="mode-bar">
        <span className="mode-lbl">눈높이</span>
        <div className="mode-seg" role="group" aria-label="답변 눈높이">
          <button
            type="button"
            className={mode === 'technical' ? 'on' : ''}
            aria-pressed={mode === 'technical'}
            onClick={() => setMode('technical')}
          >
            기술
          </button>
          <button
            type="button"
            className={mode === 'hr' ? 'on' : ''}
            aria-pressed={mode === 'hr'}
            onClick={() => setMode('hr')}
          >
            HR
          </button>
        </div>
      </div>

      <MessageList
        messages={messages}
        loading={loading}
        error={error}
        emptyHint={EMPTY_HINT}
        onRetry={retry}
      />

      <Composer
        suggestions={suggestions}
        suggestionLabel={contextPointId ? '관련 질문' : '추천 질문'}
        showSuggestions={messages.length === 0}
        disabled={loading}
        onSend={send}
      />
    </div>
  );
}
