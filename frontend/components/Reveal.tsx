'use client';

// fe/browse — 스크롤 진입 리빌 래퍼. 뷰포트에 들어오면 .is-visible 를 토글해
// 자식을 위로 떠오르게 한다(모션은 globals.css .reveal-scroll 소관). index 로
// 리스트 계단식 지연(stagger)을 준다. 서버 컴포넌트 페이지가 카드마다 감싸 쓴다.
import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function Reveal({
  children,
  index = 0,
  className = '',
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 이미 화면 안이면 즉시(어보브폴드도 자연 재생). 아니면 스크롤 진입 시 1회.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal-scroll ${shown ? 'is-visible' : ''} ${className}`.trim()}
      style={{ '--i': index } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
