#!/bin/sh
# Render og.html → og.png (1200×630) with headless Chrome.
# Usage: npm run og  (a static server must be running; pass its URL as $1 to override)
set -e
URL="${1:-http://localhost:5174/og.html}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/og.png"

for c in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "$(command -v google-chrome || true)" \
  "$(command -v chromium || true)"; do
  [ -x "$c" ] && CHROME="$c" && break
done
[ -z "$CHROME" ] && { echo "No Chrome/Chromium found"; exit 1; }

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1200,630 \
  --screenshot="$OUT" "$URL" 2>/dev/null
echo "Wrote $OUT"
