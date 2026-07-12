# 근거기반 포트폴리오 FE — Next.js standalone 멀티스테이지.
# 브라우저는 동일 오리진 상대경로(/api)로 BE 를 부르고(NEXT_PUBLIC_API_BASE 미설정 → ""),
# 서버 컴포넌트는 런타임 env API_INTERNAL_BASE(=http://backend:8000)로 부른다.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# standalone 산출물 + 정적 자산만 복사(node_modules 통째 불필요).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
