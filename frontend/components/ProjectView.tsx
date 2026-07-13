// fe/browse — 공개·관리자 프로젝트 인덱스가 함께 쓰는 순수 표현 컴포넌트.
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { ProjectIndex } from '@/lib/types';
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

  return (
    <main className="page reveal">
      {admin && (
        <div className="admin-viewbar">
          <Link className="back" href="/admin">← 대시보드</Link>
          {controls && <div className="admin-actions">{controls}</div>}
        </div>
      )}

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

      {/* 아키텍처: 도식(한눈에)만 노출하고 긴 개요 프로즈는 챗봇으로 미룬다
          (프로즈는 be/chat 코퍼스의 표지에 포함돼 물으면 답한다 — corpus._render_cover).
          도식이 없으면 하위호환으로 텍스트를 그대로 남긴다. */}
      {(project.architectureDiagram || project.architecture) && (
        <>
          <h3>아키텍처 개요</h3>
          {project.architectureDiagram ? (
            <>
              <ArchitectureDiagram src={project.architectureDiagram} />
              {project.architecture && (
                <div className="depth-cta">
                  <span className="t">아키텍처를 더 자세히 알고 싶으신가요?</span>
                  <AskSectionButton
                    question={`"${project.name}" 프로젝트의 아키텍처를 자세히 설명해줘`}
                  />
                </div>
              )}
            </>
          ) : (
            project.architecture && <div className="archbox">{project.architecture}</div>
          )}
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

      {/* 공개는 published만, 관리자는 BE 관리자 조회가 준 draft 포함 목록을 그대로 표현한다. */}
      {project.points.length > 0 && (
        <>
          <h3>포폴 포인트 목록 ({admin ? 'draft 포함' : 'published'})</h3>
          {project.points.map((pt, i) => (
            <Reveal key={pt.id} index={i}>
              <Link className="card card-row" href={pointHref(pt.id)}>
                <span className="rowmain">
                  <span className="t">{pt.title}</span>
                  {pt.summary && <span className="m">{pt.summary}</span>}
                </span>
                <span className="chev">›</span>
              </Link>
            </Reveal>
          ))}
        </>
      )}
    </main>
  );
}
