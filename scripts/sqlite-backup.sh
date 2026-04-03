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
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/fcc-$STAMP.db"

sqlite3 "$DATABASE_PATH" ".backup '$BACKUP_FILE'"
echo "SQLite backup complete: $BACKUP_FILE"

REDIS_DATA_DIR="/opt/homebrew/var/db/redis"
REDIS_AOF_DIR="$REDIS_DATA_DIR/appendonlydir"
REDIS_AOF_FILE="$REDIS_DATA_DIR/appendonly.aof"

if [[ -d "$REDIS_AOF_DIR" ]]; then
  REDIS_BACKUP_DIR="$BACKUP_DIR/redis-aof-$STAMP"
  cp -R "$REDIS_AOF_DIR" "$REDIS_BACKUP_DIR"
  echo "Redis AOF backup complete: $REDIS_BACKUP_DIR"
elif [[ -f "$REDIS_AOF_FILE" ]]; then
  REDIS_BACKUP_FILE="$BACKUP_DIR/appendonly-$STAMP.aof"
  cp "$REDIS_AOF_FILE" "$REDIS_BACKUP_FILE"
  echo "Redis AOF backup complete: $REDIS_BACKUP_FILE"
else
  echo "Redis AOF backup skipped: no appendonly files found in $REDIS_DATA_DIR"
fi
