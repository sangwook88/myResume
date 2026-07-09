'use client';

// fe/chat — 챗봇 패널(프리젠테이션). 데스크톱=우하단 패널 / 모바일=전체화면(CSS).
// 대화 엔진(messages·전송·세션)은 상위 ChatFab 이 소유하고, 이 컴포넌트는 그 상태를
// 그려내고 사용자 조작을 콜백으로 올린다 — 패널이 언마운트돼도 로그·스트림이 살아있게(#5).
// 자체 소관: 맥락 제안질문 로드, Esc 닫기, 대화 목록(세션 전환) 드롭다운의 열림 상태.
import { useCallback, useEffect, useState } from 'react';
import { fetchSuggestions } from '@/lib/chatClient';
import { STATIC_SUGGESTIONS } from '@/lib/staticSuggestions';
import type { ChatSessionMeta } from '@/lib/chatSessions';
import MessageList, { type ChatMessage } from './MessageList';
import Composer from './Composer';

const EMPTY_HINT =
  '이 포트폴리오에 대해 무엇이든 물어보세요. 답변에는 근거(커밋·PR·Swagger)가 함께 표시됩니다.';

/** 대화 목록에 보일 활동 시각: 오늘이면 HH:MM, 아니면 M/D. */
function formatWhen(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ChatPanel({
  contextPointId,
  messages,
  loading,
  error,
  mode,
  onModeChange,
  onSend,
  onRetry,
  onClose,
  sessions,
  activeId,
  onNewChat,
  onSwitchSession,
  onDeleteSession,
}: {
  contextPointId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  mode: 'technical' | 'hr';
  onModeChange: (m: 'technical' | 'hr') => void;
  onSend: (question: string) => void;
  onRetry: () => void;
  onClose: () => void;
  sessions: ChatSessionMeta[];
  activeId: string | null;
  onNewChat: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>(
    contextPointId ? [] : STATIC_SUGGESTIONS,
  );
  const [showSessions, setShowSessions] = useState(false);

  // 진입 맥락별 제안 질문(하이브리드): 포인트 맥락이면 be/chat 동적, 비면 정적 폴백.
  useEffect(() => {
    if (!contextPointId) return;
    const ctrl = new AbortController();
    fetchSuggestions(contextPointId, ctrl.signal).then((items) => {
      setSuggestions(items.length > 0 ? items : STATIC_SUGGESTIONS);
    });
    return () => ctrl.abort();
  }, [contextPointId]);

  // Esc → 대화 목록이 열려 있으면 그것부터 닫고, 아니면 패널을 닫는다(FAB 포커스 복귀는 ChatFab).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (showSessions) setShowSessions(false);
      else onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, showSessions]);

  const newChat = useCallback(() => {
    setShowSessions(false);
    onNewChat();
  }, [onNewChat]);

  const ctxLabel = contextPointId ? '맥락: 이 포인트' : '맥락: 전역';

  return (
    <div className="panel" role="dialog" aria-label="포트폴리오 챗봇" aria-modal="false">
      <div className="ph">
        <span className="dot" aria-hidden="true"></span>
        <span className="ttl">포트폴리오 챗봇</span>
        <span className={`ctx ${contextPointId ? '' : 'none'}`}>{ctxLabel}</span>
        <button
          className="ph-act lead"
          type="button"
          title="새 채팅"
          aria-label="새 채팅"
          onClick={newChat}
        >
          ＋
        </button>
        <button
          className="ph-act"
          type="button"
          title="대화 목록"
          aria-label="대화 목록"
          aria-expanded={showSessions}
          onClick={() => setShowSessions((v) => !v)}
        >
          ☰
        </button>
        <button className="x" type="button" title="닫기 (Esc)" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </div>

      {showSessions && (
        <div className="sess-menu" role="menu" aria-label="대화 목록">
          {sessions.length === 0 ? (
            <div className="sess-empty">저장된 대화가 없습니다.</div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className={`sess-row ${s.id === activeId ? 'on' : ''}`}>
                <button
                  className="sess-pick"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSwitchSession(s.id);
                    setShowSessions(false);
                  }}
                >
                  <span className="sess-title">{s.title}</span>
                  <span className="sess-time">{formatWhen(s.updatedAt)}</span>
                </button>
                <button
                  className="sess-del"
                  type="button"
                  title="대화 삭제"
                  aria-label={`대화 삭제: ${s.title}`}
                  onClick={() => onDeleteSession(s.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mode-bar">
        <span className="mode-lbl">눈높이</span>
        <div className="mode-seg" role="group" aria-label="답변 눈높이">
          <button
            type="button"
            className={mode === 'technical' ? 'on' : ''}
            aria-pressed={mode === 'technical'}
            onClick={() => onModeChange('technical')}
          >
            기술
          </button>
          <button
            type="button"
            className={mode === 'hr' ? 'on' : ''}
            aria-pressed={mode === 'hr'}
            onClick={() => onModeChange('hr')}
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
        onRetry={onRetry}
      />

      <Composer
        suggestions={suggestions}
        suggestionLabel={contextPointId ? '관련 질문' : '추천 질문'}
        showSuggestions={messages.length === 0}
        disabled={loading}
        onSend={onSend}
      />
    </div>
  );
}
