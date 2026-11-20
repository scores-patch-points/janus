// surprisegain.mjs <train.conllu> <heldA.conllu> <heldB.conllu> [draws]: DEV ONLY, exploratory. THE RETROACTIVE SURPRISE REDUCTION OF A SLICE (segmentation-surprise.mjs), from RAW TEXT ONLY: no gold token, no treebank label is used to score or to propose. The treebank files are read only for the raw sentence text they carry ("# text = ").
//   per treebank form F: bits saved on the stream as encountered (retroactive) and on two held-out corpora the model never learned from (prospective), against a NULL of the same number of random cuts at the same length, `draws` times (seeded)
//   EMERGENT PROPOSALS: every word-final string of 1 to 4 characters is tried as a cut; they are ranked by bits saved. Do the clitics emerge without being named? What else does compression find?
// Reported numbers only; no verdict, no file written. No regex.
import fs from "node:fs";
import { tokenize } from "../../../khora/native/adapters/text/ud-tokenizer.js";
import { codeLength, prospective, gain } from "../../native/organs/segmentation-surprise.mjs";
const [trainF, aF, bF, drawsArg] = process.argv.slice(2), DRAWS = Number(drawsArg ?? 30), SEED = 20261119, APOS = "’";
const raws = (f) => fs.readFileSync(f, "utf8").split("\n").filter((l) => l.startsWith("# text = ")).map((l) => l.slice(9)), stream = (f) => raws(f).flatMap((r) => tokenize(r, null));
const train = stream(trainF), heldA = stream(aF), heldB = stream(bF);
const rng = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }, hashS = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const cutAll = (toks, F) => { const vs = [F, F.split("'").join(APOS)], k = [...F].length; return toks.flatMap((w) => { const v = vs.find((x) => w.endsWith(x)); const c = [...w]; return v && c.length > k ? [c.slice(0, c.length - [...v].length).join(""), v] : [w]; }); };
const cutRandom = (toks, F, n, r) => { const k = [...F].length, idx = []; toks.forEach((w, i) => { if ([...w].length > k + 1 && /* a word, not punctuation: it contains a letter */ [...w].some((c) => c.toLowerCase() !== c.toUpperCase())) idx.push(i); }); const pick = new Set(); while (pick.size < Math.min(n, idx.length)) pick.add(idx[Math.floor(r() * idx.length)]); return toks.flatMap((w, i) => { if (!pick.has(i)) return [w]; const c = [...w]; return [c.slice(0, c.length - k).join(""), c.slice(c.length - k).join("")]; }); };
const fires = (toks, F) => cutAll(toks, F).length - toks.length;
console.log(`stream: train ${train.length} tokens (${trainF.split("/").pop()}), held-out A ${heldA.length} (${aF.split("/").pop()}), held-out B ${heldB.length} (${bF.split("/").pop()}); ${DRAWS} null draws`);
const FORMS = ["'s", "n't", "'m", "'ll", "'ve", "'re", "'d", "not"], base = { retro: codeLength(train).bits, pA: prospective(train, heldA).bits, pB: prospective(train, heldB).bits };
const score = (sliceTrain, sliceA, sliceB) => ({ retro: gain(train, sliceTrain).gain, pA: base.pA - prospective(sliceTrain, sliceA).bits, pB: base.pB - prospective(sliceTrain, sliceB).bits });
console.log("\nTREEBANK FORMS (bits saved; positive = less surprising; per firing in brackets; null = same number of random cuts at the same length):");
for (const F of FORMS) {
  const n = fires(train, F); if (!n) { console.log(`${F.padEnd(5)} never fires`); continue; } const real = score(cutAll(train, F), cutAll(heldA, F), cutAll(heldB, F)), r = rng((SEED ^ hashS(F)) >>> 0), nulls = [];
  for (let d = 0; d < DRAWS; d++) nulls.push(score(cutRandom(train, F, n, r), cutRandom(heldA, F, fires(heldA, F), r), cutRandom(heldB, F, fires(heldB, F), r)).retro);
  const reach = nulls.filter((x) => x >= real.retro).length, mean = nulls.reduce((a, b) => a + b, 0) / nulls.length;
  console.log(`${F.padEnd(5)} fires ${String(n).padStart(4)}  retroactive ${real.retro.toFixed(0).padStart(7)} bits [${(real.retro / n).toFixed(2)}/firing]  prospective A ${real.pA.toFixed(0).padStart(6)}  B ${real.pB.toFixed(0).padStart(6)}  | null mean ${mean.toFixed(0).padStart(7)}, ${reach} of ${DRAWS} null draws reach it`);
}
// emergent proposals: every word-final string of 1-4 characters (letters, digits, apostrophes), ranked by retroactive bits saved
const suf = new Map(); for (const w of new Set(train)) { const c = [...w]; for (let k = 1; k <= 4 && k < c.length; k++) { const s = c.slice(-k).join(""); suf.set(s, (suf.get(s) ?? 0) + 1); } }
const cands = [...suf.entries()].filter(([, n]) => n >= 20).map(([s]) => s), ranked = []; for (const s of cands) { const n = fires(train, s); if (n >= 20) ranked.push({ s, n, g: gain(train, cutAll(train, s)).gain }); }
ranked.sort((a, b) => b.g - a.g); const top = ranked.slice(0, 25);
console.log(`\nEMERGENT: ${ranked.length} word-final strings tried as cuts (no gold, no treebank); top 25 by retroactive bits saved:`);
console.log(top.map((x, i) => `${String(i + 1).padStart(2)}. ${JSON.stringify(x.s)} ${x.g.toFixed(0)}`).join("   "));
const rank = (F) => { const i = ranked.findIndex((x) => x.s === F); return i < 0 ? "not tried" : `#${i + 1} of ${ranked.length}`; };
console.log("\nwhere the treebank clitics fall among the emergent candidates:", FORMS.map((F) => `${F} ${rank(F)}`).join(" | "));
