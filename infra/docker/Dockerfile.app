# Multi-stage production build for Next.js micro-apps inside pnpm workspaces Monorepo
FROM node:18-alpine AS base
RUN npm install -g pnpm

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps ./apps

# Install dependencies and build target app (inject build argument)
ARG APP_NAME
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @circuitsoul/${APP_NAME} build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

ARG APP_NAME
COPY --from=builder /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=builder /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
