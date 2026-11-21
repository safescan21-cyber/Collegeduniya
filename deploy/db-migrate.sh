#!/usr/bin/env bash
# Applies one or more SQL migration files to Collegeolo's self-hosted database.
#   bash /var/www/collegeolo/deploy/db-migrate.sh supabase/migrations/024_something.sql
set -euo pipefail
cd /opt/collegeolo-supabase
set -a; . ./.env; set +a
DB=$(docker compose ps -q db)
for f in "$@"; do
  p=$f; [ -f "$p" ] || p=/var/www/collegeolo/$f
  echo "applying $p"
  docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$DB" psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$p"
done
docker compose restart rest > /dev/null && echo "done (API schema reloaded)"
