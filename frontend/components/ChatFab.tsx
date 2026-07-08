'use client';

// fe/browse — 전역 우하단 챗봇 FAB(진입구). 모든 화면에 상시 고정.
// 대화 UI 자체는 fe/chat(ChatPanel) 소관 — 여기선 열기/닫기와 진입 맥락만 소유.
// 진입 맥락(포인트 id)은 현재 URL(/points/[id])에서 파생한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import ChatPanel from '@/components/chat/ChatPanel';
import { ASK_EVENT, type AskDetail } from '@/lib/askChat';

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

export default function ChatFab() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const pathname = usePathname();
  const contextPointId = derivePointContext(pathname);
  const fabRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

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
          initialQuestion={pending}
          onClose={close}
        />
      )}
    </>
  );
}
