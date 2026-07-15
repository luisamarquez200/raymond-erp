#!/bin/sh
set -e

SCHEMA="/app/apps/api/prisma/schema.prisma"
MIGRATIONS_DIR="/app/apps/api/prisma/migrations"
SEED_FILE="/app/apps/api/prisma/seed.ts"
SEED_ADMIN_FILE="/app/apps/api/prisma/seed-admin.ts"

# Use the locally installed prisma binary (avoids npx downloading wrong version)
if [ -f "/app/node_modules/.bin/prisma" ]; then
  PRISMA="/app/node_modules/.bin/prisma"
elif [ -f "/app/apps/api/node_modules/.bin/prisma" ]; then
  PRISMA="/app/apps/api/node_modules/.bin/prisma"
else
  PRISMA="npx prisma@5.19.1"
fi

echo "🔄 Checking database migrations... (using: $PRISMA)"

# Count actual migration directories (not just migration_lock.toml)
MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')

if [ "$MIGRATION_COUNT" -gt "0" ]; then
  echo "📦 Found $MIGRATION_COUNT migration(s) — running prisma migrate deploy..."
  $PRISMA migrate deploy --schema="$SCHEMA"
else
  echo "⚠️  No migration files found — running prisma db push to sync schema..."
  $PRISMA db push --schema="$SCHEMA" --accept-data-loss

  echo "🌱 Running seed to populate initial data..."
  # Check if ts-node is available
  if [ -f "/app/node_modules/.bin/ts-node" ]; then
    TS_NODE="/app/node_modules/.bin/ts-node"
  else
    TS_NODE="npx ts-node@10"
  fi

  # Run main seed (org, roles, users)
  DATABASE_URL="$DATABASE_URL" $TS_NODE --project /app/apps/api/tsconfig.json -e "require('/app/apps/api/prisma/seed.ts')" 2>/dev/null || \
  DATABASE_URL="$DATABASE_URL" node -e "
    const { execSync } = require('child_process');
    try {
      execSync('$TS_NODE /app/apps/api/prisma/seed.ts', { stdio: 'inherit', env: process.env });
    } catch(e) { console.warn('Main seed failed (may already exist):', e.message); }
  " || echo "⚠️  Main seed skipped (may already be seeded)"

  # Run admin seed (comercial users with exact UUIDs)
  DATABASE_URL="$DATABASE_URL" $TS_NODE /app/apps/api/prisma/seed-admin.ts 2>/dev/null || \
  echo "⚠️  Admin seed skipped (may already exist)"
fi

echo "✅ Database ready. Starting server..."
exec node dist/src/main.js
