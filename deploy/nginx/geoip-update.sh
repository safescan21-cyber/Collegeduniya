#!/usr/bin/env bash
# Downloads the free DB-IP "IP to City Lite" database (MMDB, CC BY 4.0 — https://db-ip.com) for nginx GeoIP2.
# Tries this month's file, then last month's. Replaces the old file only after the new one downloaded and unpacked fine.
# Run by apply.sh and monthly by /etc/cron.d/collegeolo-geoip. Exit 0 = a usable database is in place.
set -uo pipefail
DIR=/usr/share/GeoIP; DB=$DIR/dbip-city-lite.mmdb
mkdir -p "$DIR"
for m in "$(date +%Y-%m)" "$(date -d "$(date +%Y-%m-15) -1 month" +%Y-%m)"; do
  URL="https://download.db-ip.com/free/dbip-city-lite-$m.mmdb.gz"
  TMP=$(mktemp "$DIR/.dbip.XXXXXX")
  if curl -fsSL --max-time 600 -A "Collegeolo-GeoIP/1.0 (+https://www.collegeolo.com)" "$URL" -o "$TMP.gz" \
     && gunzip -c "$TMP.gz" > "$TMP" && [ "$(stat -c %s "$TMP")" -gt 20000000 ]; then
    chmod 644 "$TMP"; mv -f "$TMP" "$DB"; rm -f "$TMP.gz"
    echo "geoip: DB-IP City Lite $m installed ($(du -h "$DB" | cut -f1))"
    [ "${1:-}" = "--reload" ] && nginx -t >/dev/null 2>&1 && systemctl reload nginx
    exit 0
  fi
  rm -f "$TMP" "$TMP.gz"
done
if [ -s "$DB" ]; then echo "geoip: download failed — keeping the existing database"; exit 0; fi
echo "geoip: download failed and no database yet"; exit 1
