'use client';

// fe/browse — 랜딩 2단 탐색 뷰.
//   · 좌(landing-main): 추천 포폴 포인트 + 프로젝트 목록(기술 스택 태그 노출).
//   · 우(point-rail): 기술 스택 필터(멀티선택) + 근거 챗봇 런처.
// 필터 상태를 한 컴포넌트가 소유해야 목록과 레일 칩이 함께 반응하므로 전체를 여기서 렌더한다.
// 포인트의 기술 스택 = 그 포인트가 속한 프로젝트의 techStack(포인트엔 스택 데이터가 없다).
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import ProfileHeader from '@/components/ProfileHeader';
import { askChat } from '@/lib/askChat';
import type { PointSummary, Profile } from '@/lib/types';
import { displayText } from '@/lib/displayText';

export interface LandingProject {
  slug: string;
  name: string;
  summary: string;
  techStack: string[];
}

const CHAT_QUESTIONS = [
  '이 사람의 강점이 뭐야?',
  '가장 도전적이었던 결정은 뭐였어?',
  '주로 어떤 문제를 풀었어?',
];

export default function LandingExplorer({
  recommended,
  projects,
  profile,
}: {
  recommended: PointSummary[];
  projects: LandingProject[];
  profile: Profile;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [input, setInput] = useState('');

  // 전체 기술 스택(빈도순 → 이름순) + 프로젝트별 스택 맵.
  const { allStacks, stackByProject } = useMemo(() => {
    const count = new Map<string, number>();
    const map: Record<string, string[]> = {};
    for (const p of projects) {
      map[p.slug] = p.techStack;
      for (const t of p.techStack) count.set(t, (count.get(t) ?? 0) + 1);
    }
    const stacks = Array.from(count.keys()).sort(
      (a, b) => (count.get(b)! - count.get(a)!) || a.localeCompare(b),
    );
    return { allStacks: stacks, stackByProject: map };
  }, [projects]);

  const active = selected.size > 0;
  const matches = (stacks: string[]) => stacks.some((t) => selected.has(t));

  const filteredPoints = active
    ? recommended.filter((pt) => matches(stackByProject[pt.project] ?? []))
    : recommended;
  const filteredProjects = active ? projects.filter((p) => matches(p.techStack)) : projects;

  function toggle(stack: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stack)) next.delete(stack);
      else next.add(stack);
      return next;
    });
  }
  function ask(q: string) {
    const t = q.trim();
    if (t) askChat(t);
  }

  return (
    <main className="point-wrap">
      {/* 좌: 목록 */}
      <div className="landing-main">
        <ProfileHeader
          profile={profile}
          projectCount={projects.length}
          caseCount={recommended.length}
        />

        {active && (
          <p className="filter-note">
            선택한 기술 스택: {Array.from(selected).map(displayText).join(', ')} / 포인트 {filteredPoints.length} / 프로젝트 {filteredProjects.length}
          </p>
        )}

        <h2 className="landing-section-title">추천 구현 사례</h2>
        {filteredPoints.length > 0 ? (
          filteredPoints.map((p, i) => (
            <Reveal key={p.id} index={i}>
              <Link className="card" href={`/points/${encodeURIComponent(p.id)}`}>
                <div className="t">{displayText(p.title)}</div>
                {p.summary && <div className="m">{displayText(p.summary)}</div>}
                <div className="m">
                  {p.tags.map((tag) => (
                    <span key={tag} className="tag">{displayText(tag)}</span>
                  ))}
                  <span>{displayText(p.project)} 프로젝트</span>
                </div>
              </Link>
            </Reveal>
          ))
        ) : (
          <div className="empty-state">선택한 기술 스택에 해당하는 추천 포인트가 없습니다.</div>
        )}

        <h2 className="landing-section-title">프로젝트</h2>
        {filteredProjects.length > 0 ? (
          filteredProjects.map((proj, i) => (
            <Reveal key={proj.slug} index={i}>
              <Link className="card" href={`/projects/${encodeURIComponent(proj.slug)}`}>
                <div className="t">{displayText(proj.name)}</div>
                <div className="m">{displayText(proj.summary)}</div>
                {proj.techStack.length > 0 && (
                  <div className="stackline">
                    {proj.techStack.map((t) => (
                      <span key={t} className="tag">{displayText(t)}</span>
                    ))}
                  </div>
                )}
              </Link>
            </Reveal>
          ))
        ) : (
          <div className="empty-state">선택한 기술 스택에 해당하는 프로젝트가 없습니다.</div>
        )}
      </div>

      {/* 우: 탐색 레일 */}
      <aside className="point-rail">
        {allStacks.length > 0 && (
          <nav className="rail-card" aria-label="기술 스택으로 탐색">
            <div className="rail-head">기술 스택으로 탐색</div>
            <div className="facets">
              {allStacks.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`facet ${selected.has(t) ? 'on' : ''}`}
                  aria-pressed={selected.has(t)}
                  onClick={() => toggle(t)}
                >
                  {displayText(t)}
                </button>
              ))}
            </div>
            {active && (
              <button type="button" className="rail-reset" onClick={() => setSelected(new Set())}>
                × 필터 초기화
              </button>
            )}
          </nav>
        )}

        <div className="rail-card">
          <div className="rail-chat-head">
            <span className="t">근거로 답하는 챗봇</span>
          </div>
          <div className="rail-chat-sub">포트폴리오 전반에 대해 물어보세요.</div>
          <div className="rail-chips">
            <div className="clbl">이런 걸 물어볼 수 있어요</div>
            {CHAT_QUESTIONS.map((q) => (
              <button key={q} type="button" className="rail-chip" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
          <form
            className="rail-composer"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
              setInput('');
            }}
          >
            <label htmlFor="landing-question">직접 질문</label>
            <div className="composer-row">
              <input
                id="landing-question"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="질문을 입력하세요"
              />
              <button type="submit">전송</button>
            </div>
          </form>
        </div>
      </aside>
    </main>
  );
}
