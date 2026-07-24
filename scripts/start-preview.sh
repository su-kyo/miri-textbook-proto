#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_PORT="${1:-8000}"
PORT="$DEFAULT_PORT"
PREVIEW_HOST="${PREVIEW_HOST:-0.0.0.0}"

find_open_port() {
  local candidate="$1"
  while lsof -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; do
    candidate=$((candidate + 1))
  done
  echo "$candidate"
}

PORT="$(find_open_port "$PORT")"

if [[ "$PORT" != "$DEFAULT_PORT" ]]; then
  echo "Port $DEFAULT_PORT is already in use. Using port $PORT instead."
fi

cd "$PROJECT_ROOT"
echo "Starting preview server in $PROJECT_ROOT"
echo "Open: http://localhost:$PORT/index.html"
echo "LAN:  http://$PREVIEW_HOST:$PORT/index.html"
python3 -m http.server "$PORT" --bind "$PREVIEW_HOST"
