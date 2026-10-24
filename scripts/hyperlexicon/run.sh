#!/bin/bash
# Hyperlexicon v1 build (HYPERLEXICON-V1-JANUS-PLAN.md; gates frozen in HYPERLEXICON-V1-PREREG.md). Staged and resumable: a stage with
# $HL_OUT/<stage>.done is skipped. Zenodotus is read only. Env: HL_ZEN, HL_OUT, HL_PACKS (dir with the dictionary packs), HL_WORKERS,
# HL_SMOKE (n documents), HL_PY (python), HL_ZIDX, HL_DATES.
set -u
cd "$(dirname "$0")"
export HL_OUT="${HL_OUT:-$HOME/.cache/janus-hyperlexicon/v1}" HL_WORKERS="${HL_WORKERS:-4}"
PACKS="${HL_PACKS:-$HOME/.cache/live_priors/wiktionary}"; PY="${HL_PY:-python3}"
mkdir -p "$HL_OUT"
log() { echo "$(date -u +%FT%TZ) $*" | tee -a "$HL_OUT/run.log"; }
stage() { local name=$1; shift; if [ -f "$HL_OUT/$name.done" ]; then log "skip $name (done)"; return 0; fi
  log "start $name"; if "$@" >> "$HL_OUT/$name.log" 2>&1; then touch "$HL_OUT/$name.done"; log "done $name"; else log "FAILED $name (see $name.log)"; return 1; fi; }
stage s0 $PY -I s0_ground.py || exit 1
stage s1 $PY -I s1_postings.py || exit 1
VOCARG=""; [ "${HL_SMOKE:-0}" != "0" ] && VOCARG="--vocab $HL_OUT/vocab.tsv.gz"
stage s2en node s2_givers.mjs --pack "$PACKS/wiktionary-slim-2026-10-01-v3.pack" --giver wiktionary-en --version 2026-10-01-v3 $VOCARG &
P1=$!
stage s2es node s2_givers.mjs --pack "$PACKS/wiktionary-es-slim-2026-10-01.pack" --giver wiktionary-es --version 2026-10-01 $VOCARG &
P2=$!
wait $P1 || exit 1; wait $P2 || exit 1
stage s3 $PY -I s3_join.py || exit 1
stage s4 $PY -I s4_gates.py || exit 1
# the log's manifest and head: sha256 of every file the log holds, then of that list
( cd "$HL_OUT" && find events names-index postings -type f | sort | xargs shasum -a 256 > manifest.sha256 \
  && shasum -a 256 vocab.tsv.gz cands.tsv.gz doccounts.npz docs.json gates.json >> manifest.sha256 && shasum -a 256 manifest.sha256 > head.sha256 )
log "ALL DONE head $(cut -c1-16 "$HL_OUT/head.sha256")"
