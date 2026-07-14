// fe/browse 관리자 편집기용 마크다운 분해·재조립.
// 헤딩과 원래 블록 순서는 상태에서 고정하고, 사용자는 각 블록의 본문만 바꾼다.

export type HeadingKind =
  | "summary"
  | "background"
  | "problem"
  | "options"
  | "decision"
  | "execution"
  | "result"
  | "retrospective"
  | "evidence"
  | "other";

export interface Block {
  heading: string;
  headingKind: HeadingKind;
  body: string;
}

/** 선두 frontmatter 블록(두 delimiter 포함)과 본문을 분리한다. */
export function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return { frontmatter: "", body: raw };

  // delimiter 직후 줄바꿈은 frontmatter와 본문의 경계다. 통상 사용하는 빈 줄 하나도
  // 본문 프리앰블로 노출하지 않도록 분리 시 소비하고, assemble에서 다시 넣는다.
  const frontmatter = match[0].replace(/\r?\n$/, "");
  const body = raw.slice(match[0].length).replace(/^\r?\n/, "");
  return { frontmatter, body };
}

/** backend repository._canonical_heading과 같은 우선순위로 헤딩을 분류한다. */
export function classify(heading: string): HeadingKind {
  const text = heading.replace(/^#{1,6}\s+/, "").trim();
  const lower = text.toLowerCase();

  if (lower.includes("evidence")) return "evidence";
  if (text.includes("결정")) return "decision";
  if (text.includes("요약")) return "summary";
  if (text.includes("배경")) return "background";
  if (text.includes("고려") || text.includes("옵션")) return "options";
  if (text.includes("문제")) return "problem";
  if (text.includes("실행")) return "execution";
  if (text.includes("결과")) return "result";
  if (text.includes("회고")) return "retrospective";
  return "other";
}

/** H1~H6 헤딩을 기준으로 본문을 원래 순서의 블록으로 나눈다. */
export function splitSections(body: string): Block[] {
  if (!body) return [];

  const blocks: Block[] = [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let heading: string | null = null;
  let bodyLines: string[] = [];

  const finishBlock = () => {
    const blockBody = bodyLines.join("\n").replace(/\n+$/, "");
    // 첫 헤딩 전 실제 내용은 리딩 블록으로 보존한다. 경계의 빈 줄만으로는 만들지 않는다.
    if (heading !== null || blockBody.length > 0) {
      blocks.push({
        heading: heading ?? "",
        headingKind: heading === null ? "other" : classify(heading),
        body: blockBody,
      });
    }
  };

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      finishBlock();
      heading = line;
      bodyLines = [];
      continue;
    }
    bodyLines.push(line);
  }
  finishBlock();

  return blocks;
}

/** frontmatter와 블록을 고정된 원래 순서로 전체 마크다운으로 조립한다. */
export function assemble(frontmatter: string, blocks: Block[]): string {
  // Windows에서 읽은 원문도 저장 한 번으로 전체 파일이 LF로 바뀌지 않게 frontmatter의
  // 줄바꿈 형식을 본문에 그대로 적용한다. textarea 상태의 본문은 항상 LF로 관리한다.
  const newline = frontmatter.includes("\r\n") ? "\r\n" : "\n";
  const body = blocks
    .map(({ heading, body: blockBody }) => {
      const normalizedBody = blockBody.replace(/\r?\n/g, newline);
      if (!heading) return normalizedBody;
      return normalizedBody ? `${heading}${newline}${normalizedBody}` : heading;
    })
    .join(`${newline}${newline}`);

  if (!frontmatter) return body;
  return body ? `${frontmatter}${newline}${newline}${body}` : frontmatter;
}
