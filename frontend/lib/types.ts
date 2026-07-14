// BE(be/point·be/project) REST 응답 DTO — camelCase (ARCHITECTURE §5).
// 계약 근거: backend/app/point/models.py · backend/app/project/models.py.
// FE는 이 타입으로만 소비한다(HTTP fetch). 필드 추가·변경은 BE 계약 변경 사안.

/** 랜딩 헤더와 관리자 편집에서 공유하는 단일 프로필. */
export interface Profile {
  name: string;
  headline: string;
  photo: string | null;
  github: string;
  phone: string;
  email: string;
  /** 짧은 자기소개 마크다운. */
  intro: string;
}

/** 근거 링크 1건. 포인트당 1개 이상 보장(발행 게이트). */
export interface Evidence {
  /** commit | pr | swagger | file | link */
  kind: string;
  label: string;
  url: string;
}

/** '고려한 옵션' 표의 한 행(옵션·장점·단점·비용/리스크·채택). 필드는 생략될 수 있다. */
export interface Option {
  option?: string;
  pros?: string;
  cons?: string;
  cost?: string;
  /** 채택 여부·표시값(예 "●"·"채택"). 비면 미채택. */
  adopted?: string;
}

/**
 * 9섹션 중 제목·요약(=PointSummary+summary)을 뺀 나머지 본문.
 * 선택 섹션(배경·옵션·실행·결과·회고)은 비면 응답에서 생략된다(response_model_exclude_none).
 */
export interface Sections {
  background?: string;
  problem?: string;
  options?: Option[];
  decision?: string;
  execution?: string;
  result?: string;
  retrospective?: string;
}

/** 목록·추천용 요약 카드. summary=목록에서 '어떤 포인트인지' 한 줄 설명(published 보장). */
export interface PointSummary {
  id: string;
  title: string;
  tags: string[];
  /** 소속 프로젝트 slug. */
  project: string;
  summary: string;
}

/** 포인트 단건 전체: 요약(PointSummary) + 9섹션 본문 + Evidence. */
export interface Point extends PointSummary {
  sections: Sections;
  evidence: Evidence[];
}

/** 랜딩 카탈로그용 프로젝트 요약. */
export interface ProjectSummary {
  slug: string;
  /** 사람이 읽는 표시 이름(없으면 slug 폴백). */
  name: string;
  summary: string;
}

/** 프로젝트 인덱스 본체: 표지 6요소 + 파생 포인트 목록(published). */
export interface ProjectIndex extends ProjectSummary {
  role: string;
  period: string;
  teamSize: string;
  techStack: string[];
  architecture: string;
  /** 압축 아키텍처 도식(컴파일된 SVG)을 내보내는 API 경로. 없으면 null(도식 optional, v4). */
  architectureDiagram?: string | null;
  highlights: string[];
  points: PointSummary[];
}
