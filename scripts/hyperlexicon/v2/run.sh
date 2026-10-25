#!/bin/bash
# Hyperlexicon v2 build (V2-PREREG.md). Staged and resumable: a stage with $HL_WORK/<stage>.done is skipped, and the reading skips every
# document whose sightings are written. Everything it writes is under HL_OUT (v2 itself) and HL_WORK (sightings, buckets, temp, logs).
# Env: HL_ZEN, HL_OUT, HL_WORK, HL_PACKS, HL_KHORA (khora native dir), KHORA_PRIORS_DIR, HL_ZIDX, HL_DATES, HL_PY, HL_WORKERS, HL_READERS
set -u
cd "$(dirname "$0")"
: "${HL_OUT:?}" "${HL_WORK:?}" "${HL_ZEN:?}" "${HL_KHORA:?}" "${KHORA_PRIORS_DIR:?}" "${HL_PACKS:?}"
export HL_OUT HL_WORK HL_ZEN KHORA_PRIORS_DIR TMPDIR="$HL_WORK/tmp" HL_WORKERS="${HL_WORKERS:-7}"
PY="${HL_PY:-python3}"; READERS="${HL_READERS:-7}"
mkdir -p "$HL_OUT" "$HL_WORK/tmp" "$HL_WORK/logs"
log() { echo "$(date -u +%FT%TZ) $*" | tee -a "$HL_WORK/run.log"; }
stage() { local name=$1; shift; if [ -f "$HL_WORK/$name.done" ]; then log "skip $name (done)"; return 0; fi
  log "start $name"; if "$@" >> "$HL_WORK/logs/$name.log" 2>&1; then touch "$HL_WORK/$name.done"; log "done $name"; else log "FAILED $name (see logs/$name.log)"; return 1; fi; }
read_all() {
  $PY -I readlist.py "$HL_WORK" "$READERS" || return 1
  local pids=() ok=0
  for k in $(seq 0 $((READERS - 1))); do
    node --max-old-space-size=4000 read.mjs --khora "$HL_KHORA" --list "$HL_WORK/list-$k.tsv" --work "$HL_WORK" >> "$HL_WORK/logs/read-$k.log" 2>&1 & pids+=($!)
  done
  for p in "${pids[@]}"; do wait "$p" || ok=1; done
  return $ok
}
stage ground $PY -I ../s0_ground.py || exit 1
stage givers node --max-old-space-size=12000 givers.mjs --out "$HL_OUT" \
  --pack "$HL_PACKS/wiktionary-slim-2026-10-01-v3.pack" --giver wiktionary-en --version 2026-10-01-v3 \
  --pack "$HL_PACKS/wiktionary-es-slim-2026-10-01.pack" --giver wiktionary-es --version 2026-10-01 || exit 1
stage counts $PY -I counts.py "$HL_WORK" || exit 1
stage read read_all || exit 1
stage fold $PY -I fold.py "$HL_WORK" || exit 1
stage keep $PY -I keep.py "$HL_WORK" || exit 1
log "ALL DONE head $(cut -c1-16 "$HL_OUT/head.sha256")"
