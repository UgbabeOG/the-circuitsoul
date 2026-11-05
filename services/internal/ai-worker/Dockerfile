FROM node:20-alpine AS base
WORKDIR /app

RUN corepack enable && npm install -g pnpm@12.14.0

COPY package.json pnpm-lock.yaml ./
COPY services/internal/ai-worker/package.json ./services/internal/ai-worker/package.json
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=base /app /app
RUN pnpm --filter @circuitsoul/ai-worker build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

EXPOSE 3000
CMD ["node", "services/internal/ai-worker/dist/index.js"]
