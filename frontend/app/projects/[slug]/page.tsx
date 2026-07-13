// fe/browse — 공개 프로젝트 인덱스 서버 페이지.
// 없는/노출불가 slug → BE가 302 → api가 null → 랜딩으로 redirect.
import { redirect } from 'next/navigation';
import { getProjectIndex } from '@/lib/api';
import ProjectView from '@/components/ProjectView';

export default async function ProjectIndexPage({
  params,
}: {
  params: { slug: string };
}) {
  const project = await getProjectIndex(params.slug);
  if (!project) redirect('/');

  return <ProjectView project={project} />;
}
