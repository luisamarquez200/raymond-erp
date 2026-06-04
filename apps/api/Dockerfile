# Dockerfile para la API (NestJS)
FROM node:20-alpine AS base

# Instalar pnpm
RUN npm install -g pnpm@9.15.4

# Instalar dependencias del sistema
RUN apk add --no-cache libc6-compat openssl curl

FROM base AS deps
WORKDIR /app

# Variables de entorno para mejorar la descarga de Prisma engines
ENV PRISMA_ENGINES_MIRROR=""
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copiar archivos de configuración del monorepo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/

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

# Copiar archivos de configuración del monorepo (necesarios para el runner)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copiar dependencias
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages

# Copiar código fuente
COPY apps/api ./apps/api
COPY packages ./packages
COPY turbo.json tsconfig.json ./

# Build de la aplicación
WORKDIR /app/apps/api
# Generar todos los clientes de Prisma antes del build (con retry para errores de red)
RUN (npx prisma@5.19.1 generate --schema=./prisma/schema.prisma && \
     npx prisma@5.19.1 generate --schema=./prisma/schemas/taller-r1.prisma && \
     npx prisma@5.19.1 generate --schema=./prisma/schemas/frontera.prisma && \
     npx prisma@5.19.1 generate --schema=./prisma/schemas/naves.prisma && \
     npx prisma@5.19.1 generate --schema=./prisma/schemas/comercial-r4.prisma) || \
    (echo "⚠️ Prisma generate falló, reintentando..." && \
     sleep 5 && \
     npx prisma@5.19.1 generate --schema=./prisma/schema.prisma && \
     npx prisma@5.19.1 generate --schema=./prisma/schemas/taller-r1.prisma && \
     npx prisma@5.19.1 generate --schema=./prisma/schemas/frontera.prisma && \
     npx prisma@5.19.1 generate --schema=./prisma/schemas/naves.prisma && \
     npx prisma@5.19.1 generate --schema=./prisma/schemas/comercial-r4.prisma)
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--openssl-legacy-provider"

# Crear usuario no root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copiar node_modules completo desde builder (ya tiene todos los clientes Prisma generados)
# Esto evita reinstalar y perder los clientes Prisma generados (@prisma/client-comercial, etc.)
COPY --from=builder /app/node_modules ./node_modules

# Copiar archivos de la aplicación compilados
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

# Asegurar permisos correctos sobre todos los clientes Prisma generados
RUN chown -R nestjs:nodejs ./node_modules/@prisma 2>/dev/null || true

# Verificar que todos los clientes Prisma están presentes
RUN echo "📦 Verifying Prisma clients..." && \
    test -d ./node_modules/@prisma/client || (echo "❌ @prisma/client NOT found!" && exit 1) && \
    test -d ./node_modules/@prisma/client-taller-r1 || (echo "❌ @prisma/client-taller-r1 NOT found!" && exit 1) && \
    test -d ./node_modules/@prisma/client-frontera || (echo "❌ @prisma/client-frontera NOT found!" && exit 1) && \
    test -d ./node_modules/@prisma/client-naves || (echo "❌ @prisma/client-naves NOT found!" && exit 1) && \
    test -d ./node_modules/@prisma/client-comercial || (echo "❌ @prisma/client-comercial NOT found!" && exit 1) && \
    echo "✅ All Prisma clients verified"

# Asegurar que NODE_PATH incluya el directorio correcto
ENV NODE_PATH=/app/node_modules

USER nestjs

EXPOSE 8001

# Comando de inicio
CMD ["node", "dist/src/main.js"]

