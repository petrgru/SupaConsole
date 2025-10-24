#!/usr/bin/env bash
set -euo pipefail

# Migraciones Prisma si existen (SQLite/Postgres)
if [ -x "./node_modules/.bin/prisma" ]; then
  npx prisma migrate deploy || npx prisma db push || true
fi

# Mostrar info de docker (verificación de acceso al daemon del host)
if command -v docker >/dev/null 2>&1; then
  echo "Docker CLI:"
  docker --version || true
  docker compose version || true
fi

# Arrancar Next.js
npm run start