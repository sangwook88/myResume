'use client';

// fe/browse — 전역 우하단 챗봇 FAB(진입구). 모든 화면에 상시 고정.
// 대화 UI 자체는 fe/chat(ChatPanel) 소관 — 여기선 열기/닫기와 진입 맥락만 소유.
// 진입 맥락(포인트 id)은 현재 URL(/points/[id])에서 파생한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import ChatPanel from '@/components/chat/ChatPanel';

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
  const pathname = usePathname();
  const contextPointId = derivePointContext(pathname);
  const fabRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // 닫힌 직후 FAB로 포커스 복귀(Esc·× 접근성). 최초 렌더에는 포커스하지 않음.
  useEffect(() => {
    if (wasOpen.current && !open) fabRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={fabRef}
        className="fab"
        type="button"
        aria-label="챗봇 열기"
        title="챗봇 열기"
        hidden={open}
        onClick={() => setOpen(true)}
      >
        💬
      </button>
      {open && <ChatPanel contextPointId={contextPointId} onClose={close} />}
    </>
  );
}
