#!/bin/bash
# Redeploy the Next.js app into a running stockpeak container.
# Critical: `docker cp` merges directories instead of replacing, which causes stale
# CSS filename hash references in HTML and CSS MIME errors on old chunks. We must
# rm -rf static first then copy.
#
# Usage: from repo root after `cd app && npm run build`:
#   ./docker/redeploy-nextjs.sh

set -e

CONTAINER="${STOCKPEAK_CONTAINER:-stockpeak}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)/app"

if [ ! -d "$APP_DIR/.next/standalone" ]; then
  echo "ERROR: $APP_DIR/.next/standalone not found. Run 'cd app && npm run build' first." >&2
  exit 1
fi

if ! docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: container '$CONTAINER' is not running. Start it with: docker compose up -d" >&2
  exit 1
fi

echo "→ Clean-replacing static directory in container..."
docker exec "$CONTAINER" rm -rf /app/.next/static

echo "→ Copying standalone server..."
docker cp "$APP_DIR/.next/standalone/." "$CONTAINER:/app/"

echo "→ Copying static chunks..."
docker cp "$APP_DIR/.next/static" "$CONTAINER:/app/.next/static"

echo "→ Copying public assets..."
docker cp "$APP_DIR/public/." "$CONTAINER:/app/public/" 2>/dev/null || true

echo "→ Restarting nextjs..."
docker exec "$CONTAINER" supervisorctl restart nextjs

echo "→ Waiting for health..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "✓ Deployed. / returns $code."
    exit 0
  fi
  sleep 1
done

echo "WARNING: / did not return 200 within 10s. Check: docker exec $CONTAINER tail /var/log/stockpeak/nextjs.log" >&2
exit 1
