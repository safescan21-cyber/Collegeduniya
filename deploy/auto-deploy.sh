#!/usr/bin/env bash
# Auto-deploy: run by cron every 3 minutes. When GitHub has new commits on the branch, it updates the code,
# reinstalls packages only if they changed, rebuilds the website only if web/ changed, and restarts what changed.
# Install once:  bash /var/www/collegeolo/deploy/auto-deploy.sh --install
# Log:           tail -f /root/collegeolo-deploy.log
set -uo pipefail
APP=/var/www/collegeolo
BRANCH=feature/growth-features
LOG=/root/collegeolo-deploy.log
LOCK=/tmp/collegeolo-deploy.lock

if [ "${1:-}" = "--install" ]; then
  ( crontab -l 2>/dev/null | grep -v 'collegeolo/deploy/auto-deploy.sh'; echo "*/3 * * * * /bin/bash $APP/deploy/auto-deploy.sh >> $LOG 2>&1" ) | crontab -
  echo "Auto-deploy installed (every 3 minutes). Log: $LOG"
  exit 0
fi

exec 9>"$LOCK"; flock -n 9 || exit 0
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
export HOME=/root
cd "$APP" || exit 1
git fetch -q origin "$BRANCH" || exit 0
OLD=$(git rev-parse HEAD); NEW=$(git rev-parse "origin/$BRANCH")
[ "$OLD" = "$NEW" ] && exit 0

# very busy server (more than 3 jobs waiting per CPU): wait for a calmer moment, but never more than 30 minutes
CPUS=$(nproc 2>/dev/null || echo 2); LOAD=$(cut -d' ' -f1 /proc/loadavg)
WAIT=/tmp/collegeolo-deploy.waiting
if awk -v l="$LOAD" -v c="$CPUS" 'BEGIN{exit !(l > 3*c)}'; then
  [ -f "$WAIT" ] || date +%s > "$WAIT"
  if [ $(( $(date +%s) - $(cat "$WAIT") )) -lt 1800 ]; then echo "$(date '+%F %T') server busy (load $LOAD) — deploy postponed"; exit 0; fi
fi
rm -f "$WAIT"

echo "== $(date '+%F %T') deploying ${OLD:0:7} -> ${NEW:0:7}"
CHANGED=$(git diff --name-only "$OLD" "$NEW")
git merge -q --ff-only "origin/$BRANCH" || { echo "cannot fast-forward — local changes on the server?"; exit 1; }

# new/changed database migrations first (they are written to be safe to re-run), so code never runs ahead of the schema
MIGS=$(echo "$CHANGED" | grep -E '^supabase/migrations/[^/]+\.sql$' | sort || true)
if [ -n "$MIGS" ]; then
  EXIST=""; for m in $MIGS; do [ -f "$m" ] && EXIST="$EXIST $m"; done
  if [ -n "$EXIST" ]; then
    if bash deploy/db-migrate.sh $EXIST; then echo "migrations applied:$EXIST"; else echo "MIGRATION FAILED:$EXIST — fix and run deploy/db-migrate.sh by hand"; fi
  fi
fi
if echo "$CHANGED" | grep -q '^server/'; then
  echo "$CHANGED" | grep -q '^server/package' && (cd server && npm ci --omit=dev --no-audit --no-fund)
  pm2 restart collegeolo-api --update-env > /dev/null && echo "api restarted"
fi
if echo "$CHANGED" | grep -q '^web/'; then
  echo "$CHANGED" | grep -q '^web/package' && (cd web && npm ci --no-audit --no-fund)
  # builds next to the live site and switches over with no downtime (no more 404s for /_next/static/chunks/…)
  bash deploy/build-web.sh
fi
# web server tuning for heavy traffic (deploy/nginx/) — applied only if nginx accepts it, otherwise rolled back
if echo "$CHANGED" | grep -q '^deploy/nginx/'; then bash deploy/nginx/apply.sh; fi
echo "== done"
