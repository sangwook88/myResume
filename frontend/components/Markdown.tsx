// 재사용 마크다운 렌더러 — react-markdown + gfm(표·목록·강조·코드).
// 챗봇 답변(MessageList)과 동일한 파서를 쓰되, 말풍선 밖 본문(관리자 미리보기 등)에서도
// 쓰도록 컨테이너 클래스를 인자로 받는다. 링크는 새 탭으로.
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export default function Markdown({
  children,
  className = "md-doc",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
          img: ({ node, src, style, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element -- BE가 서빙하는 사용자 첨부 이미지
            <img
              src={typeof src === "string" && src.startsWith("/api/") ? `${API_BASE}${src}` : src}
              loading="lazy"
              style={{ maxWidth: "100%", height: "auto", ...style }}
              {...props}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
