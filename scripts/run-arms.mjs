#!/usr/bin/env node
// scripts/run-arms.mjs <ledger.jsonl> [--json] — Janus's geometry over a
// reasoning ledger, READ-ONLY. Prints the arm cut, the arm graph, the
// per-ground return counts and the reading shapes. No verdicts.
import fs from "node:fs";
import { runArms } from "../native/organs/run-arms.js";

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/run-arms.mjs <ledger.jsonl> [--json]"); process.exit(2); }
const records = [];
for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try { records.push(JSON.parse(line)); } catch { /* a torn line is skipped, never guessed */ }
}
const r = runArms(records);
if (process.argv.includes("--json")) { const { shapes, ...rest } = r; console.log(JSON.stringify({ ...rest, edges: { compatible: r.edges.compatible, conflict: r.edges.conflict } }, null, 2)); process.exit(0); }
const big = [...r.arms].sort((a, b) => b.runs.length - a.runs.length).slice(0, 8);
console.log(`RunArms@1 over ${file}`);
console.log(`runs with claims: ${r.runs} · arms: ${r.arms.length} · arm pairs sharing a ground: ${r.edges.compatible} compatible, ${r.edges.conflict} in conflict`);
console.log(`largest arms: ${big.map((a) => `${a.arm}×${a.runs.length} (${a.grounds.length} grounds)`).join(", ")}`);
console.log(`reading changes between consecutive runs: ${r.totals.changes}, of which ${r.totals.returns} return to an earlier reading`);
console.log(`readings: ${r.readings.total} · by component count: ${JSON.stringify(r.readings.byComponents)}`);
console.log(`readings with claim/source sides recorded: ${r.readings.sidesRecorded} · sides that never touch: ${r.readings.sidesApart}`);
