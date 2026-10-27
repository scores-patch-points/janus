// kin-lexicon.mjs — read the kinship lexicon FROM THE GIVER (the Wiktionary slim), not from a typed word list.
//   node kin-lexicon.mjs <slimDir> <outJson>
// What is declared here (the ONE hand-typed list in G1-2, filed as a candidate class, not a verdict): the twelve atomic English
// headwords and, for each, the phrase its giver gloss must contain before the atom is accepted. The headword names the
// relation schema (parent_of, sibling_of, spouse_of + sex); a giver gloss that lacks the anchor REFUSES the atom.
// Everything else is read: composite terms by one gloss frame ("The A [or A'] of one's B"), Russian terms by their giver gloss
// (a Russian noun whose first sense is a single English word that is a kin term).
import fs from "node:fs"; import zlib from "node:zlib"; import crypto from "node:crypto";

export const ATOMS = {
  // term: [relation, which end the term names, sex of that end, phrase the giver's gloss must contain]
  father:  ["parent_of", "a", "male",   /\bmale parent\b/i],
  mother:  ["parent_of", "a", "female", /\bfemale parent\b/i],
  parent:  ["parent_of", "a", null,     /\braises a child\b/i],
  son:     ["parent_of", "b", "male",   /\bmale offspring\b/i],
  daughter:["parent_of", "b", "female", /\bfemale offspring\b/i],
  child:   ["parent_of", "b", null,     /\boffspring\b/i],
  brother: ["sibling_of", "a", "male",  /\bof the same parents\b|\bmale having at least one parent in common\b/i],
  sister:  ["sibling_of", "a", "female",/\bfemale sibling\b/i],
  sibling: ["sibling_of", "a", null,    /\bshares a parent\b/i],
  husband: ["spouse_of", "a", "male",   /\bman in a marriage\b/i],
  wife:    ["spouse_of", "a", "female", /\bmarried woman\b/i],
  spouse:  ["spouse_of", "a", null,     /\bin a marriage\b/i],
};
// the composite frame: "The brother or brother-in-law of one's parent."  /  "A father of someone's parent."
const FRAME = /^(?:A|An|The)\s+([a-z-]+)(?:\s+or\s+([a-z-]+))?\s+of\s+(?:one[’']s|someone[’']s|a person[’']s)\s+([a-z-]+)\.?$/i;

const D = process.argv[2], OUT = process.argv[3];
if (import.meta.url === `file://${process.argv[1]}`) {
  const man = JSON.parse(fs.readFileSync(D + "/manifest.json", "utf8"));
  const en = new Map(), ru = [], ruOf = new Map();
  let n = 0;
  for (const c of man.chunks) {
    const txt = zlib.brotliDecompressSync(fs.readFileSync(`${D}/chunks/${c.sha256}.br`)).toString("utf8");
    for (const line of txt.split("\n")) {
      if (!line) continue;
      const isRu = line.includes('"tag":"ru"'), isEn = line.includes('"tag":"en"');
      if (!isRu && !isEn) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      for (const e of o.e || []) {
        if (e.tag === "ru" && e.p === "noun" && e.s && e.s[0] && e.s[0].of && !ruOf.has(o.w)) ruOf.set(o.w, e.s[0].of.normalize("NFC").replace(/\u0301/g, ""));
        if (e.p !== "noun") continue;
        const s1 = (e.s || [])[0]; if (!s1 || !s1.g || !s1.g[0]) continue;
        if (e.tag === "en") { if (!en.has(o.w)) en.set(o.w, { gloss: s1.g[0], all: e.s.map((s) => (s.g || [])[0]).filter(Boolean) }); }
        else if (e.tag === "ru") ru.push({ w: o.w, gloss: s1.g[0], all: e.s.map((s) => (s.g || [])[0]).filter(Boolean) });
      }
    }
    if (++n % 200 === 0) console.error("chunks", n);
  }
  // atoms, each audited against the giver's own gloss (any noun sense)
  const atoms = {}, refused = [];
  for (const [term, [rel, end, sex, anchor]] of Object.entries(ATOMS)) {
    const e = en.get(term); const hit = e && e.all.findIndex((g) => anchor.test(g));
    if (e && hit >= 0) atoms[term] = { rel, end, sex, giver: "wiktionary-en", sense: hit, witness: e.all[hit] };
    else refused.push({ term, reason: e ? "gloss_lacks_anchor" : "no_entry", gloss: e?.all?.[0] ?? null });
  }
  // composites: every English noun entry whose FIRST sense fits the frame and whose heads are atoms
  const composites = {}, unparsed = [];
  for (const [term, e] of en) {
    const m = e.gloss.match(FRAME); if (!m || atoms[term]) continue;
    const [, t1, t2, t3] = m.map((x) => x && x.toLowerCase());
    if (!atoms[t3]) continue;                       // the 'of' term must be an atom (parent, child, sibling, ...)
    const alts = [t1, t2].filter(Boolean).map((t) => atoms[t] ? { head: t, evaluable: true } : { head: t, evaluable: false, gap: "alternative_not_atomic" });
    if (!alts.some((a) => a.evaluable)) continue;
    composites[term] = { head_of: t3, alternatives: alts, giver: "wiktionary-en", witness: e.gloss };
  }
  // Russian: first noun sense whose gloss is a single English word that is an atom or a composite
  const ruTerms = {};
  for (const r of ru) {
    const g = r.gloss.trim().toLowerCase(); if (!/^[a-z-]+$/.test(g)) continue;
    const kind = atoms[g] ? "atom" : composites[g] ? "composite" : null; if (!kind) continue;
    // keep the first entry per Russian word (multiple entries of one word: first sense of the first entry wins)
    if (!ruTerms[r.w]) ruTerms[r.w] = { en: g, kind, giver: "wiktionary-en", witness: r.gloss };
  }
  // kin words in the English giver whose gloss is not a frame (cousin, nephew list-form): typed gaps, not guessed
  // forms: a Russian word whose giver sense is "form of L" (stress marks stripped), for L a kin lemma; one more hop for diminutives of forms
  const unruledEn = new Set(["cousin", "nephew", "niece", "brother-in-law", "sister-in-law"]);
  for (const r of ru) {
    const g = r.gloss.trim().toLowerCase();
    if (!ruTerms[r.w] && unruledEn.has(g)) ruTerms[r.w] = { en: g, kind: "unruled", giver: "wiktionary-en", witness: r.gloss };
  }
  const forms = {};
  for (const [w, lem] of ruOf) { let l = lem; if (!ruTerms[l] && ruOf.has(l)) l = ruOf.get(l); if (ruTerms[l] && !ruTerms[w]) forms[w] = l; }
  for (const w of Object.keys(ruTerms)) forms[w] = w;
  const noRule = ["cousin", "nephew", "niece", "grandson", "granddaughter", "grandfather", "grandmother", "brother-in-law", "sister-in-law"]
    .filter((t) => en.has(t) && !composites[t]).map((t) => ({ term: t, gap: "no_rule_giver", gloss: en.get(t).gloss }));
  const out = { schema: "KinLexicon@1", slim_manifest_sha256: crypto.createHash("sha256").update(fs.readFileSync(D + "/manifest.json")).digest("hex"),
    atoms, atoms_refused: refused, composites, russian: ruTerms, russian_forms: forms, no_rule_giver_probe: noRule, counts: { en_nouns: en.size, ru_nouns: ru.length, atoms: Object.keys(atoms).length, composites: Object.keys(composites).length, russian: Object.keys(ruTerms).length, russian_forms: Object.keys(forms).length } };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.counts), JSON.stringify(refused));
}
