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
}
mkdir -p /var/cache/nginx/collegeolo /etc/nginx/snippets
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

if nginx -t > /tmp/nginx-test.log 2>&1; then
  systemctl reload nginx && echo "nginx: heavy-traffic settings applied (gzip, static cache, keep-alive, 8192 connections, fair-use limits)"
else
  echo "nginx: new settings NOT accepted — everything put back. Details:"; tail -5 /tmp/nginx-test.log
  restore; rm -f /etc/nginx/snippets/collegeolo-server.conf; nginx -t > /dev/null 2>&1 && systemctl reload nginx
  exit 1
fi
