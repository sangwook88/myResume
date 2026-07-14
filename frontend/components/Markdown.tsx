// 재사용 마크다운 렌더러 — react-markdown + gfm(표·목록·강조·코드).
// 챗봇 답변(MessageList)과 동일한 파서를 쓰되, 말풍선 밖 본문(관리자 미리보기 등)에서도
// 쓰도록 컨테이너 클래스를 인자로 받는다. 링크는 새 탭으로.
"use client";

import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseImageTitle } from "@/lib/pointMarkdown";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

// 이미지 title 속성(w=50%;align=center)을 크기·정렬 스타일로 변환한다.
// 편집기 미리보기와 공개 페이지가 이 함수를 공유하므로 "편집=결과"가 성립한다.
function imageStyleFromTitle(title?: string | null): { style: CSSProperties; caption?: string } {
  const meta = parseImageTitle(title);
  const style: CSSProperties = { maxWidth: "100%", height: "auto" };
  if (meta.width) style.width = meta.width;
  if (meta.align) {
    style.display = "block";
    style.marginLeft = meta.align === "left" ? 0 : "auto";
    style.marginRight = meta.align === "right" ? 0 : "auto";
  }
  return { style, caption: meta.caption };
}

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
          img: ({ node, src, style, title, ...props }) => {
            const meta = imageStyleFromTitle(title);
            return (
              // eslint-disable-next-line @next/next/no-img-element -- BE가 서빙하는 사용자 첨부 이미지
              <img
                src={typeof src === "string" && src.startsWith("/api/") ? `${API_BASE}${src}` : src}
                loading="lazy"
                title={meta.caption}
                style={{ ...meta.style, ...style }}
                {...props}
              />
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
