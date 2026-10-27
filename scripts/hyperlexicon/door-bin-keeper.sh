#!/bin/sh
# Keep the DMD-bounded binary hyperlexicon door up on this Mac (loopback only; khora's reader asks 127.0.0.1:11450 by default, HL_DOOR).
# Idempotent: starts the door when nothing answers on the port. Run from cron/launchd each minute, or by hand.
#   HL_BIN=~/hyperlexicon/v2 HL_DOOR_PORT=11450 scripts/hyperlexicon/door-bin-keeper.sh
set -eu
cd "$(dirname "$0")/../.."
BIN="${HL_BIN:-$HOME/hyperlexicon/v2}"; PORT="${HL_DOOR_PORT:-11450}"
curl -s -m 3 "http://127.0.0.1:$PORT/v1/hyperlexicon" >/dev/null 2>&1 && exit 0
nohup node --max-old-space-size=4000 native/organs/hyperlexicon/door.mjs --bin "$BIN" --port "$PORT" >> "${HL_DOOR_LOG:-$HOME/hyperlexicon/door-bin.log}" 2>&1 &
