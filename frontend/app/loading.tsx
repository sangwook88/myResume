// fe/browse — 라우트 전환·서버 fetch 동안 보여줄 스켈레톤(shimmer).
// Next.js App Router 가 Suspense 경계로 자동 노출한다. 랜딩 뼈대에 맞춰 카드 3장.
export default function Loading() {
  return (
    <main className="page" aria-hidden="true">
      <div className="skel skel-title" />
      <div className="skel skel-sub" />

      <div className="section-label">추천 포폴 포인트</div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skel skel-card" />
      ))}

      <div className="section-label">프로젝트</div>
      {[0, 1].map((i) => (
        <div key={i} className="skel skel-card" />
      ))}
    </main>
  );
}
