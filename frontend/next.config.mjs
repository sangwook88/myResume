/** @type {import('next').NextConfig} */
const nextConfig = {
  // BE(FastAPI)는 별도 오리진. 페이지는 서버 컴포넌트에서 NEXT_PUBLIC_API_BASE로 직접 fetch(SSG/ISR).
  reactStrictMode: true,
};

export default nextConfig;
