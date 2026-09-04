/** @type {import('next').NextConfig} */

// 배포 대상에 따라 두 가지 모드로 동작한다.
//
// 1) 셀프호스팅(docker compose + Caddy) — 기본.
//    Caddy 가 /api/* 를 backend 로 프록시하므로 Next 쪽 rewrite 는 불필요하고,
//    런타임 이미지를 줄이려고 standalone 출력을 쓴다.
//
// 2) 서버리스(Vercel + Lambda) — BACKEND_ORIGIN 이 있을 때.
//    Caddy 가 없으므로 Next 가 /api/* 를 Lambda 로 rewrite 해 **단일 오리진**을 유지한다.
//    브라우저는 Vercel 오리진만 보므로 챗봇 세션 쿠키(SameSite=Lax)가 first-party 로 남는다.
//    Vercel 은 자체 빌드 파이프라인을 쓰므로 standalone 출력을 끈다.
const backendOrigin = process.env.BACKEND_ORIGIN?.replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  ...(backendOrigin ? {} : { output: 'standalone' }),
  async rewrites() {
    if (!backendOrigin) return [];
    return [{ source: '/api/:path*', destination: `${backendOrigin}/api/:path*` }];
  },
};

export default nextConfig;
