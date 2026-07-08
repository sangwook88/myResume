'use client';

// fe/browse v2 — Evidence 고급 UI: 번호 각주형 + 접기/펼치기.
// 발행 게이트가 근거 ≥1 을 보장하므로 항상 최소 1개. 기본 펼침(근거는 보여야 함).
import { useState } from 'react';
import type { Evidence } from '@/lib/types';

// kind → 배지 CSS 클래스(정의된 것만; 그 외는 link 스타일).
const EVIDENCE_KINDS = new Set(['commit', 'pr', 'swagger', 'file', 'link']);
function kindClass(kind: string): string {
  const k = kind.toLowerCase();
  return EVIDENCE_KINDS.has(k) ? k : 'link';
}

export default function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="evi-section">
      <button
        type="button"
        className="evi-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="evi-toggle-lbl">Evidence · 근거 {evidence.length}</span>
        <span className="evi-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <ol className="evi-list">
          {evidence.map((e, i) => (
            <li key={i} className="evi-item">
              <span className="evi-num" aria-hidden="true">[{i + 1}]</span>
              <a className="evi-link" href={e.url} target="_blank" rel="noopener noreferrer">
                <span className={`kind ${kindClass(e.kind)}`}>{e.kind}</span>
                <span className="label">{e.label}</span>
                <span className="ext" aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
