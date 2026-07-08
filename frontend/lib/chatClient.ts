// fe/chat — be/chat REST 소비 클라이언트.
// - POST /api/chat : SSE(text/event-stream) 스트리밍 답변 소비.
// - GET  /api/chat/suggestions?point=<id> : 맥락 제안질문 소비.
// 세션은 서버가 쿠키 session_id 로 관리하므로 credentials:'include' 로 자동 동봉한다.
// 로컬 저장·응답 생성·근거 정책은 be/chat 소관(여기선 HTTP 소비만).

// BE API base. 비어 있으면 동일 오리진 상대경로(/api/...)로 요청한다.
// fe/browse 와 동일 관례(NEXT_PUBLIC_API_BASE) 가정.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

/** 답변이 인용한 근거 1건. be/point Evidence(kind·label·url) 재사용. */
export interface Citation {
  kind: "commit" | "pr" | "swagger" | "file" | "link" | string;
  label: string;
  url: string;
}

/** 답변이 인용한 근거가 나온 출처 포인트(v2 하이브리드 딥링크). */
export interface PointRef {
  id: string;
  title: string;
}

/** POST /api/chat 요청 바디. session_id 는 쿠키로 별도 동봉(바디에 없음). */
export interface ChatRequestBody {
  question: string;
  context?: string | null; // 진입 맥락 = 보던 포인트 id 또는 null(무맥락)
  mode?: "technical" | "hr"; // 답변 눈높이(v2 모드 토글). 생략 시 BE 기본 technical
}

/** 스트리밍 이벤트 핸들러 묶음. */
export interface StreamHandlers {
  onToken: (text: string) => void; // 0..N회, 점진 토큰
  onCitations: (citations: Citation[]) => void; // 1회, 답변 끝 인용(없으면 [])
  onPoints?: (points: PointRef[]) => void; // 선택: 인용 근거의 출처 포인트(딥링크)
  onDone: () => void; // 정상 종료
  onError: (message: string) => void; // 생성 실패·타임아웃·연결 오류
}

/** SSE 한 프레임(event/data 라인)을 파싱해 해당 핸들러로 디스패치. */
function dispatchFrame(frame: string, h: StreamHandlers): void {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith(":")) continue; // 주석(하트비트) 무시
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  const data = dataLines.join("\n");
  switch (event) {
    case "token": {
      try {
        h.onToken(JSON.parse(data).text ?? "");
      } catch {
        /* 깨진 프레임은 조용히 무시 */
      }
      break;
    }
    case "citations": {
      try {
        const parsed = JSON.parse(data);
        h.onCitations(Array.isArray(parsed) ? (parsed as Citation[]) : []);
      } catch {
        h.onCitations([]);
      }
      break;
    }
    case "points": {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) h.onPoints?.(parsed as PointRef[]);
      } catch {
        /* 무시 */
      }
      break;
    }
    case "error": {
      let msg = "답변 생성에 실패했습니다. 다시 시도해 주세요.";
      try {
        msg = JSON.parse(data).message || msg;
      } catch {
        /* 기본 문구 유지 */
      }
      h.onError(msg);
      break;
    }
    case "done": {
      h.onDone();
      break;
    }
    default:
      break;
  }
}

/**
 * POST /api/chat 를 열어 SSE 답변을 스트리밍 소비한다.
 * EventSource 는 GET 전용이라 쓰지 못하므로 fetch + ReadableStream 으로 직접 파싱한다.
 * signal 로 취소 가능(패널 언마운트 시 abort).
 */
export async function streamChat(
  body: ChatRequestBody,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // 세션 쿠키(session_id) 자동 동봉·수신
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal?.aborted) return;
    handlers.onError("네트워크 오류로 답변을 받지 못했습니다. 다시 시도해 주세요.");
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError("답변 생성에 실패했습니다. 다시 시도해 주세요.");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    // 프레임 경계 = 빈 줄(\n\n). 청크를 모아 완성된 프레임만 디스패치.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (frame.trim() !== "") dispatchFrame(frame, handlers);
      }
    }
  } catch {
    if (signal?.aborted) return;
    handlers.onError("답변 도중 연결이 끊겼습니다. 다시 시도해 주세요.");
  }
}

/**
 * GET /api/chat/suggestions?point=<id> — 포인트 맥락 제안질문(3개).
 * 없는/비공개 포인트·오류면 빈 배열(호출측이 정적 폴백).
 */
export async function fetchSuggestions(
  pointId: string,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/chat/suggestions?point=${encodeURIComponent(pointId)}`,
      { credentials: "include", signal },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data)
      ? data.filter((x: unknown): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}
