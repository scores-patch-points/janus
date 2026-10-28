// fill-quote-at-scene.mjs — fill `quoteAt` of a scene gold mechanically from its `quote` pieces: the byte span of the occurrence in the window nearest the statement's kin word. Changes no label.
//   node fill-quote-at-scene.mjs --text <window> --gold <gold.json> --out <gold-with-quoteAt.json>
import fs from "node:fs";
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const text = fs.readFileSync(arg("text"), "utf8"), gold = JSON.parse(fs.readFileSync(arg("gold"), "utf8")), buf = Buffer.from(text);
const byteAt = (c) => Buffer.byteLength(text.slice(0, c));
for (const g of gold.statements) for (const e of ["holder", "possessor"]) { const x = g[e]; if (!x || !x.quote) continue; x.quoteAt = [];
  for (const piece of x.quote.split(" … ")) { const q = piece.trim(); if (!q) continue; let best = null, at = -1; while ((at = text.indexOf(q, at + 1)) >= 0) { const b = byteAt(at), d = Math.abs(b - g.termSpan[0]); if (best === null || d < best.d) best = { b, d, e: b + Buffer.byteLength(q) }; }
    if (best) x.quoteAt.push([best.b, best.e]); } }
fs.writeFileSync(arg("out"), JSON.stringify(gold, null, 1) + "\n"); console.log("filled", gold.statements.length);
