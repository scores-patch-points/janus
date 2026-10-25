#!/bin/sh
# Ship the hyperlexicon door to the machine that holds the log, FROM A COMMIT: the commit's own files (git archive), never a working
# tree, into <dir>/<sha>; `current` is pointed at it and the keeper restarts the door on its next minute. Run on the Mac:
#   scripts/hyperlexicon/door-deploy.sh [<commit, default origin/main>] [<ssh host, default hyphae-llm>]
# Every hyphae command needs the user's yes first (ask-before-using-the-vm). The `llm` login's paths must be absolute.
set -eu
COMMIT=$(git rev-parse "${1:-origin/main}")
HOST="${2:-hyphae-llm}"
DIR="${HL_DOOR_DIR:-/mnt/eo-data/janus-hyperlexicon/door}"
SHA=$(echo "$COMMIT" | cut -c1-12)
echo "shipping janus $SHA to $HOST:$DIR/$SHA"
git archive --format=tar "$COMMIT" native/organs/hyperlexicon scripts/hyperlexicon/door-keeper.sh \
  | ssh -o BatchMode=yes "$HOST" "mkdir -p '$DIR/$SHA' && tar -x -C '$DIR/$SHA' && cp '$DIR/$SHA/scripts/hyperlexicon/door-keeper.sh' '$DIR/door-keeper.sh' && chmod +x '$DIR/door-keeper.sh' && ln -sfn '$DIR/$SHA' '$DIR/current' && echo deployed \$(readlink '$DIR/current')"
# the running door keeps the old code until it is replaced: stop it, and start the new one through the keeper.
# The pattern's [.] keeps pkill from matching this remote shell's own command line, which holds the pattern's text.
ssh -o BatchMode=yes "$HOST" "pkill -f 'hyperlexicon/door[.]mjs --log' || true; '$DIR/door-keeper.sh'; sleep 6; curl -s -m 10 http://127.0.0.1:${HL_DOOR_PORT:-11450}/v1/hyperlexicon || echo '(the door is still opening the log; the keeper retries each minute)'"
