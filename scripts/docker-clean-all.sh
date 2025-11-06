#!/usr/bin/env bash

# Ensure we are running under bash (not sh)
if [ -z "${BASH_VERSION:-}" ]; then
  echo "ERROR: This script requires bash. Please run it as:" >&2
  echo "  bash $0 [options]" >&2
  exit 2
fi

set -euo pipefail

# docker-clean-all.sh
# Force-clean Docker on this host:
# - Stops and removes ALL containers (optionally keeping selected)
# - Removes ALL images (unused and used ones after containers are removed)
# - Prunes ALL networks (except default: bridge, host, none)
# - Prunes ALL volumes
# - Prunes ALL builder cache
#
# Usage:
#   scripts/docker-clean-all.sh [-y] [--keep NAME]...
#
# Options:
#   -y, --yes        Non-interactive (skip confirmation)
#   --keep NAME      Keep container NAME (repeatable). Matching names won't be stopped/removed.
#
# Examples:
#   scripts/docker-clean-all.sh              # interactive prompt
#   scripts/docker-clean-all.sh -y           # clean without prompt
#   scripts/docker-clean-all.sh -y --keep supaconsole
#
# Notes:
# - Requires Docker CLI on PATH and permission to talk to the daemon.
# - This is destructive. Make sure you really want to wipe local Docker state.

YES=false
KEEP_CONTAINERS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)
      YES=true
      shift
      ;;
    --keep)
      if [[ $# -lt 2 ]]; then
        echo "--keep expects a container name" >&2
        exit 1
      fi
      KEEP_CONTAINERS+=("$2")
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

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI not found on PATH" >&2
  exit 1
fi

if [[ "$YES" != "true" ]]; then
  echo "This will DELETE ALL Docker containers, images, volumes, networks, and build cache on this machine."
  if ((${#KEEP_CONTAINERS[@]})); then
    echo "Containers to keep: ${KEEP_CONTAINERS[*]}"
  fi
  read -r -p "Continue? [y/N] " reply
  case "$reply" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

# 1) Stop and remove containers (excluding kept ones)
ALL_CONTAINERS=$(docker ps -aq || true)
if [[ -n "$ALL_CONTAINERS" ]]; then
  echo "Stopping all containers..."
  # Compute containers to stop/remove (exclude kept)
  TO_HANDLE=()
  while IFS= read -r cid; do
    [[ -z "$cid" ]] && continue
    cname=$(docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's#^/##') || cname=""
    skip=false
    for k in "${KEEP_CONTAINERS[@]:-}"; do
      if [[ "$cname" == "$k" ]]; then
        skip=true; break
      fi
    done
    if [[ "$skip" == false ]]; then
      TO_HANDLE+=("$cid")
    fi
  done < <(printf '%s\n' $ALL_CONTAINERS)

  if ((${#TO_HANDLE[@]})); then
    docker stop "${TO_HANDLE[@]}" || true
    echo "Removing containers..."
    docker rm -f "${TO_HANDLE[@]}" || true
  else
    echo "Nothing to stop/remove (all kept)."
  fi
else
  echo "No containers to stop."
fi

# 2) Remove non-default networks
echo "Pruning custom networks..."
DEFAULT_NETS='^(bridge|host|none)$'
NON_DEFAULT_NETS=$(docker network ls --format '{{.Name}}' | grep -Ev "$DEFAULT_NETS" || true)
if [[ -n "$NON_DEFAULT_NETS" ]]; then
  echo "$NON_DEFAULT_NETS" | xargs -r docker network rm || true
else
  echo "No custom networks found."
fi

# 3) Prune volumes
echo "Pruning volumes..."
(docker volume prune -f || true) >/dev/null

# 4) Remove images (after containers are gone), then prune system
echo "Removing all images..."
IMAGES=$(docker images -aq || true)
if [[ -n "$IMAGES" ]]; then
  docker rmi -f $IMAGES || true
else
  echo "No images to remove."
fi

# 5) Prune builder cache and general system
echo "Pruning builder cache..."
(docker builder prune -a -f || true) >/dev/null

echo "Pruning system (networks, images, cache)..."
(docker system prune -a -f || true) >/dev/null

# Final status
echo "--- docker system df ---"
docker system df || true

echo "--- docker ps ---"
docker ps --format 'table {{.Names}}\t{{.Status}}' || true

echo "Docker cleanup complete."
