#!/usr/bin/env bash

set -euo pipefail

LABEL="com.kyle.compendium-circus-hr.dev"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_ID="$(id -u)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/compendium-circus-hr"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$LABEL.plist"
DEV_SCRIPT="$ROOT_DIR/scripts/dev-stable.sh"

mkdir -p "$LAUNCH_AGENTS_DIR"
mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$DEV_SCRIPT</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>PORT</key>
    <string>3000</string>
    <key>NEXT_DIST_DIR</key>
    <string>.next-dev</string>
  </dict>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/dev-stdout.log</string>

  <key>StandardErrorPath</key>
  <string>$LOG_DIR/dev-stderr.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$USER_ID" "$PLIST_PATH" 2>/dev/null || true
launchctl bootstrap "gui/$USER_ID" "$PLIST_PATH"
launchctl kickstart -k "gui/$USER_ID/$LABEL"

echo "Installed LaunchAgent: $PLIST_PATH"
echo "Logs:"
echo "  stdout: $LOG_DIR/dev-stdout.log"
echo "  stderr: $LOG_DIR/dev-stderr.log"
echo "Service label: $LABEL"
