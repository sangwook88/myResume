'use client';

// fe/browse — 전역 우하단 챗봇 FAB(진입구) 겸 챗봇 '엔진 컨테이너'.
// 대화 엔진(messages·loading·mode·전송 스트리밍)과 세션 관리(새 채팅·전환)를 여기서
// 소유한다 — 패널(ChatPanel)은 열 때만 마운트되므로, 상태를 패널에 두면 닫는 순간
// 파기돼 로그가 사라지고(#5) 스트림도 끊긴다. 엔진을 FAB로 올려 두 문제를 함께 푼다:
//   · 닫아도 진행 중 답변이 백그라운드에서 끝까지 온다(닫기=언마운트지만 엔진은 여기 살아있음).
//   · 대화 로그는 재오픈에도 남고, 서버(be/chat)에서 세션 이력을 복원할 수 있다.
// 진입 맥락(포인트 id)은 현재 URL(/points/[id])에서 파생한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import ChatPanel from '@/components/chat/ChatPanel';
import type { ChatMessage } from '@/components/chat/MessageList';
import { ASK_EVENT, type AskDetail } from '@/lib/askChat';
import { streamChat, fetchHistory, type Citation, type HistoryTurn } from '@/lib/chatClient';
import {
  type ChatSessionMeta,
  newSessionId,
  listSessions,
  getActiveId,
  setActiveId,
  touchSession,
  removeSession,
} from '@/lib/chatSessions';

/** /points/<id> 경로면 그 id를, 아니면 null(무맥락)을 반환. */
function derivePointContext(pathname: string | null): string | null {
  if (!pathname) return null;
  const seg = pathname.split('/').filter(Boolean);
  if (seg.length === 2 && seg[0] === 'points') {
    try {
      return decodeURIComponent(seg[1]);
    } catch {
      return seg[1];
    }
  }
  return null;
}

/** BE 이력 턴(user|assistant) → FE 말풍선(user|bot). points 는 저장 안 하므로 생략. */
function turnsToMessages(turns: HistoryTurn[]): ChatMessage[] {
  return turns.map((t) => ({
    role: t.role === 'assistant' ? 'bot' : 'user',
    text: t.text,
    citations: t.citations && t.citations.length > 0 ? t.citations : undefined,
  }));
}

export default function ChatFab() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const pathname = usePathname();
  const contextPointId = derivePointContext(pathname);
  const fabRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // ── 대화 엔진 상태(패널이 아니라 여기에 둔다) ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'technical' | 'hr'>('technical');

  // ── 세션(다중 채팅) 상태. 목록·제목·활성은 브라우저(localStorage)가 소유 ──
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null); // 비동기 콜백에서 최신 활성 세션 확인용
  const lastQuestionRef = useRef<string>('');
  const engagedRef = useRef(false); // 사용자가 이미 조작(전송/전환)했는지 — 초기 복원의 덮어쓰기 방지

  const setActive = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveIdState(id);
    setActiveId(id);
  }, []);

  // 최초 마운트: 세션 목록·활성 세션을 하이드레이트하고, 활성 세션 이력을 서버에서 복원.
  useEffect(() => {
    setSessions(listSessions());
    const id = getActiveId();
    if (!id) return;
    activeIdRef.current = id;
    setActiveIdState(id);
    fetchHistory(id).then((turns) => {
      // 그 사이 사용자가 다른 세션으로 갔거나 이미 무언가 보냈으면 덮어쓰지 않는다.
      if (activeIdRef.current === id && !engagedRef.current) {
        setMessages(turnsToMessages(turns));
      }
    });
  }, []);

  const send = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text || loading) return;
      engagedRef.current = true;

      // 어느 채팅에 쌓을지 확정. 없으면 지금 새 세션을 연다.
      let sid = activeIdRef.current;
      if (!sid) {
        sid = newSessionId();
        setActive(sid);
      }
      const streamSid = sid;

      lastQuestionRef.current = text;
      // 목록 갱신 + 제목(첫 질문일 때만 반영, touchSession 이 판단). 활동순 최신화.
      setSessions(touchSession(streamSid, text));
      setError(null);
      setLoading(true);
      setMessages((prev) => [...prev, { role: 'user', text }, { role: 'bot', text: '' }]);

      // 이 스트림의 반영이 여전히 '활성 세션'을 향할 때만 UI 를 건드린다(전환 후 교차오염 방지).
      const patchBot = (fn: (m: ChatMessage) => ChatMessage) => {
        if (activeIdRef.current !== streamSid) return;
        setMessages((prev) => {
          const next = [...prev];
          const i = next.length - 1;
          if (i >= 0 && next[i].role === 'bot') next[i] = fn(next[i]);
          return next;
        });
      };

      streamChat(
        { question: text, context: contextPointId, mode, sessionId: streamSid },
        {
          onToken: (t) => patchBot((m) => ({ ...m, text: m.text + t })),
          onCitations: (cits: Citation[]) => patchBot((m) => ({ ...m, citations: cits })),
          onPoints: (pts) => patchBot((m) => ({ ...m, points: pts })),
          onDone: () => {
            if (activeIdRef.current === streamSid) setLoading(false);
          },
          onError: (msg) => {
            if (activeIdRef.current !== streamSid) return;
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
      );
    },
    [contextPointId, loading, mode, setActive],
  );

  const retry = useCallback(() => {
    if (lastQuestionRef.current) send(lastQuestionRef.current);
  }, [send]);

  // 새 채팅: 빈 세션 id 를 열고 로그를 비운다. 목록 등록은 첫 전송 때(빈 채팅 누적 방지).
  const newChat = useCallback(() => {
    engagedRef.current = true;
    setActive(newSessionId());
    setMessages([]);
    setError(null);
    setLoading(false);
  }, [setActive]);

  // 다른 채팅으로 전환: 활성 세션을 바꾸고 그 이력을 서버에서 복원.
  const switchSession = useCallback(
    (id: string) => {
      if (id === activeIdRef.current) return;
      engagedRef.current = true;
      setActive(id);
      setError(null);
      setLoading(false);
      setMessages([]);
      fetchHistory(id).then((turns) => {
        if (activeIdRef.current === id) setMessages(turnsToMessages(turns));
      });
    },
    [setActive],
  );

  const deleteSession = useCallback(
    (id: string) => {
      const next = removeSession(id);
      setSessions(next);
      if (id === activeIdRef.current) {
        if (next.length > 0) switchSession(next[0].id);
        else newChat();
      }
    },
    [switchSession, newChat],
  );

  // 닫힌 직후 FAB로 포커스 복귀(Esc·× 접근성). 최초 렌더에는 포커스하지 않음.
  useEffect(() => {
    if (wasOpen.current && !open) fabRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // 콘텐츠(AskChips·섹션 버튼)에서 온 질문: 패널 열고 그 질문을 자동 전송.
  useEffect(() => {
    function onAsk(e: Event) {
      const q = (e as CustomEvent<AskDetail>).detail?.question;
      setPending(q && q.trim() ? q : null);
      setOpen(true);
    }
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);

  // 넘어온 질문 자동 전송(현재 활성 채팅에 이어붙임). 같은 질문은 1회만.
  const autoSentRef = useRef<string | null>(null);
  useEffect(() => {
    const q = pending?.trim();
    if (q && autoSentRef.current !== q) {
      autoSentRef.current = q;
      send(q);
    }
  }, [pending, send]);

  const close = useCallback(() => {
    setOpen(false);
    setPending(null);
  }, []);

  return (
    <>
      <button
        ref={fabRef}
        className="fab"
        type="button"
        aria-label="챗봇 열기"
        title="챗봇 열기"
        hidden={open}
        onClick={() => {
          setPending(null);
          setOpen(true);
        }}
      >
        💬
      </button>
      {open && (
        <ChatPanel
          contextPointId={contextPointId}
          messages={messages}
          loading={loading}
          error={error}
          mode={mode}
          onModeChange={setMode}
          onSend={send}
          onRetry={retry}
          onClose={close}
          sessions={sessions}
          activeId={activeId}
          onNewChat={newChat}
          onSwitchSession={switchSession}
          onDeleteSession={deleteSession}
        />
      )}
    </>
  );
}
