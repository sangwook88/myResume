// 공개 및 관리자 포인트 상세가 함께 쓰는 STAR 중심 케이스 스터디.
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Option, Point, PointSummary } from '@/lib/types';
import { displayText } from '@/lib/displayText';
import EvidenceList from '@/components/EvidenceList';
import AskSectionButton from '@/components/AskSectionButton';
import SelectionAsk from '@/components/SelectionAsk';
import PointRail, { type RailSection } from '@/components/PointRail';
import Reveal from '@/components/Reveal';
import Markdown from '@/components/Markdown';

export interface PointViewProps {
  point: Point;
  siblings: PointSummary[];
  admin?: boolean;
  status?: 'draft' | 'published';
  controls?: ReactNode;
}

interface StarCard {
  id: string;
  letter: 'S' | 'T' | 'A' | 'R';
  label: string;
  hint: string;
  body: string;
}

export default function PointView({
  point,
  siblings,
  admin = false,
  status = 'draft',
  controls,
}: PointViewProps) {
  const sections = point.sections;
  const projectHref = admin
    ? `/admin/projects/${encodeURIComponent(point.project)}`
    : `/projects/${encodeURIComponent(point.project)}`;
  const pointHref = (id: string) =>
    `${admin ? '/admin' : ''}/points/${encodeURIComponent(id)}`;

  const starCards: StarCard[] = [
    {
      id: 'situation',
      letter: 'S',
      label: 'Situation',
      hint: '어떤 맥락이었나',
      body: sections.background || point.summary,
    },
    {
      id: 'task',
      letter: 'T',
      label: 'Task',
      hint: '무엇을 풀어야 했나',
      body: sections.problem || point.summary,
    },
    {
      id: 'action',
      letter: 'A',
      label: 'Action',
      hint: '어떻게 판단하고 실행했나',
      body: [sections.decision, sections.execution].filter(Boolean).join('\n\n') || point.summary,
    },
    {
      id: 'result',
      letter: 'R',
      label: 'Result',
      hint: '무엇이 달라졌나',
      body: sections.result || '결과가 아직 문서화되지 않았습니다.',
    },
  ];

  const railSections: RailSection[] = [
    ...starCards.map(({ id, label }) => ({ id, label })),
    ...(sections.options?.length ? [{ id: 'options', label: '의사결정 옵션' }] : []),
    ...(sections.retrospective ? [{ id: 'retrospective', label: '회고' }] : []),
    { id: 'evidence', label: 'Evidence' },
  ];

  return (
    <div className="point-wrap case-layout">
      <article className="point-main case-study" id="point-body">
        <SelectionAsk containerId="point-body" />

        {admin && (
          <div className="admin-viewbar">
            <Link className="back" href="/admin">대시보드</Link>
            <div className="admin-actions">
              <span className={`admin-badge ${status}`}>{status}</span>
              {controls}
            </div>
          </div>
        )}

        <div className="project-back reveal" style={{ '--i': 0 } as React.CSSProperties}>
          <Link href={projectHref}>{displayText(point.project)}</Link>
          <span aria-hidden="true">/</span>
          <span>case study</span>
        </div>

        <header className="case-hero">
          <div className="reveal" style={{ '--i': 1 } as React.CSSProperties}>
            <p className="case-kicker">Decision and delivery</p>
            <h1>{displayText(point.title)}</h1>
            <p className="point-lede">{displayText(point.summary)}</p>
          </div>

          <div className="case-proof reveal" style={{ '--i': 2 } as React.CSSProperties}>
            <div>
              <span>Evidence</span>
              <strong>{point.evidence.length}</strong>
            </div>
            <div>
              <span>Project</span>
              <strong>{displayText(point.project)}</strong>
            </div>
          </div>

        </header>

        {point.tags.length > 0 && (
          <div className="case-tags reveal" style={{ '--i': 3 } as React.CSSProperties}>
            {point.tags.map((tag) => (
              <span key={tag}>{displayText(tag)}</span>
            ))}
          </div>
        )}

        <section className="star-overview" aria-labelledby="star-title">
          <div className="star-heading">
            <div>
              <h2 id="star-title">STAR 한눈에 보기</h2>
              <p>맥락에서 결과까지 한 흐름으로 읽도록 핵심 내용을 재배치했습니다.</p>
            </div>
            <AskSectionButton
              question={`"${point.title}" 사례를 STAR 순서로 근거와 함께 설명해줘`}
            />
          </div>

          <div className="star-grid">
            {starCards.map((card, index) => (
              <Reveal key={card.id} index={index}>
                <section id={card.id} className={`star-card star-${card.letter.toLowerCase()}`}>
                  <header>
                    <span className="star-letter" aria-hidden="true">{card.letter}</span>
                    <div>
                      <h3>{card.label}</h3>
                      <span>{card.hint}</span>
                    </div>
                  </header>
                  <Markdown className="star-card-body">{displayText(card.body)}</Markdown>
                </section>
              </Reveal>
            ))}
          </div>
        </section>

        {sections.options && sections.options.length > 0 && (
          <section id="options" className="decision-section" aria-labelledby="options-title">
            <div className="project-section-intro">
              <h2 id="options-title">선택에는 이유가 있습니다</h2>
              <p>채택한 안과 보류한 안을 같은 기준으로 비교했습니다.</p>
            </div>
            <OptionCards options={sections.options} />
          </section>
        )}

        {sections.retrospective && (
          <section id="retrospective" className="retrospective-note" aria-labelledby="retrospective-title">
            <span className="retrospective-mark" aria-hidden="true">R</span>
            <div>
              <h2 id="retrospective-title">다시 한다면</h2>
              <Markdown className="retrospective-body">{displayText(sections.retrospective)}</Markdown>
            </div>
          </section>
        )}

        <section id="evidence" className="case-evidence" aria-label="검증 가능한 근거">
          <EvidenceList evidence={point.evidence} />
        </section>

        {siblings.length > 0 && (
          <section className="more-cases" aria-labelledby="more-cases-title">
            <div className="project-section-intro">
              <h2 id="more-cases-title">같은 프로젝트의 다른 사례</h2>
            </div>
            <div className="case-index">
              {siblings.map((sibling, index) => (
                <Link key={sibling.id} className="case-index-link" href={pointHref(sibling.id)}>
                  <span className="case-index-no">{String(index + 1).padStart(2, '0')}</span>
                  <span className="case-index-copy">
                    <strong>{displayText(sibling.title)}</strong>
                    {sibling.summary && <span>{displayText(sibling.summary)}</span>}
                  </span>
                  <span className="case-index-action">STAR 보기</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <PointRail sections={railSections} />
    </div>
  );
}

function adopted(value?: string): boolean {
  if (!value) return false;
  const normalised = value.trim().toLowerCase();
  return ['o', 'yes', 'true', '채택', '선택', '✓', '✔', '●'].includes(normalised);
}

function OptionCards({ options }: { options: Option[] }) {
  return (
    <div className="option-cards">
      {options.map((option, index) => {
        const isAdopted = adopted(option.adopted);
        return (
          <article key={index} className={isAdopted ? 'option-card is-adopted' : 'option-card'}>
            <header>
              <h3>{displayText(option.option || `옵션 ${index + 1}`)}</h3>
              <span>{isAdopted ? '채택' : '보류'}</span>
            </header>
            <dl>
              {option.pros && <div><dt>장점</dt><dd>{displayText(option.pros)}</dd></div>}
              {option.cons && <div><dt>단점</dt><dd>{displayText(option.cons)}</dd></div>}
              {option.cost && <div><dt>비용과 리스크</dt><dd>{displayText(option.cost)}</dd></div>}
            </dl>
          </article>
        );
      })}
    </div>
  );
}
