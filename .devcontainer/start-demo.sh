#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."

bookwise_port="${PORT:-3000}"
bookwise_log="/tmp/bookwise-codespaces-${bookwise_port}.log"
bookwise_health="http://127.0.0.1:${bookwise_port}/api/catalog"

if curl --fail --silent --max-time 2 "$bookwise_health" >/dev/null; then
  echo "BookWise is already responding on port ${bookwise_port}."
  exit 0
fi

if [ ! -f .next/BUILD_ID ]; then
  echo "No production build found. Run npm run build, then retry this command."
  exit 1
fi

export PORT="$bookwise_port"
export BOOKWISE_DEMO_MODE="${BOOKWISE_DEMO_MODE:-true}"
export BOOKWISE_SECURE_COOKIES="${BOOKWISE_SECURE_COOKIES:-true}"
nohup npm start >"$bookwise_log" 2>&1 </dev/null &
bookwise_pid=$!

for bookwise_attempt in $(seq 1 40); do
  if ! kill -0 "$bookwise_pid" 2>/dev/null; then
    cat "$bookwise_log"
    exit 1
  fi
  if curl --fail --silent --max-time 2 "$bookwise_health" >/dev/null; then
    echo "BookWise is ready on port ${bookwise_port}."
    echo "In GitHub Codespaces, open Ports and set this port's visibility to Public to share the demo."
    exit 0
  fi
  sleep 1
done

echo "BookWise did not become ready. Inspect ${bookwise_log}."
exit 1
