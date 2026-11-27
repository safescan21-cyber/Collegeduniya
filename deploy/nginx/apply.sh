#!/usr/bin/env bash
# Installs the heavy-traffic nginx settings. Every change is tested with `nginx -t`; if nginx does not accept it,
# all files are put back exactly as they were and nginx keeps running unchanged.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
SITE=/etc/nginx/sites-available/collegeolo
MAIN=/etc/nginx/nginx.conf
TS=$(date +%Y%m%d%H%M%S)
[ -f "$SITE" ] || { echo "nginx: $SITE not found — skipped"; exit 0; }
cp -p "$SITE" "/root/nginx-collegeolo.$TS.bak"; cp -p "$MAIN" "/root/nginx-main.$TS.bak"
HAD_HTTP=0; [ -f /etc/nginx/conf.d/collegeolo-http.conf ] && HAD_HTTP=1 && cp -p /etc/nginx/conf.d/collegeolo-http.conf "/root/nginx-http.$TS.bak"
restore() {
  cp -p "/root/nginx-collegeolo.$TS.bak" "$SITE"; cp -p "/root/nginx-main.$TS.bak" "$MAIN"
  if [ $HAD_HTTP = 1 ]; then cp -p "/root/nginx-http.$TS.bak" /etc/nginx/conf.d/collegeolo-http.conf; else rm -f /etc/nginx/conf.d/collegeolo-http.conf; fi
  rm -f /etc/nginx/snippets/collegeolo-server.conf.new
  if [ ${HAD_GEO:-0} = 1 ]; then cp -p "/root/nginx-geoip.$TS.bak" /etc/nginx/conf.d/collegeolo-geoip.conf; else rm -f /etc/nginx/conf.d/collegeolo-geoip.conf; fi
  echo "# GeoIP off (rolled back)" > /etc/nginx/snippets/collegeolo-geo-headers.conf
}
mkdir -p /var/cache/nginx/collegeolo /etc/nginx/snippets

# ---- visitor location (GeoIP2). Needs the nginx geoip2 module (Ubuntu: libnginx-mod-http-geoip2) and the DB-IP database.
# If either is missing, the header snippet stays empty and everything else works as before.
HAD_GEO=0; [ -f /etc/nginx/conf.d/collegeolo-geoip.conf ] && HAD_GEO=1 && cp -p /etc/nginx/conf.d/collegeolo-geoip.conf "/root/nginx-geoip.$TS.bak"
if [ "${GEOIP:-on}" != "off" ]; then
  if ! ls /etc/nginx/modules-enabled/ 2>/dev/null | grep -q geoip2; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libnginx-mod-http-geoip2 >/dev/null 2>&1 \
      && echo "nginx: geoip2 module installed" || echo "nginx: could not install libnginx-mod-http-geoip2 — location headers stay off"
  fi
  [ -s /usr/share/GeoIP/dbip-city-lite.mmdb ] || bash "$HERE/geoip-update.sh" || true
  # monthly refresh (DB-IP publishes a new file each month)
  printf '# Collegeolo: refresh the DB-IP City Lite database monthly\n17 4 3 * * root bash %s/geoip-update.sh --reload >> /var/log/collegeolo-geoip.log 2>&1\n' "$HERE" > /etc/cron.d/collegeolo-geoip
fi
if [ "${GEOIP:-on}" != "off" ] && ls /etc/nginx/modules-enabled/ 2>/dev/null | grep -q geoip2 && [ -s /usr/share/GeoIP/dbip-city-lite.mmdb ]; then
  cp "$HERE/collegeolo-geoip.conf" /etc/nginx/conf.d/collegeolo-geoip.conf
  cp "$HERE/collegeolo-geo-headers.conf" /etc/nginx/snippets/collegeolo-geo-headers.conf
  GEO_ON=1
else
  rm -f /etc/nginx/conf.d/collegeolo-geoip.conf
  echo "# GeoIP off (module or database missing)" > /etc/nginx/snippets/collegeolo-geo-headers.conf
  GEO_ON=0
fi
cp "$HERE/collegeolo-http.conf" /etc/nginx/conf.d/collegeolo-http.conf
cp "$HERE/collegeolo-server.conf" /etc/nginx/snippets/collegeolo-server.conf

# more simultaneous connections per worker (Ubuntu's default 768 is far too low for thousands of visitors)
sed -i -E 's/^\s*worker_connections\s+[0-9]+;/\tworker_connections 8192;/' "$MAIN"
grep -q '^worker_rlimit_nofile' "$MAIN" || sed -i '1i worker_rlimit_nofile 65535;' "$MAIN"

# include the server snippet in the https block(s) of the site, once
if ! grep -q 'snippets/collegeolo-server.conf' "$SITE"; then
  python3 - "$SITE" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
out, i = [], 0
# find each "server {" block; add the include after server_name in blocks that listen on 443
for m in re.finditer(r'server\s*\{', s):
    start = m.end(); depth = 1; j = start
    while j < len(s) and depth:
        depth += {'{': 1, '}': -1}.get(s[j], 0); j += 1
    block = s[start:j]
    if re.search(r'listen\s+[^;]*443', block) and 'collegeolo.com' in block:
        sn = re.search(r'server_name[^;]*;', block)
        if sn:
            pos = start + sn.end()
            out.append(s[i:pos]); out.append('\n  include /etc/nginx/snippets/collegeolo-server.conf;'); i = pos
out.append(s[i:]); open(p, 'w').write(''.join(out))
PY
fi
# the snippet has its own /api/ location: drop the site's old one if present (otherwise nginx refuses duplicates)
python3 - "$SITE" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
def drop(block_src):
    # remove "location /api/ { ... }" (simple, non-nested) from blocks that include the snippet
    return re.sub(r'\n\s*location\s+/api/\s*\{[^{}]*\}', '', block_src)
parts = re.split(r'(server\s*\{)', s)
res = parts[0]
for k in range(1, len(parts), 2):
    body = parts[k + 1]
    res += parts[k] + (drop(body) if 'snippets/collegeolo-server.conf' in body else body)
open(p, 'w').write(res)
PY

# if only the GeoIP part is the problem, keep everything else and switch location off
if [ ${GEO_ON:-0} = 1 ] && ! nginx -t > /tmp/nginx-test.log 2>&1; then
  echo "nginx: GeoIP config not accepted — continuing without visitor location:"; tail -2 /tmp/nginx-test.log
  rm -f /etc/nginx/conf.d/collegeolo-geoip.conf; echo "# GeoIP off (nginx -t failed)" > /etc/nginx/snippets/collegeolo-geo-headers.conf; GEO_ON=0
fi
if nginx -t > /tmp/nginx-test.log 2>&1; then
  systemctl reload nginx && echo "nginx: heavy-traffic settings applied (gzip, static cache, keep-alive, 8192 connections, fair-use limits)$([ ${GEO_ON:-0} = 1 ] && echo ', visitor location via GeoIP2 + DB-IP')"
else
  echo "nginx: new settings NOT accepted — everything put back. Details:"; tail -5 /tmp/nginx-test.log
  restore; rm -f /etc/nginx/snippets/collegeolo-server.conf; nginx -t > /dev/null 2>&1 && systemctl reload nginx
  exit 1
fi
