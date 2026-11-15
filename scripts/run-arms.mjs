#!/usr/bin/env node
// scripts/run-arms.mjs --pharos [--json]      read the runs from the shared log, weave the arms back into it
// scripts/run-arms.mjs <ledger.jsonl> [--json] read an older file ledger, READ-ONLY, write nothing
// Janus's geometry: the arm cut, the arm graph, the per-ground return counts
// and the reading shapes. No verdicts.
import fs from "node:fs";
import { runArms } from "../native/organs/run-arms.js";

if (process.argv.includes("--pharos")) {
  const { openDoor } = await import("../native/organs/pharos-door.mjs");
  const { weaveArms } = await import("../native/organs/run-arms-pharos.mjs");
  const door = await openDoor();
  const w = weaveArms(door);
  if (!w.on) { console.error(`pharos door is off: ${w.why}`); process.exit(1); }
  const r = w.report;
  if (process.argv.includes("--json")) console.log(JSON.stringify({ log: door.log, woven: w.woven, refused: w.refused, runs: r.runs, arms: r.arms.length, edges: { compatible: r.edges.compatible, conflict: r.edges.conflict }, totals: r.totals, readings: r.readings }, null, 2));
  else console.log(`RunArms@1 over pharos log "${door.log}": ${r.runs} runs, ${r.arms.length} arms, ${r.totals.changes} changes (${r.totals.returns} returns) · wove ${w.woven}, refused ${w.refused}${w.refused ? ` (${w.lastReason})` : ""}`);
  process.exit(w.refused ? 1 : 0);
}
const file = process.argv[2];
if (!file) { console.error("usage: node scripts/run-arms.mjs --pharos | <ledger.jsonl> [--json]"); process.exit(2); }
const records = [];
for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try { records.push(JSON.parse(line)); } catch { /* a torn line is skipped, never guessed */ }
}
const r = runArms(records);
if (process.argv.includes("--json")) { const { shapes, ...rest } = r; console.log(JSON.stringify({ ...rest, arms: r.arms.map(({ sig, ...a }) => a), edges: { compatible: r.edges.compatible, conflict: r.edges.conflict } }, null, 2)); process.exit(0); }
const big = [...r.arms].sort((a, b) => b.runs.length - a.runs.length).slice(0, 8);
console.log(`RunArms@1 over ${file}`);
console.log(`runs with claims: ${r.runs} · arms: ${r.arms.length} · arm pairs sharing a ground: ${r.edges.compatible} compatible, ${r.edges.conflict} in conflict`);
console.log(`largest arms: ${big.map((a) => `${a.arm}×${a.runs.length} (${a.grounds.length} grounds)`).join(", ")}`);
console.log(`reading changes between consecutive runs: ${r.totals.changes}, of which ${r.totals.returns} return to an earlier reading`);
console.log(`readings: ${r.readings.total} · by component count: ${JSON.stringify(r.readings.byComponents)}`);
console.log(`readings with claim/source sides recorded: ${r.readings.sidesRecorded} · sides that never touch: ${r.readings.sidesApart}`);
