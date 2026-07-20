# Dockerfile para la API (NestJS)
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4
RUN apk add --no-cache libc6-compat openssl curl

FROM base AS deps
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --fetch-timeout=600000 || \
    (sleep 5 && pnpm install --frozen-lockfile --fetch-timeout=600000)

FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages
COPY apps/api ./apps/api
COPY packages ./packages
COPY turbo.json tsconfig.json ./

WORKDIR /app/apps/api
RUN npx prisma@5.19.1 generate --schema=./prisma/schema.prisma && \
    npx prisma@5.19.1 generate --schema=./prisma/schemas/taller-r1.prisma && \
    npx prisma@5.19.1 generate --schema=./prisma/schemas/frontera.prisma && \
    npx prisma@5.19.1 generate --schema=./prisma/schemas/naves.prisma && \
    pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--openssl-legacy-provider"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nestjs:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

RUN pnpm install --prod --shamefully-hoist --fetch-timeout=600000

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma

RUN pnpm add -D -w prisma@5.19.1 --fetch-timeout=600000 && \
    npx prisma@5.19.1 generate --schema=./apps/api/prisma/schema.prisma && \
    npx prisma@5.19.1 generate --schema=./apps/api/prisma/schemas/taller-r1.prisma && \
    npx prisma@5.19.1 generate --schema=./apps/api/prisma/schemas/frontera.prisma && \
    npx prisma@5.19.1 generate --schema=./apps/api/prisma/schemas/naves.prisma

RUN chown -R nestjs:nodejs ./node_modules/@prisma 2>/dev/null || true

ENV NODE_PATH=/app/node_modules
USER nestjs
EXPOSE 8001
CMD ["node", "dist/src/main.js"]
