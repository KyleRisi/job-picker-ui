#!/usr/bin/env bash

set -euo pipefail

LABEL="com.kyle.compendium-circus-hr.dev"
USER_ID="$(id -u)"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$USER_ID" "$PLIST_PATH" 2>/dev/null || true
rm -f "$PLIST_PATH"

echo "Removed LaunchAgent: $PLIST_PATH"
