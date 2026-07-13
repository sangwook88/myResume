// fe/admin — 관리자 대시보드(비공개). 공개 페이지와 같은 디자인 시스템(globals.css)을
// 그대로 입혀 실제 페이지처럼 보이게 한다. 토큰 게이트 → draft 포함 포인트 미리보기 +
// Redis 대화 세션 내역 + 질문 로그/빈도. 브라우저에서 BE 관리자 엔드포인트를 Bearer 로
// 직접 호출한다(lib/adminClient). 토큰은 sessionStorage 에만 보관(탭 닫으면 소멸).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import type { Evidence, Option, Point } from "@/lib/types";
import {
  adminGetPoint,
  adminListPoints,
  adminListSessions,
  adminRecentQuestions,
  adminTopQuestions,
  type AdminPointSummary,
  type AdminSession,
  type QuestionLog,
  type TopQuestion,
} from "@/lib/adminClient";

const TOKEN_KEY = "po_admin_token";

function fmt(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ko-KR");
}

function OptionTable({ options }: { options: Option[] }) {
  return (
    <div className="opt-table-wrap">
      <table className="opt">
        <thead>
          <tr>
            <th>옵션</th>
            <th>장점</th>
            <th>단점</th>
            <th>비용/리스크</th>
            <th>채택</th>
          </tr>
        </thead>
        <tbody>
          {options.map((o, i) => (
            <tr key={i}>
              <td>{o.option ?? ""}</td>
              <td>{o.pros ?? ""}</td>
              <td>{o.cons ?? ""}</td>
              <td>{o.cost ?? ""}</td>
              <td className="pick">{o.adopted ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceRows({ evidence }: { evidence: Evidence[] }) {
  return (
    <ul className="evi-list">
      {evidence.map((e, i) => {
        const linked = e.url && e.url !== "—";
        const inner = (
          <>
            <span className={`kind ${e.kind}`}>{e.kind}</span>
            <span className="label">{e.label}</span>
            {linked && <span className="ext">↗</span>}
          </>
        );
        return (
          <li className="evi-item" key={i}>
            <span className="evi-num">{i + 1}</span>
            {linked ? (
              <a className="evi-link" href={e.url} target="_blank" rel="noreferrer">
                {inner}
              </a>
            ) : (
              <span className="evi-link">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PointPreview({ p }: { p: Point }) {
  const s = p.sections;
  const text: [string, string | undefined][] = [
    ["배경", s.background],
    ["문제", s.problem],
    ["결정과 근거", s.decision],
    ["실행", s.execution],
    ["결과", s.result],
    ["회고", s.retrospective],
  ];
  return (
    <div className="admin-preview">
      <div className="point-lede">
        <Markdown>{p.summary}</Markdown>
      </div>
      {text.map(([label, val]) =>
        val ? (
          <section key={label}>
            <div className="section-label">{label}</div>
            <Markdown>{val}</Markdown>
          </section>
        ) : null,
      )}
      {s.options && s.options.length > 0 && (
        <section>
          <div className="section-label">고려한 옵션</div>
          <OptionTable options={s.options} />
        </section>
      )}
      {p.evidence.length > 0 && (
        <section>
          <div className="section-label">Evidence · {p.evidence.length}건</div>
          <EvidenceRows evidence={p.evidence} />
        </section>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [points, setPoints] = useState<AdminPointSummary[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [questions, setQuestions] = useState<QuestionLog[]>([]);
  const [top, setTop] = useState<TopQuestion[]>([]);

  const [openPoint, setOpenPoint] = useState<string | null>(null);
  const [pointCache, setPointCache] = useState<Record<string, Point>>({});
  const [openSession, setOpenSession] = useState<string | null>(null);

  // 토큰으로 대시보드 데이터 전량 로드. 첫 호출(points)로 인증 성공 여부를 판정한다.
  const loadAll = useCallback(async (t: string) => {
    setLoading(true);
    setError("");
    const pts = await adminListPoints(t);
    if (!pts.ok) {
      setError(pts.message);
      setToken(null);
      sessionStorage.removeItem(TOKEN_KEY);
      setLoading(false);
      return;
    }
    setPoints(pts.data);
    sessionStorage.setItem(TOKEN_KEY, t);
    setToken(t);

    const [ses, q, tq] = await Promise.all([
      adminListSessions(t),
      adminRecentQuestions(t),
      adminTopQuestions(t),
    ]);
    if (ses.ok) setSessions(ses.data);
    if (q.ok) setQuestions(q.data);
    if (tq.ok) setTop(tq.data);
    setLoading(false);
  }, []);

  // 마운트 시 저장된 토큰이 있으면 자동 진입 시도.
  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) {
      setTokenInput(saved);
      void loadAll(saved);
    }
  }, [loadAll]);

  const togglePoint = async (id: string) => {
    if (openPoint === id) {
      setOpenPoint(null);
      return;
    }
    setOpenPoint(id);
    if (!pointCache[id] && token) {
      const r = await adminGetPoint(token, id);
      if (r.ok) setPointCache((c) => ({ ...c, [id]: r.data }));
    }
  };

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setTokenInput("");
    setPoints([]);
    setSessions([]);
    setQuestions([]);
    setTop([]);
    setOpenPoint(null);
    setOpenSession(null);
  };

  // ── 게이트 화면(미인증) ──
  if (!token) {
    return (
      <main className="page reveal">
        <div className="topbar">
          <Link className="back" href="/">
            ← 랜딩
          </Link>
          <span>관리자</span>
        </div>
        <h1>관리자 모드</h1>
        <p className="sub">
          백엔드 <code>CHAT_ADMIN_TOKEN</code> 과 같은 토큰을 입력하세요. 토큰은 이 탭에만
          저장됩니다.
        </p>
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (tokenInput.trim()) void loadAll(tokenInput.trim());
          }}
        >
          <input
            className="admin-input"
            type="password"
            placeholder="관리자 토큰"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            autoFocus
          />
          <button className="back" type="submit" disabled={loading}>
            {loading ? "확인 중…" : "진입"}
          </button>
        </form>
        {error && <p className="admin-error">{error}</p>}
      </main>
    );
  }

  // 프로젝트별 그룹핑(draft·published 를 한 목록에서 구분).
  const byProject = points.reduce<Record<string, AdminPointSummary[]>>((acc, p) => {
    (acc[p.project] ||= []).push(p);
    return acc;
  }, {});

  // ── 대시보드(인증) ──
  return (
    <main className="page reveal">
      <div className="topbar">
        <Link className="back" href="/">
          ← 랜딩
        </Link>
        <span>관리자</span>
      </div>

      <div className="admin-toolbar">
        <h1>관리자 대시보드</h1>
        <div className="admin-actions">
          <button className="back" onClick={() => token && loadAll(token)} disabled={loading}>
            {loading ? "새로고침 중…" : "새로고침"}
          </button>
          <button className="back" onClick={logout}>
            로그아웃
          </button>
        </div>
      </div>

      {/* 포인트 (draft 포함) */}
      <div className="section-label">
        포인트 <span className="admin-count">· {points.length}개 (draft 포함)</span>
      </div>
      {points.length === 0 && <div className="empty-state">포인트가 없습니다.</div>}
      {Object.entries(byProject).map(([project, list]) => (
        <div key={project}>
          <div className="admin-grouphead">{project}</div>
          {list.map((p) => {
            const draft = p.status !== "published";
            const open = openPoint === p.id;
            return (
              <div className="card" key={p.id}>
                <button className="admin-rowbtn" onClick={() => togglePoint(p.id)}>
                  <span className="lead">
                    <span className={`admin-badge ${draft ? "draft" : "published"}`}>
                      {draft ? "draft" : "published"}
                    </span>
                    <span className="ttl">{p.title}</span>
                  </span>
                  <span className="aside">
                    {p.updated ?? ""}
                    <span className="caret"> {open ? "▲" : "▼"}</span>
                  </span>
                </button>
                {p.summary && <div className="m">{p.summary}</div>}
                {open &&
                  (pointCache[p.id] ? (
                    <PointPreview p={pointCache[p.id]} />
                  ) : (
                    <div className="m">불러오는 중…</div>
                  ))}
              </div>
            );
          })}
        </div>
      ))}

      {/* 채팅 세션 (Redis) */}
      <div className="section-label">
        채팅 세션 <span className="admin-count">· {sessions.length}개 (Redis)</span>
      </div>
      {sessions.length === 0 && (
        <div className="empty-state">세션이 없습니다(만료·Redis 미접속 포함).</div>
      )}
      {sessions.map((ses) => {
        const open = openSession === ses.sessionId;
        return (
          <div className="card" key={ses.sessionId}>
            <button
              className="admin-rowbtn"
              onClick={() => setOpenSession(open ? null : ses.sessionId)}
            >
              <span className="lead">
                <span className="admin-mono">{ses.sessionId.slice(0, 12)}…</span>
                <span className="aside">
                  {ses.turns.length}턴{ses.context ? ` · 맥락 ${ses.context}` : ""}
                </span>
              </span>
              <span className="aside">
                {fmt(ses.createdAt)}
                <span className="caret"> {open ? "▲" : "▼"}</span>
              </span>
            </button>
            {open && (
              <div className="admin-turns">
                {ses.turns.length === 0 && <div className="m">턴이 없습니다.</div>}
                {ses.turns.map((t, i) => (
                  <div className={`bubble ${t.role === "user" ? "me" : "bot"}`} key={i}>
                    {t.role === "assistant" ? (
                      <Markdown className="md">{t.text}</Markdown>
                    ) : (
                      t.text
                    )}
                    {t.role === "assistant" && t.citations && t.citations.length > 0 && (
                      <div className="evi">
                        <div className="lbl">근거</div>
                        {t.citations.map((c, j) => (
                          <a key={j} href={c.url} target="_blank" rel="noreferrer">
                            <span className={`tag2 ${c.kind}`}>{c.kind}</span>
                            <span className="lbltext">{c.label}</span>
                            <span className="ext">↗</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* 질문 빈도 랭킹 */}
      <div className="section-label">질문 빈도 랭킹</div>
      {top.length === 0 ? (
        <div className="empty-state">집계된 질문이 없습니다.</div>
      ) : (
        <div className="opt-table-wrap">
          <table className="opt">
            <thead>
              <tr>
                <th>#</th>
                <th>질문</th>
                <th>횟수</th>
              </tr>
            </thead>
            <tbody>
              {top.map((t, i) => (
                <tr key={i}>
                  <td className="pick">{i + 1}</td>
                  <td>{t.question}</td>
                  <td className="pick">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 최근 질문 로그 */}
      <div className="section-label">
        최근 질문 로그 <span className="admin-count">· {questions.length}개</span>
      </div>
      {questions.length === 0 ? (
        <div className="empty-state">질문 로그가 없습니다.</div>
      ) : (
        <div className="opt-table-wrap">
          <table className="opt">
            <thead>
              <tr>
                <th>시각</th>
                <th>IP</th>
                <th>모드</th>
                <th>맥락</th>
                <th>질문</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, i) => (
                <tr key={i}>
                  <td className="admin-mono">{fmt(new Date(q.ts * 1000).toISOString())}</td>
                  <td className="admin-mono">{q.ip}</td>
                  <td>{q.mode}</td>
                  <td>{q.context ?? ""}</td>
                  <td>{q.question}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
