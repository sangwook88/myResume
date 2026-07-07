// BE(be/point·be/project) fetch 래퍼. 서버 컴포넌트에서만 호출(SSG/ISR).
// 규약: HTTP API로만 소비(ARCHITECTURE §2), 키 케이스 camelCase(§5).
//
// 리다이렉트 계약: 없는/draft 리소스는 BE가 302 → '/' 를 준다(draft 존재 비노출).
// fetch가 302를 자동 추종하면 랜딩 HTML을 JSON으로 오해하므로 redirect:'manual'로
// 받아서 비-2xx면 null 반환 → 페이지가 next/navigation redirect('/')로 처리한다.

import type { Point, PointSummary, ProjectIndex, ProjectSummary } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

// 콘텐츠(위키)는 안정적 → ISR 재검증 주기(초). 저작 반영 지연 허용 범위.
// 단 개발 모드(저작 중)에선 0으로 즉시 반영 — 새 포인트/수정이 새로고침에 바로 보이게.
// 프로덕션(포크 셀프호스팅 빌드)은 300초 ISR 유지.
const REVALIDATE_SECONDS = process.env.NODE_ENV === 'development' ? 0 : 300;

/** 단일 JSON 리소스 조회. 302(없는/draft) 또는 네트워크 실패면 null. */
async function getJson<T>(path: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      redirect: 'manual',
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch {
    // BE 미기동·네트워크 오류: 페이지가 빈 상태/리다이렉트로 처리하도록 null.
    return null;
  }
  // 302 → '/'(없는·비공개) 또는 기타 비정상 응답.
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** 랜딩 추천 포인트 상위 3(featured 우선·동점 최신순). 0개·실패면 []. */
export async function getRecommendedPoints(): Promise<PointSummary[]> {
  return (await getJson<PointSummary[]>('/api/points/recommended')) ?? [];
}

/** 랜딩 프로젝트 카탈로그. 0개·실패면 []. */
export async function getProjects(): Promise<ProjectSummary[]> {
  return (await getJson<ProjectSummary[]>('/api/projects')) ?? [];
}

/** 한 프로젝트의 published 포인트 요약 목록(같은 프로젝트 다른 포인트용). 없으면 []. */
export async function getProjectPoints(slug: string): Promise<PointSummary[]> {
  const path = `/api/points?project=${encodeURIComponent(slug)}`;
  return (await getJson<PointSummary[]>(path)) ?? [];
}

/** 프로젝트 인덱스 단건. 없는 slug면 null(페이지가 '/'로 리다이렉트). */
export async function getProjectIndex(slug: string): Promise<ProjectIndex | null> {
  return getJson<ProjectIndex>(`/api/projects/${encodeURIComponent(slug)}`);
}

/** 포인트 단건. 없거나 draft면 null(페이지가 '/'로 리다이렉트). */
export async function getPoint(id: string): Promise<Point | null> {
  return getJson<Point>(`/api/points/${encodeURIComponent(id)}`);
}
