#!/bin/zsh
set -euo pipefail

PORT="${1:-8000}"
BASE_URL="http://localhost:$PORT"

URLS=(
  "$BASE_URL/index.html"
  "$BASE_URL/prototype/pages/home.html"
  "$BASE_URL/publish/home.html"
  "$BASE_URL/docs/design-system.html"
)

for url in "${URLS[@]}"; do
  open -a "Google Chrome" "$url"
done

echo "Opened preview URLs in Google Chrome:"
for url in "${URLS[@]}"; do
  echo "  - $url"
done
