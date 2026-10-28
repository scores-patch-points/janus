// feed-diminutives.mjs — resolve diminutive-of rows against a HyperlexiconBin store and write priors/diminutive-rus.json (DiminutivePrior@1).
//   node scripts/hyperlexicon/feed-diminutives.mjs <rows.json> <store dir> [out.json]
// Input rows are {from, to, relation, lang, form, witness{file, sha256, offset, unit, text}}: each taken from Wiktionary's own given-name
// `dimof=` argument (or free text), the template quoted verbatim as the witness. A row is kept only when BOTH ends are Russian lemma nodes
// the givers write as a NAME; anything else is a typed gap carrying the quoted witness, never mapped to a guess:
//   diminutive_not_a_ru_name_node · base_not_a_ru_node · base_not_a_name (Вадим > вадить) · ambiguous_node (more than one name node).
// A variant base is a second row; a chain is separate rows; no transitive closure is stored.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { openHyperlexiconBin } from "../../native/organs/hyperlexicon/bin.mjs";

const [rowsFile, storeDir, outFile = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "priors", "diminutive-rus.json")] = process.argv.slice(2);
if (!rowsFile || !storeDir) { console.error("usage: feed-diminutives.mjs <rows.json> <store dir> [out.json]"); process.exit(2); }
const hl = openHyperlexiconBin(storeDir), input = fs.readFileSync(rowsFile);
const rows = JSON.parse(input).rows, lang = "ru";
const nfc = (s) => s.normalize("NFC");
const surfaces = [...new Set(rows.flatMap((r) => [nfc(r.from), nfc(r.to)]))];
const names = hl.answer({ op: "names", surfaces, lang }).surfaces;
/** The lemma nodes the givers write for a surface in Russian: all of them, and those among them that are names. */
const nodesOf = (s) => { const lem = (names[s]?.written ?? []).filter((w) => w.kind === "lemma"); return { lemma: lem, names: lem.filter((w) => w.pos.includes("name")) }; };
const kept = [], gaps = [];
for (const r of rows) {
  const f = nodesOf(nfc(r.from)), t = nodesOf(nfc(r.to)), base = { from: nfc(r.from), to: nfc(r.to), relation: r.relation, form: r.form, witness: r.witness };
  const gap = !f.names.length ? "diminutive_not_a_ru_name_node" : !t.lemma.length ? "base_not_a_ru_node" : !t.names.length ? "base_not_a_name" : f.names.length > 1 || t.names.length > 1 ? "ambiguous_node" : null;
  if (gap) { gaps.push({ ...base, gap, ...(gap === "ambiguous_node" ? { candidates: { from: f.names.map((w) => w.node), to: t.names.map((w) => w.node) } } : {}) }); continue; }
  kept.push({ from: { surface: base.from, node: f.names[0].node }, to: { surface: base.to, node: t.names[0].node }, relation: r.relation, giver: "wiktionary-en", form: r.form, witness: r.witness });
}
const out = {
  schema: "DiminutivePrior@1", language: "rus",
  provenance: { giver: "English Wiktionary (given-name entries, wikitext), the diminutive-of rows extracted from the `dimof=` argument or the entry's free text, each quoted verbatim as its witness",
    input: { file: path.basename(rowsFile), sha256: crypto.createHash("sha256").update(input).digest("hex"), rows: rows.length }, store: { from_v1_head: hl.head },
    rule: "kept only when both ends are Russian lemma nodes the givers write as a name; otherwise a typed gap with the quoted witness; a variant base is a second row; a chain is separate rows with no stored closure",
    not_claimed: "that a row is a true relation beyond what the giver wrote; reverse (base to diminutive) lookups; kinship" },
  counts: { rows: kept.length, gaps: gaps.length, byGap: gaps.reduce((a, g) => ((a[g.gap] = (a[g.gap] ?? 0) + 1), a), {}) },
  rows: kept, gaps,
};
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.counts), "->", outFile);
