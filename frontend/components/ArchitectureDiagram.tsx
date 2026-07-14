'use client';

// fe/browse v4 — 컴파일된 아키텍처 도식(SVG) 임베드 (ARCHITECTURE §v4-C).
// BE 가 준 API 경로(/api/projects/<slug>/architecture.svg)를 브라우저 base 로 해석해 <img> 로 렌더.
// 로딩, 성공, 실패를 모두 표현하고 실제 SVG는 안전한 img 경계 안에서 렌더한다.
import { useState } from 'react';

// 브라우저측 BE base — fe/browse api.ts·chatClient 와 동일 관례(동일 오리진이면 "").
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export default function ArchitectureDiagram({
  src,
  projectName,
}: {
  src: string;
  projectName: string;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  return (
    <figure className="architecture-stage" data-state={state}>
      <div className="architecture-contract" aria-label="백엔드에서 프론트엔드까지의 도식 전달 흐름">
        <span>BE payload</span>
        <span className="contract-line" aria-hidden="true" />
        <span>SVG endpoint</span>
        <span className="contract-line" aria-hidden="true" />
        <span>FE render</span>
      </div>

      <div className="architecture-canvas">
        {state === 'loading' && (
          <div className="architecture-skeleton" role="status" aria-label="아키텍처 도식을 불러오는 중">
            <span />
            <span />
            <span />
          </div>
        )}

        {state === 'error' ? (
          <div className="architecture-error" role="status">
            <strong>도식을 불러오지 못했습니다.</strong>
            <span>백엔드의 SVG 응답 경로를 확인해 주세요.</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- BE가 제공하는 정적 SVG */
          <img
            src={`${API_BASE}${src}`}
            alt={`${projectName} 전체 아키텍처`}
            loading="eager"
            fetchPriority="high"
            onLoad={() => setState('ready')}
            onError={() => setState('error')}
          />
        )}
      </div>

      <figcaption>
        <span>Source</span>
        <code>{src}</code>
      </figcaption>
    </figure>
  );
}
