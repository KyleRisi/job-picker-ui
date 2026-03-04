#!/usr/bin/env bash

set -u

PORT="${PORT:-3000}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup_port() {
  local pids
  pids="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "[dev-stable] Releasing port $PORT (PID: $pids)"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

on_exit() {
  echo
  echo "[dev-stable] Stopping."
  exit 0
}

trap on_exit INT TERM

cd "$ROOT_DIR"
cleanup_port

while true; do
  echo "[dev-stable] Starting Next dev server on :$PORT"
  ./node_modules/.bin/next dev -p "$PORT"
  code=$?
  if [ "$code" -eq 0 ]; then
    echo "[dev-stable] Exited normally."
    break
  fi
  echo "[dev-stable] Server exited with code $code. Restarting in 1s..."
  sleep 1
  cleanup_port
done
