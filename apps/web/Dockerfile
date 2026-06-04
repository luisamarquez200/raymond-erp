# Dockerfile para la Web (Next.js)
FROM node:20-alpine AS base

# Instalar pnpm
RUN npm install -g pnpm@9.15.4

# Instalar dependencias del sistema
RUN apk add --no-cache libc6-compat openssl curl

FROM base AS deps
WORKDIR /app

# Variables de entorno para mejorar la descarga
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copiar archivos de configuración del monorepo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/hooks/package.json ./packages/hooks/

# Instalar dependencias con retry en caso de error de red
RUN pnpm install --frozen-lockfile --fetch-timeout=600000 || \
    (echo "⚠️ Primera instalación falló, reintentando..." && \
     sleep 5 && \
     pnpm install --frozen-lockfile --fetch-timeout=600000) || \
    (echo "⚠️ Segunda instalación falló, último intento..." && \
     sleep 10 && \
     pnpm install --frozen-lockfile --fetch-timeout=600000)

FROM base AS builder
WORKDIR /app

# Copiar archivos de configuración del monorepo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/hooks/package.json ./packages/hooks/
COPY apps/web/package.json ./apps/web/

# Reinstalar con --shamefully-hoist para crear estructura PLANA (sin symlinks)
# Esto es NECESARIO: los symlinks de pnpm se rompen entre stages Docker
RUN pnpm install --shamefully-hoist --fetch-timeout=600000

# Copiar código fuente
COPY apps/web ./apps/web
COPY packages ./packages
COPY turbo.json tsconfig.json ./

# Variables de entorno para el build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# Verificar que next está disponible antes de buildear
RUN find /app/node_modules/.bin/next /app/apps/web/node_modules/.bin/next -maxdepth 0 2>/dev/null | head -1 | grep -q next && \
    echo "✅ next CLI found" || (echo "❌ next CLI NOT found!" && exit 1)

# Build de Next.js
WORKDIR /app/apps/web
RUN NODE_ENV=production node_modules/.bin/next build

WORKDIR /app

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Crear usuario no root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos de configuración para reinstalar prod deps
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/packages/config/package.json ./packages/config/package.json
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/ui/package.json ./packages/ui/package.json
COPY --from=builder /app/packages/hooks/package.json ./packages/hooks/package.json

# Instalar solo dependencias de producción con estructura plana
RUN pnpm install --prod --shamefully-hoist --fetch-timeout=600000

# Copiar archivos compilados de Next.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/packages ./packages

# Verificar que next está disponible para el start
RUN test -f node_modules/.bin/next && echo "✅ next binary ready" || \
    (echo "❌ next binary NOT found in runner!" && exit 1)

USER nextjs

EXPOSE 8000

ENV PORT=8000
ENV HOSTNAME="0.0.0.0"

CMD ["node_modules/.bin/next", "start", "--port", "8000", "-H", "0.0.0.0"]
