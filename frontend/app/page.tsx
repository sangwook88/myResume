// fe/browse — 랜딩. 2단 탐색: 좌(추천 포인트 + 프로젝트) / 우(기술 스택 필터 + 챗봇).
// 서버 컴포넌트: be/point·be/project를 fetch(SSG/ISR). 기술 스택은 프로젝트 인덱스에만
// 있어 각 프로젝트 인덱스를 병렬 조회해 모은 뒤, 상호작용(필터)은 LandingExplorer(client)가 맡는다.
import { getProfile, getProjects, getProjectIndex, getRecommendedPoints } from '@/lib/api';
import LandingExplorer, { type LandingProject } from '@/components/LandingExplorer';

export default async function LandingPage() {
  const [recommended, projectSummaries, profile] = await Promise.all([
    getRecommendedPoints(),
    getProjects(),
    getProfile(),
  ]);

  // 프로젝트 인덱스에서 techStack 수집(카탈로그 요약엔 없음). null(비공개)은 제외.
  const indexes = await Promise.all(
    projectSummaries.map((p) => getProjectIndex(p.slug)),
  );
  const projects: LandingProject[] = indexes
    .filter((idx): idx is NonNullable<typeof idx> => idx !== null)
    .map((idx) => ({
      slug: idx.slug,
      name: idx.name,
      summary: idx.summary,
      techStack: idx.techStack,
    }));

  return <LandingExplorer recommended={recommended} projects={projects} profile={profile} />;
}
