#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

set -a
. ./.env
set +a

if [[ -z "${DATABASE_PATH:-}" ]]; then
  echo "DATABASE_PATH is missing in .env"
  exit 1
fi

BACKUP_DIR="$PROJECT_ROOT/data/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/fcc-$(date +%Y%m%d-%H%M%S).db"

sqlite3 "$DATABASE_PATH" ".backup '$BACKUP_FILE'"
echo "SQLite backup complete: $BACKUP_FILE"
