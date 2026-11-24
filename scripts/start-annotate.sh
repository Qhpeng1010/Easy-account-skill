#!/bin/bash
# page-preview start-annotate.sh — 启动预览划词批注服务
# Usage: start-annotate.sh <change目录>/preview.html [start_port]
# Output: "OK <port> <pid>" (new) | "REUSED <port> <pid>" (existing) | "FAIL <reason>"

HTML_FILE="$1"
BASE_PORT="${2:-8921}"
MAX_PORT=8950

if [ -z "$HTML_FILE" ]; then
  echo "FAIL: missing preview.html path"
  echo "usage: start-annotate.sh <change目录>/preview.html [start_port]"
  exit 1
fi

HTML_FILE="$(cd "$(dirname "$HTML_FILE")" && pwd)/$(basename "$HTML_FILE")"
if [ ! -f "$HTML_FILE" ]; then
  echo "FAIL: file not found: $HTML_FILE"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_JS="$SCRIPT_DIR/annotate-preview-server.js"
FILE_BASENAME="$(basename "$HTML_FILE")"

# ── Step 1: 扫描运行中的服务，同一 preview 复用 ──
EXISTING_PORT=""
for p in $(seq $BASE_PORT $MAX_PORT); do
  LOG="/tmp/page-preview-annotate-$p.log"
  if lsof -i :$p > /dev/null 2>&1; then
    if [ -f "$LOG" ] && { grep -qF "$HTML_FILE" "$LOG" 2>/dev/null || grep -qF "$FILE_BASENAME" "$LOG" 2>/dev/null; }; then
      EXISTING_PORT=$p
      EXISTING_PID=$(lsof -t -i :$p 2>/dev/null | head -1)
      break
    fi
  else
    rm -f "$LOG" 2>/dev/null
  fi
done

if [ -n "$EXISTING_PORT" ]; then
  echo "REUSED $EXISTING_PORT $EXISTING_PID"
  exit 0
fi

# ── Step 2: 找可用端口 ──
PORT=$BASE_PORT
while [ $PORT -le $MAX_PORT ]; do
  if ! lsof -i :$PORT > /dev/null 2>&1; then
    break
  fi
  PORT=$((PORT + 1))
done
if [ $PORT -gt $MAX_PORT ]; then
  echo "FAIL: ports $BASE_PORT-$MAX_PORT all in use"
  exit 1
fi

# ── Step 3: node / python3 ──
NODE_BIN="$(command -v node 2>/dev/null)"
if [ -z "$NODE_BIN" ]; then
  for candidate in \
    "$HOME/.workbuddy/binaries/node/versions/24.14.0/bin/node" \
    /usr/local/bin/node /opt/homebrew/bin/node /usr/bin/node; do
    if [ -x "$candidate" ]; then NODE_BIN="$candidate"; break; fi
  done
fi
[ -z "$NODE_BIN" ] && { echo "FAIL: node not found"; exit 1; }

PY_BIN="$(command -v python3 2>/dev/null)"
[ -z "$PY_BIN" ] && { echo "FAIL: python3 not found"; exit 1; }

[ ! -f "$SERVER_JS" ] && { echo "FAIL: annotate-preview-server.js not found at $SERVER_JS"; exit 1; }

# ── Step 4: 脱离进程启动 ──
LOG_FILE="/tmp/page-preview-annotate-$PORT.log"
"$PY_BIN" -c "
import subprocess
p = subprocess.Popen(
    ['$NODE_BIN', '$SERVER_JS', '$HTML_FILE', '--port', '$PORT'],
    stdout=open('$LOG_FILE', 'w'),
    stderr=subprocess.STDOUT,
    start_new_session=True
)
print(p.pid)
" > /tmp/page-preview-annotate-pid.txt
PID=$(cat /tmp/page-preview-annotate-pid.txt)

# ── Step 5: 等待就绪 ──
for i in 1 2 3 4 5; do
  sleep 1
  if lsof -i :$PORT > /dev/null 2>&1; then
    echo "OK $PORT $PID"
    exit 0
  fi
done

echo "FAIL: server did not start within 5s, log:"
cat "$LOG_FILE"
exit 1
