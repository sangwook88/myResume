// fe/browse — 포폴 포인트 상세. 2단 팸플릿 레이아웃:
//   · 좌(point-main): 추천 순서대로 흐르는 케이스 스터디(STAR+ADR) — 읽기폭 제한.
//   · 우(PointRail): 스크롤 추적 목차 + 읽기 진행 바 + 그 섹션 맥락의 근거 챗봇.
// 없는/draft id → BE 302 → api null → 랜딩 redirect(draft 존재 비노출).
// 선택 섹션(배경·옵션·실행·결과·회고)은 응답에서 생략되면 렌더도 생략.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPoint, getProjectPoints } from '@/lib/api';
import type { Option } from '@/lib/types';
import EvidenceList from '@/components/EvidenceList';
import AskSectionButton from '@/components/AskSectionButton';
import SelectionAsk from '@/components/SelectionAsk';
import PointRail, { type RailSection } from '@/components/PointRail';

export default async function PointDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const point = await getPoint(params.id);
  if (!point) redirect('/');

  // 같은 프로젝트 다른 포인트(현재 포인트 제외). 실패·0개면 목록 생략.
  const siblings = (await getProjectPoints(point.project)).filter(
    (p) => p.id !== point.id,
  );

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

  return (
    <div className="point-wrap">
      {/* 좌: 팸플릿 콘텐츠 */}
      <article className="point-main reveal" id="point-body">
        {/* v3 인라인 선택-질문: 본문 텍스트 드래그 선택 → 플로팅 버튼 → 챗봇 자동 질문 */}
        <SelectionAsk containerId="point-body" />

        <div className="topbar">
          <Link className="back" href={`/projects/${encodeURIComponent(point.project)}`}>
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
            <p>{s.problem}</p>
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
            <p>{s.decision}</p>
          </section>
        )}

        {/* 결과 (핵심) — 실행(커밋별 상세)은 페이지에서 접고 챗봇이 답한다 */}
        {s.result && (
          <section id="result">
            <div className="section-label"><span className="n">{numOf('result')}</span>결과</div>
            <p>{s.result}</p>
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
              <Link key={p.id} className="card card-row" href={`/points/${encodeURIComponent(p.id)}`}>
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
