'use client';

// fe/browse — 포인트 상세 우측 스티키 탐색 레일.
// ① 스크롤 추적 목차(현재 읽는 섹션 하이라이트 + 앵커 점프)
// ② 읽기 진행 바(상단 고정)
// ③ 맥락 챗봇 — 지금 읽는 섹션에 맞는 질문 칩. 클릭/전송하면 askChat 으로
//    ASK_EVENT 를 쏴 기존 챗봇 패널(ChatFab)이 열리고 자동 전송된다(엔진 재사용).
// 섹션 목록은 서버 컴포넌트(page)가 실제 렌더된 섹션만 추려 넘긴다.
import { useEffect, useRef, useState } from 'react';
import { askChat } from '@/lib/askChat';

export interface RailSection {
  id: string;
  label: string;
}

/** 섹션별 맥락 질문(제네릭 — 어느 포인트에도 통하는 표현). */
const CHIPS: Record<string, string[]> = {
  background: ['이 배경을 더 자세히 설명해줘'],
  problem: ['이 포인트가 풀려던 문제를 더 자세히 설명해줘'],
  options: ['고려한 다른 옵션과 왜 안 골랐는지 설명해줘'],
  decision: ['이 결정의 근거를 더 자세히 설명해줘'],
  execution: ['실제로 어떻게 구현했는지 설명해줘'],
  result: ['이 결정의 결과는 어땠어?'],
  retrospective: ['여기서 배운 점(회고)은 뭐야?'],
  evidence: ['근거 커밋들을 요약해줘'],
};

export default function PointRail({ sections }: { sections: RailSection[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '');
  const [progress, setProgress] = useState(0);
  const [input, setInput] = useState('');
  // 목차 클릭으로 부드럽게 점프하는 동안 scroll-spy 가 활성을 되덮지 못하게
  // 하는 잠금(타임스탬프). 클릭이 지정한 섹션이 착지까지 권위를 갖는다.
  const lockUntil = useRef(0);

  useEffect(() => {
    const ids = sections.map((s) => s.id);
    const main = document.getElementById('point-body');

    function onScroll() {
      // 읽기 진행 바 — 본문(point-body) 기준 스크롤 비율.
      if (main) {
        const rect = main.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const passed = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
        setProgress(total > 0 ? (passed / total) * 100 : 0);
      }
      // 클릭 점프 진행 중이면 스파이가 활성을 가로채지 않게 억제(진행 바는 계속 갱신).
      if (Date.now() < lockUntil.current) return;
      // 스크롤 추적 — 상단 기준선(84 + 여유)을 지난 "마지막" 섹션 = 지금 읽는 섹션.
      const offset = 100;
      let cur = ids[0] ?? '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= offset) cur = id;
      }
      // 문서 끝에 닿으면 마지막 섹션을 활성. 마지막 섹션(예: Evidence)이 짧아
      // top 이 기준선(offset)까지 못 올라오는 경우, 위 루프만으론 영영 활성되지
      // 않는다 — 끝까지 내렸다 = 마지막 섹션을 읽고 있다는 뜻이므로 여기서 보정.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) cur = ids[ids.length - 1] ?? cur;
      setActive(cur);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  const activeLabel = sections.find((s) => s.id === active)?.label ?? '';

  function ask(q: string) {
    const t = q.trim();
    if (t) askChat(t);
  }

  return (
    <>
      <div className="reading-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
      <aside className="point-rail">
        <nav className="rail-card" aria-label="이 포인트 탐색">
          <div className="rail-head">이 포인트 탐색</div>
          <ul className="toc">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={active === s.id ? 'active' : ''}
                  onClick={() => {
                    setActive(s.id);
                    // 부드러운 스크롤이 착지할 때까지(~700ms) 스파이 억제.
                    lockUntil.current = Date.now() + 700;
                  }}
                >
                  <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="rail-card">
          <div className="rail-chat-head">
            <span className="dot" />
            <span className="t">근거로 답하는 챗봇</span>
            {activeLabel && <span className="ctx">{activeLabel}</span>}
          </div>
          <div className="rail-chat-sub">지금 읽는 섹션에 맞춰 물어볼 거리를 제안해요.</div>
          <div className="rail-chips">
            <div className="clbl">이 섹션에서 물어보기</div>
            {(CHIPS[active] ?? []).map((q) => (
              <button key={q} type="button" className="rail-chip" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
          <form
            className="rail-composer"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
              setInput('');
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="무엇이든 물어보세요"
              aria-label="질문 입력"
            />
            <button type="submit" aria-label="전송">↑</button>
          </form>
        </div>
      </aside>
    </>
  );
}
