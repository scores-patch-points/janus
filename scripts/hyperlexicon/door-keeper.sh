#!/bin/sh
# Keep the hyperlexicon door alive where the log lives (hyphae). Run from cron every minute and at reboot:
#   @reboot   /mnt/eo-data/janus-hyperlexicon/door/door-keeper.sh
#   * * * * * /mnt/eo-data/janus-hyperlexicon/door/door-keeper.sh
# The door runs from `current`, the janus commit door-deploy.sh last shipped (never a working tree). A door that answers its
# handshake (GET /v1/hyperlexicon names its schema) is left alone. A holder of the port that does not answer is busy, not dead:
# only after HL_DOOR_HANG_MISSES silent probes in a row (one a minute, default 8) is it terminated and a fresh door started — the
# fold door's rule (fold-door-cf/hyphae/run.sh), learnt when a silent door held its port for nine hours.
DIR="${HL_DOOR_DIR:-/mnt/eo-data/janus-hyperlexicon/door}"
LOGDIR="${HL_LOG:-/mnt/eo-data/janus-hyperlexicon/v1}"
ZEN="${HL_ZEN:-/mnt/eo-data/zenodotus-v1}"
PORT="${HL_DOOR_PORT:-11450}"
NODE="${HL_NODE:-node}"
LOG="$DIR/door.log"
MISSES="$DIR/.misses"
PATTERN="hyperlexicon/door.mjs --log"

say() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) keeper: $*" >> "$LOG"; }

if curl -s -m "${HL_DOOR_PROBE_S:-10}" "http://127.0.0.1:$PORT/v1/hyperlexicon" 2>/dev/null | grep -q '"HyperlexiconDoor@1"'; then
  rm -f "$MISSES"
  exit 0
fi

pid=$(pgrep -f "$PATTERN" | head -1)
if [ -n "$pid" ]; then
  misses=$(( $(cat "$MISSES" 2>/dev/null || echo 0) + 1 ))
  echo "$misses" > "$MISSES"
  if [ "$misses" -lt "${HL_DOOR_HANG_MISSES:-8}" ]; then
    say "door busy (pid $pid, silent probe $misses); not starting a second"
    exit 0
  fi
  say "door hung (pid $pid silent for $misses probes); terminating it"
  kill "$pid" 2>/dev/null || true
  sleep 2
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$MISSES"
fi

if [ ! -f "$DIR/current/native/organs/hyperlexicon/door.mjs" ]; then say "no door at $DIR/current (run door-deploy.sh)"; exit 1; fi
say "starting the door from $(readlink "$DIR/current" 2>/dev/null || echo current) on :$PORT"
cd "$DIR/current" && setsid nohup "$NODE" native/organs/hyperlexicon/door.mjs --log "$LOGDIR" --zen "$ZEN" --port "$PORT" >> "$LOG" 2>&1 < /dev/null &
