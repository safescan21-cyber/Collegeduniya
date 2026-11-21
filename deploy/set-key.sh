#!/usr/bin/env bash
# Asks for the Supabase secret (service_role) key without showing it on screen,
# saves it in /var/www/collegeolo/server/.env (readable by root only) and starts the API.
set -e
cd /var/www/collegeolo/server
read -rsp "Paste the Supabase secret (service_role) key, then press Enter: " KEY
echo
if [ ${#KEY} -lt 30 ]; then echo "That doesn't look like a key. Nothing changed."; exit 1; fi
sed -i '/^SUPABASE_SERVICE_ROLE_KEY=/d' .env
printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$KEY" >> .env
chmod 600 .env
unset KEY
if pm2 describe collegeolo-api >/dev/null 2>&1; then
  pm2 restart collegeolo-api --update-env
else
  pm2 start src/index.js --name collegeolo-api --cwd /var/www/collegeolo/server
fi
pm2 save
sleep 3
echo "API check: HTTP $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4010/api/health)  (200 = working)"
