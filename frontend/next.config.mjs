/** @type {import('next').NextConfig} */
const nextConfig = {
  // BE(FastAPI)는 별도 오리진. 페이지는 서버 컴포넌트에서 API_INTERNAL_BASE/NEXT_PUBLIC_API_BASE로 직접 fetch(SSG/ISR).
  reactStrictMode: true,
  // 컨테이너 런타임 이미지 최소화 — .next/standalone 자립 서버(node server.js)로 빌드.
  output: 'standalone',
};

export default nextConfig;
