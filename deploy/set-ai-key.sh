#!/usr/bin/env bash
# Adds a free AI key for mock tests (question writing + answer checking) without showing it on screen,
# restarts the API and switches the mock-test Autopilot on.
#   bash /var/www/collegeolo/deploy/set-ai-key.sh
set -euo pipefail
ENV=/var/www/collegeolo/server/.env
echo "Which AI service is this key from?"
echo "  1) Google Gemini   (free: aistudio.google.com/apikey)"
echo "  2) Groq            (free: console.groq.com/keys)"
echo "  3) OpenRouter      (free models: openrouter.ai/keys)"
echo "  4) Mistral         (free: console.mistral.ai)"
echo "  5) Anthropic Claude (paid: console.anthropic.com)"
read -r -p "Number: " n
case "$n" in
  1) VAR=GEMINI_API_KEY ;; 2) VAR=GROQ_API_KEY ;; 3) VAR=OPENROUTER_API_KEY ;; 4) VAR=MISTRAL_API_KEY ;; 5) VAR=ANTHROPIC_API_KEY ;;
  *) echo "Unknown choice"; exit 1 ;;
esac
read -r -s -p "Paste the key (nothing will show) and press Enter: " KEY; echo
KEY=$(printf '%s' "$KEY" | tr -d '[:space:]')
[ ${#KEY} -ge 20 ] || { echo "That key looks too short — nothing changed."; exit 1; }
touch "$ENV"; chmod 600 "$ENV"
grep -v "^${VAR}=" "$ENV" > "$ENV.tmp" || true
printf '%s=%s\n' "$VAR" "$KEY" >> "$ENV.tmp"; mv "$ENV.tmp" "$ENV"; chmod 600 "$ENV"
unset KEY
echo "Saved $VAR (value hidden)."
pm2 restart collegeolo-api --update-env > /dev/null && echo "API restarted."
# switch the Autopilot on
cd /opt/collegeolo-supabase
docker compose exec -T db psql -U postgres -q -c "update public.mock_settings set autopilot = true where id = 1; insert into public.mock_settings (id, autopilot) values (1, true) on conflict (id) do nothing;" && echo "Mock-test Autopilot: ON"
sleep 4
curl -s -o /dev/null -w "API health: HTTP %{http_code}\n" http://127.0.0.1:4010/api/health || true
echo "Done. Tests appear as questions are written and double-checked (first ones within about an hour)."
