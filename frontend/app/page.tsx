// fe/browse — 랜딩. 상단 추천 포인트 + 하단 프로젝트 목록.
// 서버 컴포넌트: be/point·be/project를 fetch(SSG/ISR). 0개면 빈 상태 안내.
import Link from 'next/link';
import { getProjects, getRecommendedPoints } from '@/lib/api';
import type { PointSummary, ProjectSummary } from '@/lib/types';

export default async function LandingPage() {
  const [recommended, projects] = await Promise.all([
    getRecommendedPoints(),
    getProjects(),
  ]);

  return (
    <main className="page">
      <h1>포트폴리오</h1>
      <p className="sub">결정마다 커밋·PR·Swagger로 검증 가능한 근거기반 포트폴리오.</p>

      <div className="section-label">추천 포폴 포인트</div>
      {recommended.length > 0 ? (
        recommended.map((p) => <PointCard key={p.id} point={p} />)
      ) : (
        <div className="empty-state">아직 공개된 포폴 포인트가 없습니다.</div>
      )}

      <div className="section-label">프로젝트</div>
      {projects.length > 0 ? (
        projects.map((proj) => <ProjectCard key={proj.slug} project={proj} />)
      ) : (
        <div className="empty-state">아직 공개된 프로젝트가 없습니다.</div>
      )}
    </main>
  );
}

function PointCard({ point }: { point: PointSummary }) {
  return (
    <Link className="card" href={`/points/${encodeURIComponent(point.id)}`}>
      <div className="t">{point.title}</div>
      <div className="m">
        {point.tags.map((tag) => (
          <span key={tag} className="tag">{tag}</span>
        ))}
        <span>· {point.project} 프로젝트</span>
      </div>
    </Link>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link className="card" href={`/projects/${encodeURIComponent(project.slug)}`}>
      <div className="t">{project.slug}</div>
      <div className="m">{project.summary}</div>
    </Link>
  );
}
