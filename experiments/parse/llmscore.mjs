// llmscore.mjs <name> <llm.json> [...]: PREREG-LLM-GATE measures M1 to M7. Pools the given files (one group).
import fs from "node:fs";
const name = process.argv[2], T = process.argv.slice(3).flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8"))), MS = [0, 0.5, 1, 2, 3], pct = (x, n) => (n ? (100 * x / n).toFixed(1) + "%" : "n/a");
const ARMS = { LLM: (t) => t.llm, NOSENT: (t) => t.nosent, EOT: (t) => t.eot, "LLM+EOT": (t) => t.llm + t.eot }, n = T.length, nT = T.filter((t) => t.aRight).length;
console.log(`\n===== ${name}: ${n} reachable tokens, always-teacher ${pct(nT, n)}`);
for (const [arm, m] of Object.entries(ARMS)) { let line = arm.padEnd(8); for (const k of MS) { const c = T.filter((t) => Math.abs(m(t)) >= k), ok = c.filter((t) => (m(t) >= 0 ? t.aRight : t.bRight)).length; line += `  m${k}: cov ${pct(c.length, n).padStart(6)} prec ${pct(ok, c.length).padStart(6)} tchr ${pct(c.filter((t) => t.aRight).length, c.length).padStart(6)} |`; } console.log(line); }
const v = T.filter((t) => t.llm <= -1); console.log(`M3 veto (LLM prefers ours at >=1 bit): ${v.length} tokens, ours right ${pct(v.filter((t) => t.bRight).length, v.length)}, teacher right ${pct(v.filter((t) => t.aRight).length, v.length)}`);
const dis = T.filter((t) => Math.sign(t.llmo1) !== Math.sign(t.llmo2)).length; console.log(`M5 the two orders pick differently on ${pct(dis, n)}`);
const hi = T.filter((t) => Math.abs(t.llm) >= 2), lo = T.filter((t) => Math.abs(t.llm) < 0.5), pr = (c) => c.filter((t) => (t.llm >= 0 ? t.aRight : t.bRight)).length;
console.log(`M7 calibration: precision at |d|>=2 ${pct(pr(hi), hi.length)} (${hi.length}) vs |d|<0.5 ${pct(pr(lo), lo.length)} (${lo.length})`);
