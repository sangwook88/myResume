// fe/admin — 관리자 대시보드용 BE 소비 클라이언트 (브라우저에서 직접 호출).
// 공개 fetch(lib/api.ts, 서버 컴포넌트)와 달리 관리자 토큰을 Authorization: Bearer 로
// 실어 브라우저에서 BE 를 직접 부른다(CORS 허용 + allow_headers=* ). 토큰은 사용자가
// 대시보드에서 입력하며 sessionStorage 에만 둔다(번들·서버에 박히지 않음).
//
// 게이트 계약(app/admin.py):
//   - CHAT_ADMIN_TOKEN 미설정 → 404 (기능 은닉)
//   - 토큰 불일치        → 403
import type { Point, PointSummary, ProjectIndex } from "./types";

// 브라우저 base. chatClient 와 동일 관례(NEXT_PUBLIC_API_BASE). 비면 동일 오리진.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

/** 관리자 토큰을 현재 탭에서 공유하는 sessionStorage 키. */
export const ADMIN_TOKEN_KEY = "po_admin_token";

/** 관리자 목록 요약 — 공개 요약 + status·updated(draft/published 구분). */
export interface AdminPointSummary extends PointSummary {
  status: string; // draft | published
  updated?: string | null;
}

/** 세션 한 턴(관리자 조회). be/chat Turn 계약과 동일. */
export interface AdminTurn {
  role: "user" | "assistant";
  text: string;
  citations?: { kind: string; label: string; url: string }[];
}

/** Redis 대화 세션 1묶음(be/chat Session, camelCase). */
export interface AdminSession {
  sessionId: string;
  context?: string | null;
  turns: AdminTurn[];
  createdAt: string;
  expiresAt: string;
}

/** 질문 로그 레코드(chat:qlog). */
export interface QuestionLog {
  ts: number;
  ip: string;
  session: string;
  context?: string | null;
  mode: string;
  question: string;
}

/** 질문 빈도 랭킹 한 줄(chat:qfreq). */
export interface TopQuestion {
  question: string;
  count: number;
}

/** fetch 결과 — 성공(data) 또는 실패(status·message). */
export type AdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

async function getJson<T>(path: string, token: string): Promise<AdminResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    return {
      ok: false,
      status: 0,
      message: "백엔드에 연결하지 못했습니다. 서버(:8000)가 켜져 있는지 확인하세요.",
    };
  }
  if (res.status === 404) {
    return {
      ok: false,
      status: 404,
      message: "관리자 기능이 꺼져 있습니다. 백엔드에 CHAT_ADMIN_TOKEN 을 설정하세요.",
    };
  }
  if (res.status === 403) {
    return { ok: false, status: 403, message: "관리자 토큰이 올바르지 않습니다." };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, message: `요청 실패 (${res.status})` };
  }
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: res.status, message: "응답을 해석하지 못했습니다." };
  }
}

/** draft 포함 전체 포인트 요약. */
export const adminListPoints = (token: string) =>
  getJson<AdminPointSummary[]>("/api/points/admin", token);

/** draft 포함 단건 전문(미리보기). */
export const adminGetPoint = (token: string, id: string) =>
  getJson<Point>(`/api/points/admin/${encodeURIComponent(id)}`, token);

/** draft 포인트를 포함한 프로젝트 인덱스 단건(be/0007). */
export const adminGetProject = (token: string, slug: string) =>
  getJson<ProjectIndex>(`/api/projects/admin/${encodeURIComponent(slug)}`, token);

/** Redis 대화 세션 전체(turns 포함). */
export const adminListSessions = (token: string, limit = 200) =>
  getJson<AdminSession[]>(`/api/chat/admin/sessions?limit=${limit}`, token);

/** 최근 질문 로그. */
export const adminRecentQuestions = (token: string, limit = 100) =>
  getJson<QuestionLog[]>(`/api/chat/admin/questions?limit=${limit}`, token);

/** 질문 빈도 랭킹. */
export const adminTopQuestions = (token: string, limit = 50) =>
  getJson<TopQuestion[]>(`/api/chat/admin/top?limit=${limit}`, token);
