'use client';

// fe/browse v4 — 컴파일된 아키텍처 도식(SVG) 임베드 (ARCHITECTURE §v4-C).
// BE 가 준 API 경로(/api/projects/<slug>/architecture.svg)를 브라우저 base 로 해석해 <img> 로 렌더.
// 로드 실패(404 등)면 조용히 숨긴다(architecture 텍스트는 페이지가 그대로 유지).
import { useState } from 'react';

// 브라우저측 BE base — fe/browse api.ts·chatClient 와 동일 관례(동일 오리진이면 "").
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export default function ArchitectureDiagram({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="archdiagram">
      {/* eslint-disable-next-line @next/next/no-img-element — 정적 SVG, next/image 최적화 불필요 */}
      <img
        src={`${API_BASE}${src}`}
        alt="아키텍처 도식"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
