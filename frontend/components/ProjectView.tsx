// 공개 및 관리자 프로젝트 인덱스가 함께 쓰는 프레젠테이션 컴포넌트.
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { ProjectIndex } from '@/lib/types';
import { displayText } from '@/lib/displayText';
import Reveal from '@/components/Reveal';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';
import AskSectionButton from '@/components/AskSectionButton';

export interface ProjectViewProps {
  project: ProjectIndex;
  admin?: boolean;
  controls?: ReactNode;
}

export default function ProjectView({ project, admin = false, controls }: ProjectViewProps) {
  const pointHref = (id: string) =>
    `${admin ? '/admin' : ''}/points/${encodeURIComponent(id)}`;
  const clean = displayText;

  return (
    <main className="project-page">
      {admin && (
        <div className="admin-viewbar">
          <Link className="back" href="/admin">대시보드</Link>
          {controls && <div className="admin-actions">{controls}</div>}
        </div>
      )}

      <div className="project-back reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <Link href="/">프로젝트 목록</Link>
        <span aria-hidden="true">/</span>
        <span>{clean(project.slug)}</span>
      </div>

      <section className="project-hero" aria-labelledby="project-title">
        <div className="project-hero-copy reveal" style={{ '--i': 1 } as React.CSSProperties}>
          <p className="project-kicker">Engineering case study</p>
          <h1 id="project-title">{clean(project.name)}</h1>
          <p className="project-summary">{clean(project.summary)}</p>
        </div>

        <dl className="project-facts reveal" style={{ '--i': 2 } as React.CSSProperties}>
          <div>
            <dt>역할</dt>
            <dd>{clean(project.role)}</dd>
          </div>
          <div>
            <dt>기간</dt>
            <dd>{clean(project.period)}</dd>
          </div>
          <div>
            <dt>팀</dt>
            <dd>{clean(project.teamSize)}</dd>
          </div>
        </dl>
      </section>

      {project.techStack.length > 0 && (
        <div className="project-stack reveal" style={{ '--i': 3 } as React.CSSProperties}>
          <span className="stack-label">Built with</span>
          <div className="stack-items">
            {project.techStack.map((tech) => (
              <span key={tech}>{clean(tech)}</span>
            ))}
          </div>
        </div>
      )}

      {(project.architectureDiagram || project.architecture || project.highlights.length > 0) && (
        <section className="project-system" aria-labelledby="system-title">
          <div className="project-section-intro">
            <h2 id="system-title">구조와 성과를 한 화면에</h2>
            <p>백엔드가 제공한 실제 도식과 구현 결과를 같은 맥락에서 확인할 수 있습니다.</p>
          </div>

          <div className="system-overview-grid">
            <Reveal className="system-diagram" index={0}>
              {project.architectureDiagram ? (
                <ArchitectureDiagram
                  src={project.architectureDiagram}
                  projectName={clean(project.name)}
                />
              ) : project.architecture ? (
                <div className="architecture-fallback">{clean(project.architecture)}</div>
              ) : (
                <div className="architecture-fallback">등록된 아키텍처 도식이 없습니다.</div>
              )}
            </Reveal>

            <aside className="outcome-panel" aria-labelledby="outcome-title">
              <div className="outcome-heading">
                <h3 id="outcome-title">핵심 성과</h3>
                <span>{project.highlights.length} outcomes</span>
              </div>
              {project.highlights.length > 0 ? (
                <ol>
                  {project.highlights.map((highlight, index) => (
                    <li key={index}>
                      <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                      <p>{clean(highlight)}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="outcome-empty">등록된 성과가 없습니다.</p>
              )}
              {project.architecture && (
                <AskSectionButton
                  question={`"${project.name}" 프로젝트의 아키텍처와 핵심 성과의 연결을 자세히 설명해줘`}
                />
              )}
            </aside>
          </div>
        </section>
      )}

      <section className="project-cases" aria-labelledby="cases-title">
        <div className="project-section-intro">
          <h2 id="cases-title">판단이 드러나는 구현 사례</h2>
          <p>각 사례에서 문제, 선택, 실행, 결과와 검증 가능한 근거를 함께 볼 수 있습니다.</p>
        </div>

        {project.points.length > 0 ? (
          <div className="case-index">
            {project.points.map((point, index) => (
              <Reveal key={point.id} index={index}>
                <Link href={pointHref(point.id)} className="case-index-link">
                  <span className="case-index-no">{String(index + 1).padStart(2, '0')}</span>
                  <span className="case-index-copy">
                    <strong>{clean(point.title)}</strong>
                    {point.summary && <span>{clean(point.summary)}</span>}
                  </span>
                  <span className="case-index-action">STAR 보기</span>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="empty-state">공개된 구현 사례가 아직 없습니다.</div>
        )}
      </section>
    </main>
  );
}
