#!/usr/bin/env bash
# Collegeolo one-shot VPS setup (Ubuntu + Node + PM2 + Nginx).
# Website on 127.0.0.1:3310, API on 127.0.0.1:4010, Nginx serves www.collegeolo.com and collegeolo.com.
# Leaves other apps on the server alone. Re-running it updates the code and rebuilds.
# The Supabase anon key below is public by design; the secret service_role key is added with deploy/set-key.sh.
set -e

# 2 GB swap so the Next.js build doesn't run out of memory
if ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# code
if [ ! -d /var/www/collegeolo/.git ]; then
  git clone -b feature/growth-features https://github.com/safescan21-cyber/Collegeduniya.git /var/www/collegeolo
else
  git -C /var/www/collegeolo pull --ff-only
fi
cd /var/www/collegeolo

# website settings (all public values)
cat > web/.env.local <<'ENVWEB'
NEXT_PUBLIC_SUPABASE_URL=https://bazrjvmjkfktaahfdghl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhenJqdm1qa2ZrdGFhaGZkZ2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxODI0MzksImV4cCI6MjExMDc1ODQzOX0.XNqGYIbvmaq6psXgmepyPRe-IU_kAy0EdN_WsBUaft0
NEXT_PUBLIC_API_URL=https://www.collegeolo.com
API_URL_INTERNAL=http://127.0.0.1:4010
NEXT_PUBLIC_SITE_URL=https://www.collegeolo.com
NEXT_PUBLIC_CONTACT_EMAIL=hello@collegeolo.com
ENVWEB

# API settings (created once; the secret key is added by deploy/set-key.sh)
if [ ! -f server/.env ]; then
  cat > server/.env <<'ENVAPI'
PORT=4010
CORS_ORIGIN=https://www.collegeolo.com,https://collegeolo.com
SITE_URL=https://www.collegeolo.com
SUPABASE_URL=https://bazrjvmjkfktaahfdghl.supabase.co
ENVAPI
  chmod 600 server/.env
fi

# install and build
(cd server && npm ci --omit=dev)
(cd web && npm ci && NODE_OPTIONS=--max-old-space-size=2048 npm run build)

# start the website
if pm2 describe collegeolo-web >/dev/null 2>&1; then
  pm2 restart collegeolo-web
else
  pm2 start node_modules/next/dist/bin/next --name collegeolo-web --cwd /var/www/collegeolo/web -- start -p 3310 -H 127.0.0.1
fi

# start the API only once the secret key is in place
KEY_OK=
if grep -q '^SUPABASE_SERVICE_ROLE_KEY=.\+' server/.env; then
  if pm2 describe collegeolo-api >/dev/null 2>&1; then
    pm2 restart collegeolo-api --update-env
  else
    pm2 start src/index.js --name collegeolo-api --cwd /var/www/collegeolo/server
  fi
  KEY_OK=1
fi
pm2 save

# Nginx site (created once; certbot later adds https to it)
if [ ! -f /etc/nginx/sites-available/collegeolo ]; then
  cat > /etc/nginx/sites-available/collegeolo <<'NGINX'
server {
  listen 80;
  listen [::]:80;
  server_name collegeolo.com www.collegeolo.com;
  client_max_body_size 20M;

  location /api/ {
    proxy_pass http://127.0.0.1:4010;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location / {
    proxy_pass http://127.0.0.1:3310;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGINX
  ln -sf /etc/nginx/sites-available/collegeolo /etc/nginx/sites-enabled/collegeolo
fi
nginx -t && systemctl reload nginx

sleep 3
echo
echo "SETUP-OK  website check: HTTP $(curl -s -o /dev/null -w '%{http_code}' -H 'Host: www.collegeolo.com' http://127.0.0.1/)"
[ -n "$KEY_OK" ] || echo "NEXT STEP: bash /var/www/collegeolo/deploy/set-key.sh"
