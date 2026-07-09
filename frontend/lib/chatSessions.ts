// fe/chat — 이 브라우저(방문자)가 만든 대화 세션들의 인덱스(목록·제목·활성).
//
// 배포모델 A(포크 셀프호스팅) = 서버 관계형 DB 없음. 대화 이력 '본체'는 서버
// (be/chat Redis, TTL 1일)가 session_id 로 보관하고, "내가 어떤 세션을 갖고 있나
// (목록·제목·지금 보는 것)"는 계정 없이 이 브라우저 localStorage 가 소유한다.
// 덕분에 로그인 없이도 새 채팅·이전 채팅 전환이 가능하다.
// 한계(설계상 수용): 자기 브라우저 한정 · 서버 TTL 1일 초과분은 복원 불가 · 기기 간 미동기화.

export interface ChatSessionMeta {
  id: string;
  title: string;
  updatedAt: number; // epoch ms — 최근 활동순 정렬 키
}

const LIST_KEY = 'po.chat.sessions.v1';
const ACTIVE_KEY = 'po.chat.active.v1';
const MAX_SESSIONS = 30; // 무한 누적 방지(서버 TTL 1일과 정렬) — 오래된 것부터 정리
const UNTITLED = '새 대화';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** 새 세션 id 발급. crypto.randomUUID 우선, 없으면 시간+난수 폴백. */
export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 이 브라우저의 세션 목록(최근 활동순). SSR·스토리지 불가 환경에선 빈 배열. */
export function listSessions(): ChatSessionMeta[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LIST_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return (arr as ChatSessionMeta[])
      .filter((s) => s && typeof s.id === 'string')
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

function writeList(list: ChatSessionMeta[]): void {
  if (!canUseStorage()) return;
  try {
    const trimmed = [...list]
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, MAX_SESSIONS);
    window.localStorage.setItem(LIST_KEY, JSON.stringify(trimmed));
  } catch {
    /* 용량 초과 등은 조용히 무시(챗봇은 계속 동작) */
  }
}

export function getActiveId(): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveId(id: string | null): void {
  if (!canUseStorage()) return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* 무시 */
  }
}

function deriveTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return UNTITLED;
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}

/**
 * 세션을 목록에 만들거나 갱신한다(활동 시각 갱신). firstUserText 는 제목이 아직
 * 비어있을(UNTITLED) 때만 반영해 첫 질문을 제목으로 삼는다. 갱신된 목록을 반환.
 */
export function touchSession(id: string, firstUserText?: string): ChatSessionMeta[] {
  const list = listSessions();
  const now = Date.now();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) {
    list.push({ id, title: firstUserText ? deriveTitle(firstUserText) : UNTITLED, updatedAt: now });
  } else {
    const cur = list[idx];
    const keepTitle = cur.title && cur.title !== UNTITLED;
    list[idx] = {
      ...cur,
      updatedAt: now,
      title: keepTitle ? cur.title : firstUserText ? deriveTitle(firstUserText) : cur.title,
    };
  }
  writeList(list);
  return listSessions();
}

/** 세션을 목록에서 제거하고 갱신된 목록을 반환(서버 이력은 TTL 로 자연 만료). */
export function removeSession(id: string): ChatSessionMeta[] {
  writeList(listSessions().filter((s) => s.id !== id));
  return listSessions();
}
