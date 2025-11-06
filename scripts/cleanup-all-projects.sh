#!/usr/bin/env bash
set -euo pipefail

# cleanup-all-projects.sh
# Stops and removes all Supabase project stacks, deletes their folders,
# and purges related records from the local SQLite DB used by supaconsole.
#
# Usage:
#   scripts/cleanup-all-projects.sh [-y] [--projects-dir /abs/path]
#
# Options:
#   -y                Non-interactive mode (skip confirmation prompt)
#   --projects-dir    Override projects directory (default: <repo>/supabase-projects)
#
# Notes:
# - Requires Docker and Docker Compose.
# - DB cleanup runs inside the 'supaconsole' container if it is running.

YES=false
PROJECTS_DIR=""

# Resolve repo root as parent of this script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_PROJECTS_DIR="${REPO_ROOT}/supabase-projects"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)
      YES=true
      shift
      ;;
    --projects-dir)
      PROJECTS_DIR=${2:-}
      if [[ -z "$PROJECTS_DIR" ]]; then
        echo "--projects-dir requires a value" >&2
        exit 1
      fi
      shift 2
      ;;
    -h|--help)
      grep '^#' "$0" | sed -e 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Determine projects dir
if [[ -z "${PROJECTS_DIR}" ]]; then
  PROJECTS_DIR="${DEFAULT_PROJECTS_DIR}"
fi

if [[ ! -d "${PROJECTS_DIR}" ]]; then
  echo "Projects directory not found: ${PROJECTS_DIR} (nothing to clean)"
  exit 0
fi

if [[ "${YES}" != "true" ]]; then
  read -r -p "This will stop and DELETE ALL projects under ${PROJECTS_DIR}. Continue? [y/N] " reply
  case "$reply" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

# Bring down each stack with volumes and orphan removal
shopt -s nullglob
FOUND=0
for d in "${PROJECTS_DIR}"/*/docker; do
  if [[ -f "${d}/docker-compose.yml" ]]; then
    FOUND=1
    echo "Bringing down stack in ${d}"
    (cd "$d" && docker compose down --volumes --remove-orphans || true)
  fi
done

if [[ $FOUND -eq 0 ]]; then
  echo "No docker stacks found under ${PROJECTS_DIR} (continuing)."
fi

# Fallback: stop and remove any lingering project containers even if compose folders are missing
# Matches containers we create: "<slug>-<service>" and "realtime-dev.<slug>-realtime"
echo "Looking for lingering project containers..."
PROJECT_CONTAINERS=$(docker ps -a --format '{{.Names}}' | \
  grep -E '^(realtime-dev\.[a-z0-9-]+-realtime|[a-z0-9-]+-(studio|kong|auth|rest|storage|imgproxy|meta|edge-functions|analytics|db|vector|pooler))$' || true)

if [[ -n "${PROJECT_CONTAINERS}" ]]; then
  echo "Stopping project containers:"
  echo "${PROJECT_CONTAINERS}" | xargs -r docker stop || true
  echo "Removing project containers:"
  echo "${PROJECT_CONTAINERS}" | xargs -r docker rm || true
else
  echo "No lingering project containers found."
fi

# Clean up project networks (named "<slug>_default") and volumes ("<slug>_db-config")
echo "Removing project networks (if any)..."
docker network ls --format '{{.Name}}' | grep -E '^[a-z0-9-]+_default$' | xargs -r docker network rm || true
echo "Removing project volumes (if any)..."
docker volume ls --format '{{.Name}}' | grep -E '^[a-z0-9-]+_db-config$' | xargs -r docker volume rm || true

# Remove project directories
echo "Removing project directories under ${PROJECTS_DIR}"
for p in "${PROJECTS_DIR}"/*; do
  [[ -d "$p" ]] || continue
  echo "Removing ${p}"
  rm -rf "$p"
done

# Clean database records via supaconsole container (best effort)
if docker ps --format '{{.Names}}' | grep -qx 'supaconsole'; then
  echo "Cleaning DB inside 'supaconsole' container..."
  docker exec \
    -e DATABASE_URL=file:/app/data/dev.db \
    supaconsole \
    node -e 'const {PrismaClient}=require("@prisma/client");(async()=>{const p=new PrismaClient();await p.projectEnvVar.deleteMany({});await p.project.deleteMany({});await p.$disconnect();console.log("DB cleaned")})().catch(e=>{console.error(e);process.exit(1)})'
else
  echo "Container 'supaconsole' not running; skipping DB cleanup."
fi

# Final status
echo "--- docker ps (should show only supaconsole) ---"
docker ps --format 'table {{.Names}}\t{{.Status}}'

echo "--- ${PROJECTS_DIR} listing ---"
ls -la "${PROJECTS_DIR}" || true

echo "Cleanup complete."
