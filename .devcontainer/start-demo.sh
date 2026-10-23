#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

bookwise_port="${PORT:-3000}"
bookwise_log="/tmp/bookwise-codespaces-${bookwise_port}.log"
bookwise_health="http://127.0.0.1:${bookwise_port}/api/catalog"


bookwise_is_ready() {
  curl --fail --silent --max-time 2 "$bookwise_health" | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const data = JSON.parse(input);
        process.exit(data.salon?.name === "BookWise Studio" && Array.isArray(data.services) ? 0 : 1);
      } catch { process.exit(1); }
    });'
}

if [ "${1:-}" != "" ] && [ "${1:-}" != "--restart" ]; then
  echo "Usage: bash .devcontainer/start-demo.sh [--restart]"
  exit 2
fi

if [ "${1:-}" = "--restart" ]; then
  if bookwise_is_ready; then
    if ! command -v fuser >/dev/null; then
      echo "Cannot restart automatically: fuser is unavailable. Stop this Codespace, resume it, and run npm run build before starting the app."
      exit 1
    fi
    echo "Stopping the BookWise server on port ${bookwise_port}; account and booking data will be retained."
    if ! fuser -k -TERM "${bookwise_port}/tcp"; then
      echo "Could not stop the existing server. Run this command in the Codespaces terminal as the same user that started BookWise."
      exit 1
    fi
    for bookwise_attempt in $(seq 1 30); do
      if ! bookwise_is_ready; then break; fi
      sleep 1
    done
    if bookwise_is_ready; then
      echo "The old server has not stopped; inspect it before rebuilding."
      exit 1
    fi
  fi
  npm run build
fi

if bookwise_is_ready; then
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
  if bookwise_is_ready; then
    echo "BookWise is ready on port ${bookwise_port}."
    echo "In GitHub Codespaces, open Ports and set this port's visibility to Public to share the demo."
    exit 0
  fi
  sleep 1
done

echo "BookWise did not become ready. Inspect ${bookwise_log}."
exit 1
