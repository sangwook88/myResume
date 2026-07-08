// fe/browse — 포폴 포인트 상세. 9섹션(STAR+ADR) + Evidence + 같은 프로젝트 다른 포인트.
// 없는/draft id → BE 302 → api null → 랜딩 redirect(draft 존재 비노출).
// 선택 섹션(배경·옵션·실행·결과·회고)은 응답에서 생략되면 렌더도 생략.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPoint, getProjectPoints } from '@/lib/api';
import type { Option } from '@/lib/types';
import EvidenceList from '@/components/EvidenceList';
import AskChips from '@/components/AskChips';
import AskSectionButton from '@/components/AskSectionButton';
import SelectionAsk from '@/components/SelectionAsk';

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

  // A: 포인트 하단 인라인 추천질문(있는 섹션 기반, 최대 3). 클릭 → 챗봇 열림+자동전송.
  const askQuestions = [
    s.decision ? '이 결정을 왜 내렸는지 근거와 함께 설명해줘' : null,
    s.options ? '고려한 다른 옵션은 뭐였고 왜 안 골랐어?' : null,
    s.result ? '이 결정의 결과는 어땠어?' : null,
    s.retrospective ? '여기서 배운 점(회고)은 뭐야?' : null,
  ].filter((q): q is string => q !== null).slice(0, 3);

  return (
    <main className="page" id="point-body">
      {/* v3 인라인 선택-질문: 본문(#point-body) 텍스트 드래그 선택 → 플로팅 버튼 → 챗봇 자동 질문 */}
      <SelectionAsk containerId="point-body" />
      <div className="topbar">
        <Link className="back" href={`/projects/${encodeURIComponent(point.project)}`}>
          ← {point.project}
        </Link>
      </div>

      {/* 1. 제목·요약 */}
      <h1>{point.title}</h1>
      <div>
        {point.tags.map((tag) => (
          <span key={tag} className="tag">{tag}</span>
        ))}
      </div>
      <p className="sub">{point.summary}</p>

      {/* 2. 배경 (선택) */}
      {s.background && (
        <section>
          <div className="section-label">배경</div>
          <p>{s.background}</p>
        </section>
      )}

      {/* 3. 문제 (핵심) */}
      {s.problem && (
        <section>
          <div className="section-head">
            <div className="section-label">문제</div>
            <AskSectionButton question="이 포인트가 풀려던 문제를 더 자세히 설명해줘" />
          </div>
          <p>{s.problem}</p>
        </section>
      )}

      {/* 4. 고려한 옵션 (선택, 표) */}
      {s.options && s.options.length > 0 && (
        <section>
          <div className="section-label">고려한 옵션</div>
          <OptionTable options={s.options} />
        </section>
      )}

      {/* 5. 결정과 근거 (핵심) */}
      {s.decision && (
        <section>
          <div className="section-head">
            <div className="section-label">결정과 근거</div>
            <AskSectionButton question="이 결정의 근거를 더 자세히 설명해줘" />
          </div>
          <p>{s.decision}</p>
        </section>
      )}

      {/* 6. 실행 (선택) */}
      {s.execution && (
        <section>
          <div className="section-label">실행</div>
          <p>{s.execution}</p>
        </section>
      )}

      {/* 7. 결과 (선택) */}
      {s.result && (
        <section>
          <div className="section-label">결과</div>
          <p>{s.result}</p>
        </section>
      )}

      {/* 8. 회고 (선택) */}
      {s.retrospective && (
        <section>
          <div className="section-label">회고</div>
          <p>{s.retrospective}</p>
        </section>
      )}

      {/* 9. Evidence (핵심 — 발행 게이트가 ≥1 보장). v2: 번호 각주형 + 접기 */}
      <EvidenceList evidence={point.evidence} />

      {/* v2(A) 읽다가 → 묻기 다리: 인라인 추천질문 칩 */}
      <AskChips questions={askQuestions} />

      {siblings.length > 0 && (
        <section>
          <div className="section-label">같은 프로젝트의 다른 포인트</div>
          {siblings.map((p) => (
            <Link key={p.id} className="card card-row" href={`/points/${encodeURIComponent(p.id)}`}>
              <span className="t">{p.title}</span>
              <span className="chev">›</span>
            </Link>
          ))}
        </section>
      )}
    </main>
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

