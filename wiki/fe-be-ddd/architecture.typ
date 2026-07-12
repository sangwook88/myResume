// FE/BE DDD 기획→구현 프레임워크 — 압축 아키텍처 도식 (도식컴파일 → SVG).
// 외부 패키지 없이 typst 기본 요소(rect·grid)만 사용.
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

    node("Claude Code 번들", "스킬 13종 · 에이전트 4종", accent: rgb("#7c3aed"), fill: rgb("#f3effc")), blank, blank,
    varr("npx 설치 · ${DDD_ROOT} 토큰 치환"), blank, blank,

    node("~/.claude · 프로젝트 .claude", "위치 독립 이식(전역/프로젝트 격리)"), blank, blank,
    varr("기획 파이프라인 8단계"), blank, blank,

    node("대상 프로젝트 마크다운 위키", "HOME 참조 그래프 → FE/BE 도메인 폴더"),
    harr("정합성 검증 · 압축"),
    node("Node 스크립트", "home-check · context-pack"),

    varr("CI 게이트"), blank, blank,

    node("GitHub Actions", "home-check 그래프 정합성 자동 검증", accent: rgb("#0f766e"), fill: rgb("#e9f5f3")), blank, blank,
  )
]
