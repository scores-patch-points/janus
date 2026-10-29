// kin-store-rows.mjs — what the HYPERLEXICON STORE (HyperlexiconBin@2, native/organs/hyperlexicon/bin.mjs) holds for the Russian kin terms of priors/kin-lexicon.json, as a derived rows file a scorer can read without the 761 MiB store.
//   node kin-store-rows.mjs --store <HyperlexiconBin@2 dir> --out <rows.json> [--priors <dir>]
// For each kin lemma: its lemma node(s) in the store, and every relation row of the nine types the store keeps (syn, derived, coord, ant, hyper, hypo, holo, mero, diminutive-of) with the target's name(s) and the row's giver, plus the translation links.
// The store keeps NO glosses and, as probed, no converse, sex or generation row for a kin term: those are typed gaps here (`row: "none"`), and the kin table takes them from the givers' glosses the kin lexicon reads. Nothing is added or inferred; deterministic; no model; no network.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { openHyperlexiconBin } from "../../native/organs/hyperlexicon/bin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const storeDir = arg("store"), outPath = arg("out"), priorsDir = arg("priors", path.join(here, "..", "..", "priors"));
if (!storeDir || !outPath) { console.error("usage: node kin-store-rows.mjs --store <dir> --out <rows.json> [--priors <dir>]"); process.exit(2); }
const lexicon = JSON.parse(fs.readFileSync(path.join(priorsDir, "kin-lexicon.json"), "utf8"));
const hl = openHyperlexiconBin(storeDir), M = hl.manifest;
const col = (n, T) => { const b = fs.readFileSync(path.join(storeDir, n)); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const grp = col("names.grp", Uint32Array), nNode = col("names.node", Uint32Array), nLang = col("names.lang", Uint16Array), nKind = col("names.kind", Uint8Array);
const off = col("names.surface.off", BigUint64Array), bin = fs.readFileSync(path.join(storeDir, "names.surface.bin")), ids = col("nodes.id", BigUint64Array);
const nodeIx = (id) => { const want = BigInt("0x" + id.slice(2)); let lo = 0, hi = ids.length; while (lo < hi) { const m = (lo + hi) >>> 1; if (ids[m] < want) lo = m + 1; else hi = m; } return lo; };
const lemmas = Object.keys(lexicon.russian).sort();
const asked = hl.answer({ op: "names", lang: "ru", surfaces: lemmas });
const rows = {}, targets = new Set();
for (const t of lemmas) {
  const nodes = asked.surfaces[t].written.filter((w) => w.kind === "lemma" && w.pos.includes("noun")).map((w) => w.node).sort();
  const rec = { en: lexicon.russian[t].en, nodes, relations: {}, links: [] };
  for (const id of nodes) { const r = hl.answer({ op: "relations", id });
    for (const x of r.relations) { (rec.relations[x.rel] ??= []).push({ to: x.to, giver: x.giver }); targets.add(x.to); }
    for (const x of r.links) { rec.links.push({ kind: x.kind, to: x.to, lang: x.lang, giver: x.giver }); targets.add(x.to); } }
  rows[t] = rec;
}
// the targets' lemma names (a node's lemma surfaces, every language), one pass over the store's names
const want = new Map([...targets].map((id) => [nodeIx(id), id])), names = new Map();
for (let i = 0, n = off.length - 1; i < n; i++) for (let r = grp[i]; r < grp[i + 1]; r++) { const id = want.get(nNode[r]); if (id && M.kinds[nKind[r]] === "lemma") { const s = bin.subarray(Number(off[i]), Number(off[i + 1])).toString("utf8").normalize("NFC"), tag = `${s}/${M.langs[nLang[r]]}`; const a = names.get(id) ?? names.set(id, []).get(id); if (!a.includes(tag)) a.push(tag); } }
for (const rec of Object.values(rows)) { for (const list of Object.values(rec.relations)) for (const x of list) x.names = (names.get(x.to) ?? []).slice().sort(); for (const x of rec.links) x.names = (names.get(x.to) ?? []).slice().sort(); for (const k of Object.keys(rec.relations)) rec.relations[k].sort((a, b) => (a.to < b.to ? -1 : 1)); }
const kinds = ["syn", "ant", "hyper", "hypo", "coord", "mero", "holo", "derived", "diminutive-of"];
const coverage = Object.fromEntries(kinds.map((k) => [k, lemmas.filter((t) => (rows[t].relations[k] ?? []).length).length]));
const out = { schema: "KinStoreRows@1", store_head: hl.head, store_manifest_sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(storeDir, "manifest.json"))).digest("hex"), store_relation_types: M.rels,
  kin_lexicon_sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(priorsDir, "kin-lexicon.json"))).digest("hex"), lemmas: lemmas.length, lemmas_with_a_node: lemmas.filter((t) => rows[t].nodes.length).length,
  coverage_lemmas_with_a_row_of_type: coverage, links_total: lemmas.reduce((a, t) => a + rows[t].links.length, 0), converse_rows: 0, sex_rows: 0, generation_rows: 0,
  note: "the store keeps no gloss, so it holds no converse, sex or generation row for a kin term: those counts are 0 by the store's layout (relation types listed above), not by a failed lookup", terms: rows };
fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify({ lemmas: out.lemmas, with_node: out.lemmas_with_a_node, coverage, links: out.links_total }));
