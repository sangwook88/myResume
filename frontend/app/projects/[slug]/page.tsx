// fe/browse — 프로젝트 인덱스. 표지 6요소 + published 포인트 목록.
// 없는/노출불가 slug → BE가 302 → api가 null → 랜딩으로 redirect.
// published 포인트 0개면 목록 슬롯 미표시.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProjectIndex } from '@/lib/api';
import Reveal from '@/components/Reveal';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';

export default async function ProjectIndexPage({
  params,
}: {
  params: { slug: string };
}) {
  const project = await getProjectIndex(params.slug);
  if (!project) redirect('/');

  return (
    <main className="page reveal">
      <div className="topbar">
        <Link className="back" href="/">← 랜딩</Link>
        <span>{project.slug}</span>
      </div>

      <h1>{project.name}</h1>
      <p className="sub">{project.summary}</p>

      <h3>역할 / 기간 / 팀</h3>
      <dl className="meta">
        <dt>역할</dt><dd>{project.role}</dd>
        <dt>기간</dt><dd>{project.period}</dd>
        <dt>팀 규모</dt><dd>{project.teamSize}</dd>
      </dl>

      {project.techStack.length > 0 && (
        <>
          <h3>기술 스택</h3>
          <div>
            {project.techStack.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        </>
      )}

      {/* 아키텍처: v4 압축 도식(있으면 한눈에) + 긴 텍스트 개요. 도식 없으면 텍스트만(하위호환). */}
      {(project.architectureDiagram || project.architecture) && (
        <>
          <h3>아키텍처 개요</h3>
          {project.architectureDiagram && (
            <ArchitectureDiagram src={project.architectureDiagram} />
          )}
          {project.architecture && <div className="archbox">{project.architecture}</div>}
        </>
      )}

      {project.highlights.length > 0 && (
        <>
          <h3>핵심 성과</h3>
          <ul>
            {project.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </>
      )}

      {/* published 포인트 0개면 목록 슬롯 자체를 숨긴다(요소/프로젝트-인덱스 예외 처리). */}
      {project.points.length > 0 && (
        <>
          <h3>포폴 포인트 목록 (published)</h3>
          {project.points.map((pt, i) => (
            <Reveal key={pt.id} index={i}>
              <Link className="card card-row" href={`/points/${encodeURIComponent(pt.id)}`}>
                <span className="t">{pt.title}</span>
                <span className="chev">›</span>
              </Link>
            </Reveal>
          ))}
        </>
      )}
    </main>
  );
}
