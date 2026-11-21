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

echo "== $(date '+%F %T') deploying ${OLD:0:7} -> ${NEW:0:7}"
CHANGED=$(git diff --name-only "$OLD" "$NEW")
git merge -q --ff-only "origin/$BRANCH" || { echo "cannot fast-forward — local changes on the server?"; exit 1; }

if echo "$CHANGED" | grep -q '^server/'; then
  echo "$CHANGED" | grep -q '^server/package' && (cd server && npm ci --omit=dev --no-audit --no-fund)
  pm2 restart collegeolo-api --update-env > /dev/null && echo "api restarted"
fi
if echo "$CHANGED" | grep -q '^web/'; then
  echo "$CHANGED" | grep -q '^web/package' && (cd web && npm ci --no-audit --no-fund)
  if (cd web && NODE_OPTIONS=--max-old-space-size=2048 npm run build > /root/collegeolo-build.log 2>&1); then
    pm2 restart collegeolo-web > /dev/null && echo "web rebuilt and restarted"
  else
    echo "WEB BUILD FAILED — site keeps running the previous version. See /root/collegeolo-build.log"
  fi
fi
echo "$CHANGED" | grep -q '^supabase/migrations/' && echo "NOTE: new database migration in this update — apply it with deploy/db-migrate.sh"
echo "== done"
