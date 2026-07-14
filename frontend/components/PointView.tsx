// fe/browse — 공개·관리자 포인트 상세가 함께 쓰는 순수 표현 컴포넌트.
// 데이터 조회와 인증은 페이지가 맡고, admin 플래그는 관리자 컨트롤과 이동 경로만 게이트한다.
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Option, Point, PointSummary } from '@/lib/types';
import EvidenceList from '@/components/EvidenceList';
import AskSectionButton from '@/components/AskSectionButton';
import SelectionAsk from '@/components/SelectionAsk';
import PointRail, { type RailSection } from '@/components/PointRail';
import Markdown from '@/components/Markdown';

export interface PointViewProps {
  point: Point;
  siblings: PointSummary[];
  admin?: boolean;
  /** 공개 Point DTO에는 없으므로 관리자 목록 응답에서 결합한다. */
  status?: 'draft' | 'published';
  controls?: ReactNode;
}

export default function PointView({
  point,
  siblings,
  admin = false,
  status = 'draft',
  controls,
}: PointViewProps) {
  const s = point.sections;

  // 페이지 노출 = 핵심만 한눈에: 문제 · 고려한 옵션(트레이드오프) · 결정과 근거 · 결과 + Evidence.
  // 배경·실행(커밋별 상세)·회고는 페이지에서 접고, 궁금하면 챗봇이 답한다
  // (be/chat 코퍼스는 서버에서 포인트 본문 전체를 읽으므로 렌더에서 빼도 답변 가능).
  const sectionDefs: RailSection[] = [
    s.problem ? { id: 'problem', label: '문제' } : null,
    s.options && s.options.length > 0 ? { id: 'options', label: '고려한 옵션' } : null,
    s.decision ? { id: 'decision', label: '결정과 근거' } : null,
    s.result ? { id: 'result', label: '결과' } : null,
    { id: 'evidence', label: 'Evidence' },
  ].filter((x): x is RailSection => x !== null);

  const numOf = (id: string) =>
    String(sectionDefs.findIndex((d) => d.id === id) + 1).padStart(2, '0');
  const projectHref = admin
    ? `/admin/projects/${encodeURIComponent(point.project)}`
    : `/projects/${encodeURIComponent(point.project)}`;
  const pointHref = (id: string) =>
    `${admin ? '/admin' : ''}/points/${encodeURIComponent(id)}`;

  return (
    <div className="point-wrap">
      {/* 좌: 팸플릿 콘텐츠 */}
      <article className="point-main reveal" id="point-body">
        {/* v3 인라인 선택-질문: 본문 텍스트 드래그 선택 → 플로팅 버튼 → 챗봇 자동 질문 */}
        <SelectionAsk containerId="point-body" />

        {admin && (
          <div className="admin-viewbar">
            <Link className="back" href="/admin">← 대시보드</Link>
            <div className="admin-actions">
              <span className={`admin-badge ${status}`}>{status}</span>
              {controls}
            </div>
          </div>
        )}

        <div className="topbar">
          <Link className="back" href={projectHref}>
            ← {point.project}
          </Link>
        </div>

        {/* 1. 제목·태그·요약·메타 */}
        <h1>{point.title}</h1>
        <div>
          {point.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
        <p className="point-lede">{point.summary}</p>
        <div className="point-meta">
          <span>Evidence <b>{point.evidence.length}건</b></span>
          <span>프로젝트 <b>{point.project}</b></span>
        </div>

        {/* 문제 (핵심) — 배경은 페이지에서 접고 챗봇이 답한다 */}
        {s.problem && (
          <section id="problem">
            <div className="section-head">
              <div className="section-label"><span className="n">{numOf('problem')}</span>문제</div>
              <AskSectionButton question="이 포인트가 풀려던 문제를 더 자세히 설명해줘" />
            </div>
            <Markdown>{s.problem}</Markdown>
          </section>
        )}

        {/* 4. 고려한 옵션 (선택, 표) */}
        {s.options && s.options.length > 0 && (
          <section id="options">
            <div className="section-label"><span className="n">{numOf('options')}</span>고려한 옵션</div>
            <OptionTable options={s.options} />
          </section>
        )}

        {/* 5. 결정과 근거 (핵심) */}
        {s.decision && (
          <section id="decision">
            <div className="section-head">
              <div className="section-label"><span className="n">{numOf('decision')}</span>결정과 근거</div>
              <AskSectionButton question="이 결정의 근거를 더 자세히 설명해줘" />
            </div>
            <Markdown>{s.decision}</Markdown>
          </section>
        )}

        {/* 결과 (핵심) — 실행(커밋별 상세)은 페이지에서 접고 챗봇이 답한다 */}
        {s.result && (
          <section id="result">
            <div className="section-label"><span className="n">{numOf('result')}</span>결과</div>
            <Markdown>{s.result}</Markdown>
          </section>
        )}

        {/* Evidence (핵심 — 발행 게이트가 ≥1 보장). 번호 각주형 + 접기 */}
        <section id="evidence">
          <EvidenceList evidence={point.evidence} />
        </section>

        {/* 깊이는 챗봇으로 — 배경·구현 상세·회고는 페이지에서 접고, 물으면 챗봇이 근거로 답한다.
            (invidence 포함 본문 전체를 be/chat 코퍼스가 읽음) */}
        <div className="depth-cta">
          <span className="t">배경 · 구현 과정 · 회고가 궁금하신가요?</span>
          <AskSectionButton question={`"${point.title}" 포인트의 배경과 구현 과정, 회고를 근거와 함께 자세히 설명해줘`} />
        </div>

        {/* 같은 프로젝트의 다른 포인트 — 팸플릿 맨 끝 카드 */}
        {siblings.length > 0 && (
          <section>
            <div className="section-label">더 보기 · 같은 프로젝트의 다른 포인트</div>
            {siblings.map((p) => (
              <Link key={p.id} className="card card-row" href={pointHref(p.id)}>
                <span className="rowmain">
                  <span className="t">{p.title}</span>
                  {p.summary && <span className="m">{p.summary}</span>}
                </span>
                <span className="chev">›</span>
              </Link>
            ))}
          </section>
        )}
      </article>

      {/* 우: 스티키 탐색 레일 — 목차 + 진행 바 + 맥락 챗봇 */}
      <PointRail sections={sectionDefs} />
    </div>
  );
}

function OptionTable({ options }: { options: Option[] }) {
  return (
    <div className="opt-table-wrap">
      <table className="opt">
        <thead>
          <tr>
            <th>옵션</th><th>장점</th><th>단점</th><th>비용/리스크</th><th>채택</th>
          </tr>
        </thead>
        <tbody>
          {options.map((o, i) => (
            <tr key={i}>
              <td>{o.option ?? ''}</td>
              <td>{o.pros ?? ''}</td>
              <td>{o.cons ?? ''}</td>
              <td>{o.cost ?? ''}</td>
              <td className="pick">{o.adopted ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
