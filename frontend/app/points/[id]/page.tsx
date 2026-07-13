// fe/browse — 공개 포폴 포인트 상세 서버 페이지.
// 없는/draft id → BE 302 → api null → 랜딩 redirect(draft 존재 비노출).
import { redirect } from 'next/navigation';
import { getPoint, getProjectPoints } from '@/lib/api';
import PointView from '@/components/PointView';

export default async function PointDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const point = await getPoint(params.id);
  if (!point) redirect('/');

  // 같은 프로젝트 다른 published 포인트(현재 포인트 제외). 실패·0개면 목록 생략.
  const siblings = (await getProjectPoints(point.project)).filter(
    (p) => p.id !== point.id,
  );

  return <PointView point={point} siblings={siblings} />;
}
