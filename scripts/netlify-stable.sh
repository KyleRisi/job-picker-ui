#!/usr/bin/env bash

set -u

PUBLIC_PORT="${NETLIFY_PORT:-8888}"
TARGET_PORT="${TARGET_PORT:-3000}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "[netlify-stable] Releasing port $port (PID: $pids)"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

on_exit() {
  echo
  echo "[netlify-stable] Stopping."
  exit 0
}

trap on_exit INT TERM

cd "$ROOT_DIR"
cleanup_port "$PUBLIC_PORT"
cleanup_port "$TARGET_PORT"

while true; do
  echo "[netlify-stable] Starting Netlify dev on :$PUBLIC_PORT (Next target :$TARGET_PORT)"
  ./node_modules/.bin/netlify dev --port "$PUBLIC_PORT" --target-port "$TARGET_PORT"
  code=$?
  if [ "$code" -eq 0 ]; then
    echo "[netlify-stable] Exited normally."
    break
  fi
  echo "[netlify-stable] Server exited with code $code. Restarting in 1s..."
  sleep 1
  cleanup_port "$PUBLIC_PORT"
  cleanup_port "$TARGET_PORT"
done
