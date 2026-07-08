'use client';

// fe/browse v3 — 인라인 선택-질문. 본문 텍스트를 드래그 선택하면 선택 위치 근처에
// 작은 플로팅 버튼이 뜨고, 클릭하면 그 텍스트에 대해 챗봇이 자동 질문한다.
// v2 다리(askChat → portfolio:ask → ChatFab)를 그대로 재사용(새 이벤트 안 만듦).
import { useCallback, useEffect, useRef, useState } from 'react';
import { askChat } from '@/lib/askChat';

// 선택 최소 길이(이보다 짧으면 무시) / 질문에 실을 최대 길이(넘으면 자름).
const MIN_LEN = 8;
const MAX_LEN = 140;

interface Pos {
  top: number;
  left: number;
}

export default function SelectionAsk({ containerId }: { containerId: string }) {
  const [pos, setPos] = useState<Pos | null>(null);
  // 최신 선택 텍스트 보관(리렌더 없이 클릭 시점에 읽음).
  const textRef = useRef('');
  const btnRef = useRef<HTMLButtonElement>(null);

  const hide = useCallback(() => {
    setPos(null);
    textRef.current = '';
  }, []);

  // 현재 선택을 평가해 버튼을 띄우거나 숨긴다(본문 컨테이너 내부 선택만 인정).
  const evaluate = useCallback(() => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      hide();
      return;
    }
    const raw = sel.toString().replace(/\s+/g, ' ').trim();
    if (raw.length < MIN_LEN) {
      hide();
      return;
    }
    // 선택이 본문 컨테이너 안에서 일어났는지 확인(챗봇 패널 등 밖의 선택은 무시).
    const container = document.getElementById(containerId);
    const anchor = sel.anchorNode;
    if (!container || !anchor || !container.contains(anchor)) {
      hide();
      return;
    }

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hide();
      return;
    }

    textRef.current = raw.length > MAX_LEN ? `${raw.slice(0, MAX_LEN)}…` : raw;
    // 선택 영역 위쪽 중앙에 배치(뷰포트 밖으로 나가지 않게 살짝 보정).
    const top = Math.max(8, rect.top - 44);
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2),
      window.innerWidth - 8,
    );
    setPos({ top, left });
  }, [containerId, hide]);

  useEffect(() => {
    // mouseup: 드래그 선택이 끝난 시점. 버튼 위 클릭은 evaluate 대상에서 제외.
    function onMouseUp(e: MouseEvent) {
      if (btnRef.current && e.target instanceof Node && btnRef.current.contains(e.target)) {
        return;
      }
      // 브라우저가 선택을 확정할 틈을 준다.
      setTimeout(evaluate, 0);
    }
    // 키보드 선택(Shift+화살표) 대응.
    function onKeyUp() {
      setTimeout(evaluate, 0);
    }
    // 스크롤하면 rect가 낡으므로 숨긴다.
    function onScroll() {
      hide();
    }
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [evaluate, hide]);

  if (!pos) return null;

  return (
    <button
      ref={btnRef}
      type="button"
      className="sel-ask"
      style={{ top: pos.top, left: pos.left }}
      // 버튼을 누를 때 선택이 풀리지 않도록(mousedown이 선택을 해제하는 걸 막음).
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        const t = textRef.current;
        if (t) askChat(`다음 내용에 대해 설명해줘: "${t}"`);
        hide();
      }}
    >
      💬 이 부분 물어보기
    </button>
  );
}
