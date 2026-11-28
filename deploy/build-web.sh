#!/usr/bin/env bash
# Safe website rebuild — the live site is never touched while building.
#
# Why: building straight into web/.next while `next start` serves visitors deletes the JavaScript files that
# already-open pages point to (→ "GET /_next/static/chunks/….js 404", buttons and login stop working), and a
# full-speed build on a 2-CPU server makes every page slow.
#
# How: the site alternates between two build folders, web/.next-a and web/.next-b.
#   1. build into the folder that is NOT live, at the lowest CPU/disk priority
#   2. copy the previous build's static files into the new one, so pages opened before the switch keep working
#   3. switch PM2 to the new folder with a zero-downtime reload, then check the site answers; if it does not,
#      switch back to the old folder.
# Usage: bash deploy/build-web.sh          (used by auto-deploy.sh and supabase-selfhost.sh)
set -uo pipefail
APP=${APP:-/var/www/collegeolo}
LOG=${BUILD_LOG:-/root/collegeolo-build.log}
NAME=collegeolo-web
PORT=3310
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
cd "$APP/web" || exit 1

# which folder is live now (stored in PM2's environment for the website)
ACTIVE=$(pm2 jlist 2>/dev/null | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const p=JSON.parse(s).find(x=>x.name==="'"$NAME"'");
  const e=p&&p.pm2_env||{};process.stdout.write((e.env&&e.env.NEXT_DIST_DIR)||e.NEXT_DIST_DIR||".next")}catch{process.stdout.write(".next")}})')
[ -z "$ACTIVE" ] && ACTIVE=.next
if [ "$ACTIVE" = ".next-a" ]; then TARGET=.next-b; else TARGET=.next-a; fi
echo "website build: live=$ACTIVE → building $TARGET"

# lowest priority: visitors' pages are served first, the build uses whatever CPU is left
NICE="nice -n 19"; command -v ionice >/dev/null && NICE="$NICE ionice -c3"
if ! NEXT_DIST_DIR=$TARGET NODE_OPTIONS=--max-old-space-size=2048 NEXT_TELEMETRY_DISABLED=1 $NICE npm run build > "$LOG" 2>&1; then
  echo "WEB BUILD FAILED — site keeps running the previous version. See $LOG"
  exit 1
fi

# keep the previous version's JS/CSS available for pages that were opened before the switch
if [ -d "$ACTIVE/static" ] && [ -d "$TARGET/static" ]; then cp -rn "$ACTIVE/static/." "$TARGET/static/" 2>/dev/null || true; fi

start_cluster() {   # first time: run the website as 2 processes (one per CPU) so a slow page never blocks the others
  pm2 delete "$NAME" > /dev/null 2>&1
  env -i PATH="$PATH" HOME="$HOME" NEXT_DIST_DIR="$1" NODE_ENV=production \
    pm2 start node_modules/next/dist/bin/next --name "$NAME" --cwd "$APP/web" -i "${WEB_INSTANCES:-2}" \
      --max-memory-restart "${WEB_MAX_MEMORY:-900M}" -- start -p $PORT -H 127.0.0.1 > /dev/null
}
switch_to() {
  local mode; mode=$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const p=JSON.parse(s).find(x=>x.name==="'"$NAME"'");process.stdout.write(p?p.pm2_env.exec_mode:"none")}catch{process.stdout.write("none")}})')
  if [ "$mode" = "cluster_mode" ]; then
    env -i PATH="$PATH" HOME="$HOME" NEXT_DIST_DIR="$1" NODE_ENV=production pm2 reload "$NAME" --update-env > /dev/null
  else
    start_cluster "$1"
  fi
}
site_ok() {
  for i in $(seq 1 30); do
    sleep 2
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://127.0.0.1:$PORT/") || code=000
    if [ "$code" = "200" ]; then
      # also make sure the page's own scripts exist (the exact problem this script prevents)
      chunk=$(curl -s --max-time 20 "http://127.0.0.1:$PORT/" | grep -o '/_next/static/[^"]*\.js' | head -1)
      [ -z "$chunk" ] && return 0
      [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://127.0.0.1:$PORT$chunk")" = "200" ] && return 0
    fi
  done
  return 1
}

switch_to "$TARGET"
if site_ok; then
  pm2 save > /dev/null 2>&1
  echo "web rebuilt and switched to $TARGET (zero downtime)"
  exit 0
fi
echo "NEW BUILD DID NOT ANSWER — switching back to $ACTIVE"
if [ -d "$ACTIVE" ]; then switch_to "$ACTIVE"; site_ok && pm2 save > /dev/null 2>&1; fi
exit 1
