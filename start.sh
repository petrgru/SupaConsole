#!/usr/bin/env bash
set -euo pipefail

# Ensure default SQLite DATABASE_URL if not provided
if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="file:/app/data/dev.db"
fi

# Initialize supabase-core if empty or missing
if [ ! -d "/app/supabase-core" ] || [ -z "$(ls -A /app/supabase-core 2>/dev/null)" ]; then
  echo "📦 Initializing supabase-core..."
  mkdir -p /app/supabase-core
  REPO_URL="${SUPABASE_CORE_REPO_URL:-https://github.com/supabase/supabase}"
  echo "   Cloning from: $REPO_URL"
  git clone --depth 1 "$REPO_URL" /app/supabase-core || {
    echo "⚠️  Failed to clone supabase repo. Continuing without it."
  }
fi

# Ensure supabase-projects directory exists
mkdir -p /app/supabase-projects

# Migraciones Prisma si existen (SQLite/Postgres)
if [ -x "./node_modules/.bin/prisma" ]; then
  npx prisma migrate deploy || true
  npx prisma db push || true
fi

# Mostrar info de docker (verificación de acceso al daemon del host)
if command -v docker >/dev/null 2>&1; then
  echo "Docker CLI:"
  docker --version || true
  docker compose version || true
fi

# Arrancar Next.js
npm run start