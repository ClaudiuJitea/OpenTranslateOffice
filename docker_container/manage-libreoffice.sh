#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/libreoffice-compose.yml"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOST_STORAGE_PATH="${LIBREOFFICE_HOST_STORAGE_PATH:-$PROJECT_DIR/apps/api/storage}"

usage() {
  cat <<USAGE
Usage: ./docker_container/manage-libreoffice.sh <command>

Commands:
  deploy    Build and start LibreOffice container
  restart   Restart LibreOffice container
  stop      Stop LibreOffice container
  delete    Delete LibreOffice container and local image cache
  status    Show container status
  logs      Tail container logs
USAGE
}

ensure_storage_dirs() {
  mkdir -p "$HOST_STORAGE_PATH/intake-uploads" "$HOST_STORAGE_PATH/derived-previews"
}

run_compose() {
  LIBREOFFICE_HOST_STORAGE_PATH="$HOST_STORAGE_PATH" docker compose -f "$COMPOSE_FILE" "$@"
}

if [[ "${1:-}" == "" ]]; then
  usage
  exit 1
fi

case "$1" in
  deploy)
    ensure_storage_dirs
    run_compose up -d --build
    run_compose ps
    ;;
  restart)
    run_compose restart libreoffice
    run_compose ps
    ;;
  stop)
    run_compose stop libreoffice
    run_compose ps
    ;;
  delete)
    run_compose down --rmi local --remove-orphans
    ;;
  status)
    run_compose ps
    ;;
  logs)
    run_compose logs -f libreoffice
    ;;
  *)
    usage
    exit 1
    ;;
esac
