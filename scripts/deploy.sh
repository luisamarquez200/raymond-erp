#!/bin/bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SERVER="${DEPLOY_SERVER:-root@143.110.229.234}"
REMOTE_DIR="/root/raymond"
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "latest")
BUILD_DATE=$(date +%Y%m%d_%H%M%S)
IMAGE_TAG="${VERSION}-${BUILD_DATE}"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export DOCKER_DEFAULT_PLATFORM=linux/amd64

NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://raymond.runsolutions-services.com/api}"

# ── Parse args ──────────────────────────────────────────────
SKIP_BUILD=false
SKIP_UPLOAD=false
SKIP_DEPLOY=false
FORCE=false

for arg in "$@"; do
    case $arg in
        --skip-build)  SKIP_BUILD=true ;;
        --skip-upload) SKIP_UPLOAD=true ;;
        --skip-deploy) SKIP_DEPLOY=true ;;
        --force)       FORCE=true ;;
        --help|-h)
            echo "Uso: ./deploy.sh [opciones]"
            echo ""
            echo "Opciones:"
            echo "  --skip-build    No construir imágenes (usar las existentes)"
            echo "  --skip-upload   No subir imágenes al servidor"
            echo "  --skip-deploy   No desplegar en servidor (solo subir)"
            echo "  --force         No pedir confirmación"
            echo "  --help          Mostrar esta ayuda"
            exit 0
            ;;
    esac
done

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   DEPLOY RAYMOND ERP                                       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Config:${NC}"
echo "   Servidor:  ${SERVER}"
echo "   Versión:   ${VERSION}"
echo "   Tag:       ${IMAGE_TAG}"
echo "   API URL:   ${NEXT_PUBLIC_API_URL}"
echo ""

# ── Verificaciones ──────────────────────────────────────────
echo -e "${BLUE}🔍 Verificaciones...${NC}"
docker info > /dev/null 2>&1 || { echo -e "${RED}❌ Docker no está corriendo${NC}"; exit 1; }
ssh -o ConnectTimeout=5 ${SERVER} "echo OK" > /dev/null 2>&1 || { echo -e "${RED}❌ Sin conexión SSH${NC}"; exit 1; }
ssh ${SERVER} "docker info" > /dev/null 2>&1 || { echo -e "${RED}❌ Docker no disponible en servidor${NC}"; exit 1; }
echo -e "${GREEN}   ✅ Todo OK${NC}"
echo ""

# ── Build ───────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}🐳 Construyendo imágenes...${NC}"

    echo -e "   📦 raymond-api..."
    docker build \
        --platform linux/amd64 \
        --tag raymond-api:${IMAGE_TAG} \
        --tag raymond-api:latest \
        --file apps/api/Dockerfile \
        --quiet \
        . 2>&1 | tail -5

    echo -e "   📦 raymond-web..."
    docker build \
        --platform linux/amd64 \
        --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" \
        --tag raymond-web:${IMAGE_TAG} \
        --tag raymond-web:latest \
        --file apps/web/Dockerfile \
        --quiet \
        . 2>&1 | tail -5

    echo -e "${GREEN}   ✅ Imágenes construidas${NC}"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "raymond-|REPOSITORY"
    echo ""
fi

# ── Guardar + comprimir ─────────────────────────────────────
echo -e "${BLUE}💾 Guardando imágenes...${NC}"
TEMP_DIR=$(mktemp -d)
docker save raymond-api:${IMAGE_TAG} -o "${TEMP_DIR}/api.tar" &
docker save raymond-web:${IMAGE_TAG} -o "${TEMP_DIR}/web.tar" &
wait

gzip -f "${TEMP_DIR}/api.tar" &
gzip -f "${TEMP_DIR}/web.tar" &
wait

API_SIZE=$(du -h "${TEMP_DIR}/api.tar.gz" | cut -f1)
WEB_SIZE=$(du -h "${TEMP_DIR}/web.tar.gz" | cut -f1)
echo -e "${GREEN}   ✅ API=${API_SIZE}, Web=${WEB_SIZE}${NC}"
echo ""

# ── Subir ───────────────────────────────────────────────────
if [ "$SKIP_UPLOAD" = false ]; then
    echo -e "${BLUE}📤 Subiendo al servidor...${NC}"
    ssh ${SERVER} "mkdir -p ${REMOTE_DIR}/docker-images"
    scp "${TEMP_DIR}/api.tar.gz" ${SERVER}:${REMOTE_DIR}/docker-images/ &
    scp "${TEMP_DIR}/web.tar.gz" ${SERVER}:${REMOTE_DIR}/docker-images/ &
    wait

    echo -e "   📋 Subiendo docker-compose.prod.images.yml..."
    scp docker-compose.prod.images.yml ${SERVER}:${REMOTE_DIR}/
    echo -e "${GREEN}   ✅ Subido${NC}"
    echo ""
fi

rm -rf "${TEMP_DIR}"

# ── Deploy ──────────────────────────────────────────────────
if [ "$SKIP_DEPLOY" = false ]; then
    if [ "$FORCE" = false ]; then
        read -p "¿Desplegar ahora? (y/n) " -n 1 -r
        echo ""
        [[ ! $REPLY =~ ^[Yy]$ ]] && { echo -e "${YELLOW}⚠️  Deploy omitido${NC}"; exit 0; }
    fi

    echo -e "${BLUE}🚀 Desplegando...${NC}"
    ssh ${SERVER} << ENDSSH
set -e
cd ${REMOTE_DIR}

# Cargar imágenes
cd docker-images
gunzip -f api.tar.gz 2>/dev/null || true
gunzip -f web.tar.gz 2>/dev/null || true
docker load -i api.tar
docker load -i web.tar
docker tag raymond-api:${IMAGE_TAG} raymond-api:latest
docker tag raymond-web:${IMAGE_TAG} raymond-web:latest

# Limpiar imágenes antiguas (mantener últimas 2)
docker images --format "{{.Repository}}:{{.Tag}}" | grep "raymond-api:" | grep -v "${IMAGE_TAG}" | grep -v "latest" | tail -n +3 | xargs -r docker rmi 2>/dev/null || true
docker images --format "{{.Repository}}:{{.Tag}}" | grep "raymond-web:" | grep -v "${IMAGE_TAG}" | grep -v "latest" | tail -n +3 | xargs -r docker rmi 2>/dev/null || true
rm -f api.tar web.tar

# Backup BD
cd ${REMOTE_DIR}
if [ -f "./scripts/backup-production-simple.sh" ]; then
    ./scripts/backup-production-simple.sh > /dev/null 2>&1 || true
fi

# Down + migrate + up
docker compose -f docker-compose.prod.images.yml down
docker compose -f docker-compose.prod.images.yml run --rm api npx -y prisma@5.19.1 migrate deploy || echo "⚠️  Migraciones fallaron"
docker compose -f docker-compose.prod.images.yml up -d

sleep 5
docker compose -f docker-compose.prod.images.yml ps
echo "✅ Deploy completado"
ENDSSH

    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   ✅ DEPLOY COMPLETADO                                     ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}⏱️  Tiempo: ~$(($SECONDS / 60)) minutos${NC}"
    echo ""
fi
