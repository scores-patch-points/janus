#!/usr/bin/env node
// scripts/word-fold.mjs --pool <words.json> [--seed s] [--nulls 50] [--radii 1,2] [--store dir] a/b [c/d ...]
// Folds each word pair along the translation channel of the hyperlexicon and weaves the COUNTS into the shared
// log as word-fold entries (janus's own door). The null words are drawn here, by seed, from the pool the caller
// names, matched on the second word's radius-1 ball size (within 25%). Nothing is compared and no verdict is
// printed: whoever judges reads the entries from the log.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openHyperlexiconBin } from "../native/organs/hyperlexicon/bin.mjs";
import { makeFold } from "../native/organs/hyperlexicon/channel-fold.mjs";
import { weaveWordFold } from "../native/organs/hyperlexicon/channel-fold-pharos.mjs";
import { openDoor } from "../native/organs/pharos-door.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const flags = new Set(["--pool", "--seed", "--nulls", "--radii", "--store"]);
const pairs = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !flags.has(all[i - 1])).map((p) => p.split("/")).filter((p) => p.length === 2);
const poolFile = arg("--pool");
if (!poolFile || !pairs.length) { console.error("usage: node scripts/word-fold.mjs --pool <words.json> [--seed s] [--nulls 50] [--radii 1,2] a/b [c/d ...]"); process.exit(2); }
const raw = JSON.parse(fs.readFileSync(poolFile, "utf8")), pool = Array.isArray(raw) ? raw : raw.pool;
const seed = arg("--seed", "word-fold"), want = Number(arg("--nulls", "50")), radii = arg("--radii", "1,2").split(",").map(Number);
const storeDir = arg("--store", path.join(os.homedir(), "hyperlexicon", "v2"));
function rng(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } let a = h >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const H = openHyperlexiconBin(storeDir), F = makeFold(H);
const door = await openDoor();
if (!door.on) { console.error(`pharos door is off: ${door.why}`); process.exit(1); }
const size1 = (w) => F.ball(w, 1).nodes.size;
let woven = 0;
for (const [a, b] of pairs) {
  const r = rng(`${seed}:${a}|${b}`), s = size1(b), nullWords = [];
  const start = Math.floor(r() * pool.length);
  for (let k = 0; k < pool.length && nullWords.length < want; k++) { const w = pool[(start + k) % pool.length]; if (w === a || w === b) continue; const z = size1(w); if (z > 0 && z >= s * 0.75 && z <= s * 1.25) nullWords.push(w); }
  const e = weaveWordFold(door, F.readings(a, b, { radii, nullWords }), { store: H.answer({ op: "names", surfaces: [], lang: "en" }).head ?? null, seed, pool: path.basename(poolFile), nullRule: "ball size at radius 1 within 25% of b's" });
  if (e) woven += 1;
}
console.log(`word-fold: ${pairs.length} pair(s) folded, ${woven} woven into pharos log "${door.log}", refused ${door.counts.refused}${door.counts.refused ? ` (${door.counts.lastReason})` : ""}`);
process.exit(door.counts.refused ? 1 : 0);
