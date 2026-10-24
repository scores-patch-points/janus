// traverse.check.mjs — integrity checks of the traversal API against the log it reads (no empirical claim):
//   A1 reopen: for 500 random types, every address usesOf returns (up to 5 per type) reopens to the type's own bytes in Zenodotus, and
//      nodesAt(address) names the same type.
//   A2 totals: for 300 random types, usesOf(type).total equals the vocabulary count of L0 (vocab.tsv.gz).
//   A3 candidates: for 300 random named types, candidatesOf equals the type's rows in L0's cands.tsv.gz, in order.
//   A4 nodes: for 300 random candidate nodes, node(id) exists and is in the candidate's language.
//   node native/organs/hyperlexicon/traverse.check.mjs <logDir> <zenodotusRoot>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { openHyperlexicon } from "./traverse.mjs";

const [logDir, zen] = process.argv.slice(2);
if (!logDir || !zen) { console.error("usage: traverse.check.mjs <logDir> <zenodotusRoot>"); process.exit(2); }
let seed = 1; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const hl = openHyperlexicon(logDir, { zen });
const vocab = gunzipSync(readFileSync(join(logDir, "vocab.tsv.gz"))).toString("utf8").split("\n").filter(Boolean).map((l) => { const i = l.lastIndexOf("\t"); return [l.slice(0, i), +l.slice(i + 1)]; });
const cands = new Map();
for (const l of gunzipSync(readFileSync(join(logDir, "cands.tsv.gz"))).toString("utf8").split("\n")) {
  if (!l) continue; const [t, lang, node, kind] = l.split("\t"); if (!cands.has(+t)) cands.set(+t, []); cands.get(+t).push({ node, lang, kind });
}
const V = vocab.length, out = { head: hl.head, types: V };
const pick = (n) => Array.from({ length: n }, () => Math.floor(rnd() * V));

let addrs = 0, ok1 = 0; const bad1 = [];
for (const t of pick(500)) {
  for (const u of hl.usesOf(t, {}, { limit: 5 }).uses) {
    if (!u.address) continue; addrs++;
    const r = hl.reopen(u.address, { length: u.length }); const got = r.bytes ? r.bytes.subarray(0, u.length).toString("utf8").toLowerCase() : `(${r.gap})`;
    const at = hl.nodesAt(u.path, u.start);
    if (got === vocab[t][0] && at.type === t) ok1++; else if (bad1.length < 5) bad1.push({ address: u.address, got, want: vocab[t][0], at: at.type });
  }
}
out.A1 = { addresses: addrs, ok: ok1, bad: bad1, pass: addrs > 0 && ok1 === addrs };

let ok2 = 0; const bad2 = [];
for (const t of pick(300)) { const n = hl.usesOf(t, {}, { limit: 0 }).total; if (n === vocab[t][1]) ok2++; else if (bad2.length < 5) bad2.push({ type: vocab[t][0], api: n, vocab: vocab[t][1] }); }
out.A2 = { checked: 300, ok: ok2, bad: bad2, pass: ok2 === 300 };

const named = [...cands.keys()]; let ok3 = 0; const sample3 = Array.from({ length: Math.min(300, named.length) }, () => named[Math.floor(rnd() * named.length)]);
for (const t of sample3) if (JSON.stringify(hl.candidatesOf(t)) === JSON.stringify(cands.get(t))) ok3++;
out.A3 = { checked: sample3.length, ok: ok3, pass: ok3 === sample3.length };

let ok4 = 0; const bad4 = [];
for (const t of sample3) { const c = cands.get(t)[Math.floor(rnd() * cands.get(t).length)]; const r = hl.node(c.node); if (r && r.lang === c.lang) ok4++; else if (bad4.length < 5) bad4.push({ node: c.node, lang: c.lang, got: r?.lang ?? null }); }
out.A4 = { checked: sample3.length, ok: ok4, bad: bad4, pass: ok4 === sample3.length };

out.all_pass = out.A1.pass && out.A2.pass && out.A3.pass && out.A4.pass;
console.log(JSON.stringify(out, null, 1));
process.exit(out.all_pass ? 0 : 1);
