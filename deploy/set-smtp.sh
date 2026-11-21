#!/usr/bin/env bash
# Connects an email account to Collegeolo's Supabase so login codes are emailed.
# Default: Gmail with an App Password (myaccount.google.com/apppasswords). Run once:
#   bash /var/www/collegeolo/deploy/set-smtp.sh
set -e
DST=/opt/collegeolo-supabase
cd "$DST"
read -rp "Email address that sends the codes [safescan21@gmail.com]: " FROM; FROM=${FROM:-safescan21@gmail.com}
read -rp "SMTP server [smtp.gmail.com]: " HOST; HOST=${HOST:-smtp.gmail.com}
read -rp "SMTP port [587]: " PORT; PORT=${PORT:-587}
read -rsp "Password (Gmail: the 16-letter App Password; spaces are fine): " PASS; echo
PASS=$(printf '%s' "$PASS" | tr -d ' ')
[ ${#PASS} -ge 8 ] || { echo "Password looks too short. Nothing changed."; exit 1; }
set_env() { if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
set_env SMTP_ADMIN_EMAIL "$FROM"
set_env SMTP_HOST "$HOST"
set_env SMTP_PORT "$PORT"
set_env SMTP_USER "$FROM"
sed -i '/^SMTP_PASS=/d' .env && printf 'SMTP_PASS=%s\n' "$PASS" >> .env
set_env SMTP_SENDER_NAME Collegeolo
unset PASS
chmod 600 .env
cp /var/www/collegeolo/deploy/supabase-collegeolo.override.yml "$DST/docker-compose.collegeolo.yml"
CF=$(grep '^COMPOSE_FILE=' .env | cut -d= -f2-)
case ":$CF:" in *:docker-compose.collegeolo.yml:*) ;; *) set_env COMPOSE_FILE "${CF}:docker-compose.collegeolo.yml" ;; esac
docker compose up -d auth > /dev/null 2>&1
sleep 8
echo "Email settings saved and login service restarted. Try logging in on www.collegeolo.com now."
