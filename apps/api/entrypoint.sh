#!/bin/sh
set -e

SCHEMA="/app/apps/api/prisma/schema.prisma"
MIGRATIONS_DIR="/app/apps/api/prisma/migrations"

echo "🔄 Checking database migrations..."

# Count actual migration directories (not just migration_lock.toml)
MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')

if [ "$MIGRATION_COUNT" -gt "0" ]; then
  echo "📦 Found $MIGRATION_COUNT migration(s) — running prisma migrate deploy..."
  npx prisma migrate deploy --schema="$SCHEMA"
else
  echo "⚠️  No migration files found — running prisma db push to sync schema..."
  npx prisma db push --schema="$SCHEMA" --accept-data-loss
fi

echo "✅ Database ready. Starting server..."
exec node dist/src/main.js
