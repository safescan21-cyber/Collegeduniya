#!/usr/bin/env bash
# Collegeolo's own self-hosted Supabase, separate from any other Supabase on this server.
#   folder:     /opt/collegeolo-supabase   (copied from the Supabase docker setup in /opt/supabase, without its data)
#   containers: colsb-*                    (compose project "collegeolo-supabase")
#   ports:      127.0.0.1:8110 API gateway, 127.0.0.1:54332 / 54339 Postgres pooler (local only)
#   public URL: https://db.collegeolo.com  (Nginx + Let's Encrypt)
# New secrets are generated on the server and never printed. Safe to re-run: it only does what is missing.
set -euo pipefail
SRC=/opt/supabase
DST=/opt/collegeolo-supabase
APP=/var/www/collegeolo
DOMAIN=db.collegeolo.com
say() { echo; echo "== $*"; }

# ---------------------------------------------------------------- 1. folder + config
if [ ! -f "$DST/.env" ]; then
  say "Creating $DST"
  mkdir -p "$DST"
  (cd "$SRC" && tar --exclude='./volumes/db/data' --exclude='./volumes/storage' --exclude='./volumes/functions' \
      --exclude='./.env' --exclude='./.env.old' --exclude='./docker-compose.yml.old' --exclude='./docker-compose.pcbdukaan.yml' \
      -cf - .) | tar -xf - -C "$DST"
  mkdir -p "$DST/volumes/functions/main" "$DST/volumes/storage"
  cd "$DST"
  cp .env.example .env
  sh utils/generate-keys.sh --update-env > /dev/null 2>&1
  rm -f .env.old
  COMPOSE_FILES=$(grep '^COMPOSE_FILE=' "$SRC/.env" | cut -d= -f2- | sed 's/:docker-compose.pcbdukaan.yml//')
  set_env() { if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
  set_env COMPOSE_FILE "${COMPOSE_FILES:-docker-compose.yml}"
  set_env COMPOSE_PROJECT_NAME collegeolo-supabase
  set_env SUPABASE_PUBLIC_URL "https://$DOMAIN"
  set_env API_EXTERNAL_URL "https://$DOMAIN/auth/v1"
  set_env SITE_URL "https://www.collegeolo.com"
  set_env ADDITIONAL_REDIRECT_URLS "https://www.collegeolo.com/**,https://collegeolo.com/**"
  set_env ENABLE_EMAIL_AUTOCONFIRM true
  set_env POOLER_TENANT_ID collegeolo
  set_env DASHBOARD_USERNAME collegeolo
  set_env STUDIO_DEFAULT_ORGANIZATION Collegeolo
  set_env STUDIO_DEFAULT_PROJECT Collegeolo
  set_env API_GW_HTTP_PORT 8110
  set_env KONG_HTTP_PORT 8110
  chmod 600 .env

  # unique container names, local-only ports
  python3 - <<'PY'
import re, pathlib
root = pathlib.Path('/opt/collegeolo-supabase')
for f in [root / n for n in ('docker-compose.yml',)] + [p for p in (root / 'volumes' / 'api').rglob('*') if p.is_file()]:
    s = f.read_text()
    t = s.replace('realtime-dev.supabase-realtime', 'realtime-dev.colsb-realtime')
    t = re.sub(r'container_name:\s*supabase-', 'container_name: colsb-', t)
    if f.name == 'docker-compose.yml':
        t = re.sub(r'(?m)^(\s*-\s*)["\']?[^\s"\']*:8000(/tcp)?["\']?\s*$', r'\g<1>127.0.0.1:8110:8000/tcp', t)
        t = re.sub(r'(?m)^(\s*-\s*)["\']?[^\s"\']*:5432["\']?\s*$', r'\g<1>127.0.0.1:54332:5432', t)
        t = re.sub(r'(?m)^(\s*-\s*)["\']?[^\s"\']*:6543["\']?\s*$', r'\g<1>127.0.0.1:54339:6543', t)
        t = re.sub(r'(?m)^(\s*-\s*)["\']?[^\s"\']*:8443(/tcp)?["\']?\s*$', r'\g<1>127.0.0.1:8453:8443/tcp', t)
    if t != s:
        f.write_text(t)
PY
  # other compose files listed in COMPOSE_FILE (e.g. pg17) get the same renames
  for f in $(echo "${COMPOSE_FILES:-}" | tr ':' ' '); do
    [ "$f" = docker-compose.yml ] || [ ! -f "$f" ] || sed -i 's/container_name: *supabase-/container_name: colsb-/; s/realtime-dev\.supabase-realtime/realtime-dev.colsb-realtime/g' "$f"
  done
fi
cd "$DST"
set -a; . ./.env; set +a

# ---------------------------------------------------------------- 2. start (no edge functions / log analytics: not used)
say "Starting Collegeolo Supabase"
SERVICES=$(docker compose config --services | grep -vE '^(functions|analytics|vector)$' | tr '\n' ' ')
docker compose up -d $SERVICES
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" "http://127.0.0.1:8110/rest/v1/" || true)
  st=$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" "http://127.0.0.1:8110/storage/v1/bucket" || true)
  [ "$code" = 200 ] && [ "$st" = 200 ] && break
  sleep 5
done
echo "REST: $code  Storage: $st"
[ "$code" = 200 ] || { docker compose ps; echo "Supabase did not come up"; exit 1; }

# ---------------------------------------------------------------- 3. Collegeolo tables (only once)
DB=$(docker compose ps -q db)
psql_app() { docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$DB" psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
if [ "$(psql_app -tAc "select to_regclass('public.colleges') is not null")" != t ]; then
  say "Creating Collegeolo tables"
  cd "$APP" && git pull -q --ff-only || true
  for f in schema.sql migrations/002_growth.sql migrations/003_global.sql migrations/004_visibility_import.sql \
           migrations/005_wiki_enrich.sql migrations/006_management_quota.sql migrations/007_quota_global.sql \
           migrations/008_cities_languages.sql migrations/009_security_hardening.sql migrations/010_roadmap.sql \
           migrations/010_seed_exams.sql migrations/011_growth2.sql migrations/011b_growth2_grants.sql \
           $(ls supabase/migrations | grep -E '^0(1[2-9]|[2-9][0-9])_' | sed 's|^|migrations/|'); do
    echo "   $f"
    psql_app < "$APP/supabase/$f" > /dev/null
  done
  cd "$DST"
  docker compose restart rest > /dev/null   # reload the API schema
  sleep 5
fi

# ---------------------------------------------------------------- 4. public address
if [ ! -f /etc/nginx/sites-available/collegeolo-db ]; then
  say "Nginx for $DOMAIN"
  cat > /etc/nginx/sites-available/collegeolo-db <<NGINX
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN;
  client_max_body_size 60M;
  location / {
    proxy_pass http://127.0.0.1:8110;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 3600s;
  }
}
NGINX
  ln -sf /etc/nginx/sites-available/collegeolo-db /etc/nginx/sites-enabled/collegeolo-db
  nginx -t && systemctl reload nginx
fi
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  if getent hosts "$DOMAIN" | grep -q .; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect > /dev/null && echo "SSL ok for $DOMAIN"
  else
    echo "DNS for $DOMAIN not found yet — add an A record, then re-run this script"; exit 1
  fi
fi

# ---------------------------------------------------------------- 5. point the website and API at it
say "Switching Collegeolo to its own Supabase"
cd "$APP"
sed -i "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=https://$DOMAIN|; s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY|" web/.env.local
sed -i '/^SUPABASE_URL=/d; /^SUPABASE_SERVICE_ROLE_KEY=/d' server/.env
printf 'SUPABASE_URL=https://%s\nSUPABASE_SERVICE_ROLE_KEY=%s\n' "$DOMAIN" "$SERVICE_ROLE_KEY" >> server/.env
chmod 600 server/.env
(cd web && NODE_OPTIONS=--max-old-space-size=2048 npm run build > /root/collegeolo-build.log 2>&1) || { echo "Build failed — see /root/collegeolo-build.log"; exit 1; }
env -i PATH="$PATH" HOME="$HOME" pm2 restart collegeolo-web collegeolo-api --update-env > /dev/null && pm2 save > /dev/null
sleep 5
echo
echo "DONE  website: $(curl -s -o /dev/null -w '%{http_code}' https://www.collegeolo.com/)  api: $(curl -s -o /dev/null -w '%{http_code}' https://www.collegeolo.com/api/health)  database: $(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $ANON_KEY" "https://$DOMAIN/rest/v1/countries?select=code&limit=1")"
echo "Studio (database admin): https://$DOMAIN  — user 'collegeolo', password: grep DASHBOARD_PASSWORD $DST/.env"
