// 근거기반 포트폴리오 — 압축 아키텍처 도식 (be/project 도식컴파일 → SVG).
// 외부 패키지 없이 typst 기본 요소(rect·grid)만 사용 — 오프라인/포크에서도 컴파일 가능.
#set page(width: auto, height: auto, margin: 14pt, fill: white)
#set text(font: ("Malgun Gothic", "Noto Sans CJK KR"), size: 10pt, lang: "ko")

#let node(title, sub, accent: rgb("#334155"), fill: rgb("#eef2f7")) = rect(
  radius: 6pt, inset: (x: 12pt, y: 9pt), stroke: 1pt + accent, fill: fill,
)[
  #set align(left)
  #text(weight: "bold", size: 10.5pt, fill: accent)[#title] \
  #text(size: 8pt, fill: rgb("#475569"))[#sub]
]
#let g = rgb("#64748b")
#let varr(label) = align(center)[#text(size: 13pt, fill: g)[↓] #text(size: 7.5pt, fill: g)[#label]]
#let harr(label) = align(center + horizon)[#text(size: 7.5pt, fill: g)[#label] \ #text(size: 13pt, fill: g)[→]]
#let blank = []

#align(center)[
  #grid(
    columns: (auto, auto, auto),
    rows: auto,
    align: horizon,
    row-gutter: 4pt,
    column-gutter: 6pt,

    node("git Markdown 위키", "wiki/<project>/*.md · 관계형 DB 없음"), blank, blank,
    varr("파싱"), blank, blank,

    node("FastAPI · BE", "be/point · be/project"),
    harr("camelCase JSON"),
    node("Next.js · FE", "SSG / ISR · 채용자 둘러보기"),

    varr("published load-all"), blank, blank,

    node("be/chat 코퍼스", "load-all + 프롬프트 캐싱", accent: rgb("#7c3aed"), fill: rgb("#f3effc")),
    harr("SSE + Evidence 인용"),
    node("Claude Sonnet 5", "근거기반 답변 · 없으면 거부", accent: rgb("#7c3aed"), fill: rgb("#f3effc")),

    varr("세션"), blank, blank,

    node("Redis", "세션 이력 · TTL 1일 sliding", accent: rgb("#0f766e"), fill: rgb("#e9f5f3")), blank, blank,
  )
]
