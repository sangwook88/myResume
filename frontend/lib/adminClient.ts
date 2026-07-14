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

function errorMessage(status: number, payload: unknown): string {
  if (status === 403) return "관리자 토큰이 올바르지 않습니다.";
  if (
    status === 404 &&
    (!payload ||
      (typeof payload === "object" &&
        "detail" in payload &&
        (payload as { detail?: unknown }).detail === "Not Found"))
  ) {
    return "대상을 찾지 못했거나 관리자 기능이 꺼져 있습니다.";
  }
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item
            ? String((item as { msg: unknown }).msg)
            : "",
        )
        .filter(Boolean);
      if (messages.length > 0) return messages.join("\n");
    }
  }
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (status === 404) return "대상을 찾지 못했거나 관리자 기능이 꺼져 있습니다.";
  return `요청 실패 (${status})`;
}

async function requestJson<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<AdminResult<T>> {
  let res: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch {
    return {
      ok: false,
      status: 0,
      message: "백엔드에 연결하지 못했습니다. 서버(:8000)가 켜져 있는지 확인하세요.",
    };
  }
  let payload: unknown;
  try {
    const text = await res.text();
    if (!text) {
      payload = undefined;
    } else {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
  } catch {
    payload = undefined;
  }
  if (!res.ok) {
    return { ok: false, status: res.status, message: errorMessage(res.status, payload) };
  }
  if (payload === undefined || typeof payload === "string") {
    return { ok: false, status: res.status, message: "응답을 해석하지 못했습니다." };
  }
  return { ok: true, data: payload as T };
}

const getJson = <T>(path: string, token: string) => requestJson<T>(path, token);

/** draft 포함 전체 포인트 요약. */
export const adminListPoints = (token: string) =>
  getJson<AdminPointSummary[]>("/api/points/admin", token);

/** draft 포함 단건 전문(미리보기). */
export const adminGetPoint = (token: string, id: string) =>
  getJson<Point>(`/api/points/admin/${encodeURIComponent(id)}`, token);

/** draft 포인트를 포함한 프로젝트 인덱스 단건. */
export const adminGetProject = (token: string, slug: string) =>
  getJson<ProjectIndex>(`/api/projects/admin/${encodeURIComponent(slug)}`, token);

/** 편집기 프리필용 포인트 원문 마크다운. */
export const adminGetPointRaw = (token: string, id: string) =>
  getJson<{ content: string }>(`/api/points/admin/${encodeURIComponent(id)}/raw`, token);

/** 포인트 원문 전체를 검증·저장하고 갱신된 포인트를 받는다. */
export const adminSavePoint = (token: string, id: string, content: string) =>
  requestJson<Point>(`/api/points/admin/${encodeURIComponent(id)}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

/** 포인트 섹션에 넣을 이미지를 업로드하고 BE가 만든 마크다운 조각을 받는다. */
export const adminUploadPointImage = (token: string, id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return requestJson<{ url: string; markdown: string; filename: string }>(
    `/api/points/admin/${encodeURIComponent(id)}/images`,
    token,
    { method: "POST", body: form },
  );
};

/** 완성된 SVG 도식을 업로드하고 갱신된 프로젝트 인덱스를 받는다. */
export const adminUploadDiagram = (token: string, slug: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return requestJson<ProjectIndex>(
    `/api/projects/admin/${encodeURIComponent(slug)}/diagram`,
    token,
    { method: "PUT", body: form },
  );
};

/** Redis 대화 세션 전체(turns 포함). */
export const adminListSessions = (token: string, limit = 200) =>
  getJson<AdminSession[]>(`/api/chat/admin/sessions?limit=${limit}`, token);

/** 최근 질문 로그. */
export const adminRecentQuestions = (token: string, limit = 100) =>
  getJson<QuestionLog[]>(`/api/chat/admin/questions?limit=${limit}`, token);

/** 질문 빈도 랭킹. */
export const adminTopQuestions = (token: string, limit = 50) =>
  getJson<TopQuestion[]>(`/api/chat/admin/top?limit=${limit}`, token);
