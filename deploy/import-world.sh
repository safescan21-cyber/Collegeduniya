#!/usr/bin/env bash
# Fills an empty Collegeolo database with worldwide data, in the background:
#   1. countries + cities over 15,000 people (GeoNames, ~33k places)
#   2. universities of every country (Hipolabs list + Wikidata: city, coordinates, founding year, logo, photo)
# Photos/descriptions are then added automatically by the API every few hours (AUTOFILL).
# Progress: tail -f /root/collegeolo-import.log      Takes about 1–2 hours. Safe to re-run.
set -e
cd /var/www/collegeolo/server
if ! grep -qE '^SUPABASE_SERVICE_ROLE_KEY=(sb_secret_|eyJ)[A-Za-z0-9._-]+$' .env; then
  echo "The Supabase secret key is missing or wrong. Run: bash /var/www/collegeolo/deploy/set-key.sh"
  exit 1
fi
nohup sh -c 'echo "== $(date) countries + cities"; npm run --silent import:cities; echo "== $(date) universities, all countries"; npm run --silent import:universities -- --all; echo "== $(date) IMPORT-DONE"' > /root/collegeolo-import.log 2>&1 &
echo "Import started in the background. Watch it with: tail -f /root/collegeolo-import.log"
