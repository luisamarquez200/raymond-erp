#!/bin/sh
set -e

SCHEMA="/app/apps/api/prisma/schema.prisma"
MIGRATIONS_DIR="/app/apps/api/prisma/migrations"

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
fi

echo "✅ Database ready. Starting server..."
exec node dist/src/main.js
