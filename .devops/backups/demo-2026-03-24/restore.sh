#!/bin/bash
# Restore demo backup from 2026-03-24
# Usage: bash restore.sh (from this directory, with docker compose services running)

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Restoring Postgres ==="
docker exec -i coop-postgres-1 psql -U postgres -d postgres < "$DIR/postgres.sql"

echo "=== Restoring Redis ==="
docker cp "$DIR/redis.rdb" coop-redis-1:/data/dump.rdb
docker compose restart redis

echo "=== Restoring ClickHouse ==="
for f in "$DIR"/clickhouse_*.jsonl; do
  table=$(basename "$f" .jsonl | sed 's/^clickhouse_//')
  if [ -s "$f" ]; then
    echo "  Loading $table..."
    cat "$f" | docker exec -i clickhouse clickhouse-client --user default --password clickhouse --query "INSERT INTO analytics.$table FORMAT JSONEachRow"
  fi
done

echo "=== Done ==="
echo "Restart the server to pick up restored sessions."
