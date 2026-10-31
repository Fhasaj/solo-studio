#!/bin/sh
# Runs the test suites against a production build, each on a fresh temporary database,
# with a local mail catcher and Stripe test secrets. Usage: npm run build && npm test
set -e
cd "$(dirname "$0")/.."
[ -f .next/standalone/server.js ] || { echo "Build first: npm run build"; exit 1; }
cp -r public .next/standalone/ && mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/

PORT=3200
MAIL_PORT=2525
TMP=$(mktemp -d)
SERVER=""
SINK=""

stop() {
  [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null || true
  [ -n "$SINK" ] && kill "$SINK" 2>/dev/null || true
  SERVER=""; SINK=""
  sleep 1
}
trap 'stop; rm -rf "$TMP"' EXIT

start() {
  stop
  rm -rf "$TMP/db" "$TMP/uploads" && mkdir -p "$TMP/db" "$TMP/uploads" && : > "$TMP/mail.jsonl"
  node tests/smtp-sink.mjs "$TMP/mail.jsonl" & SINK=$!
  DB_DIR="$TMP/db" UPLOAD_DIR="$TMP/uploads" EMAIL_HOST=127.0.0.1 EMAIL_PORT=$MAIL_PORT EMAIL_USER= EMAIL_PASSWORD= \
  EMAIL_TO=me@test.local ADMIN_EMAIL=me@test.local ADMIN_PASSWORD=test-admin-password-123 \
  SECRET_KEY=$(openssl rand -base64 48) DATA_ENCRYPTION_KEY=$(openssl rand -base64 32) \
  STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_test_secret \
  SITE_URL=http://localhost:$PORT PORT=$PORT HOSTNAME=127.0.0.1 NODE_ENV=production \
  node .next/standalone/server.js > "$TMP/server.log" 2>&1 & SERVER=$!
  for i in $(seq 1 40); do
    curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/settings/sections 2>/dev/null | grep -q 200 && return 0
    sleep 1
  done
  echo "Server didn't start:"; cat "$TMP/server.log"; exit 1
}

export BASE_URL=http://localhost:$PORT MAIL_FILE="$TMP/mail.jsonl" DB_DIR="$TMP/db"

echo "== Smoke test (fresh install)"; start; node tests/smoke.mjs
echo "== End-to-end flows"; start; node tests/e2e.mjs
echo "== Money, CV and settings"; start; node tests/finance.mjs
echo "== Access control"; start; node scripts/check-auth.mjs
