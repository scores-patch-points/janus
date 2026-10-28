// build-person-lexicon.mjs — read the PERSON of Russian possessives and personal pronouns FROM THE GIVER (the Wiktionary slim), not from a typed word list.
//   node build-person-lexicon.mjs <slimDir> <outJson>
// What is declared here (the ONE hand-typed list of this builder, filed as a candidate class and audited by the giver's own gloss, like ATOMS in kin-lexicon.mjs):
// the English anchor word that opens a giver gloss and the grammatical person it names. A Russian pronoun entry (p = "pron") is admitted only when its FIRST gloss opens with
// an anchor ("your, yours" -> second person; "my, mine" -> first; "her, its" -> third; "one's own; my, his, her ..." -> reflexive); a Russian word whose giver sense is
// "form of L" for an admitted L inherits L's row (one more hop for nothing else). The kin binder (bind-kin.mjs) reads the table; it never types a pronoun.
import fs from "node:fs"; import zlib from "node:zlib"; import crypto from "node:crypto"; import { pathToFileURL } from "node:url";

export const ANCHORS = [
  // [opening of the first gloss, person, kind]   (order matters: first match wins)
  [/^one[’']s own\b/i, "refl", "possessive"],
  [/^(my|mine)\b/i, 1, "possessive"],
  [/^our\b/i, 1, "possessive"],
  [/^(your|yours|thy|thine)\b/i, 2, "possessive"],
  [/^(his|her|hers|its|their|theirs)\b/i, 3, "possessive"],
  [/^I\b/, 1, "personal"],
  [/^we\b/i, 1, "personal"],
  [/^(you|thou)\b/i, 2, "personal"],
];
const NUMBER = [[/^(my|mine|your, yours, thy|thy|thine|I|thou)\b/i, "sg"], [/^(our|we)\b/i, "pl"]];

const D = process.argv[2], OUT = process.argv[3];
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const man = JSON.parse(fs.readFileSync(D + "/manifest.json", "utf8"));
  const strip = (s) => s.normalize("NFC").replace(/́/g, "");
  const rows = new Map(), ofLink = new Map();
  for (const c of man.chunks) {
    const txt = zlib.brotliDecompressSync(fs.readFileSync(`${D}/chunks/${c.sha256}.br`)).toString("utf8");
    for (const line of txt.split("\n")) {
      if (!line || !line.includes('"tag":"ru"')) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      for (const e of o.e || []) {
        if (e.tag !== "ru" || e.p !== "pron") continue;
        const w = strip(o.w), s1 = (e.s || [])[0]; if (!s1) continue;
        if (s1.of && !ofLink.has(w)) ofLink.set(w, strip(s1.of));
        const g = (s1.g || [])[0]; if (!g) continue;
        const hit = ANCHORS.find(([re]) => re.test(g)); if (!hit || rows.has(w)) continue;
        const num = NUMBER.find(([re]) => re.test(g)); rows.set(w, { person: hit[1], kind: hit[2], number: num ? num[1] : null, giver: "wiktionary-en", witness: g });
      }
    }
  }
  const forms = {};
  for (const [w, r] of rows) forms[w] = { ...r, lemma: w };
  for (const [w, l] of ofLink) if (!forms[w] && rows.has(l)) forms[w] = { ...rows.get(l), lemma: l, witness: `form of ${l}: ${rows.get(l).witness}` };
  const out = { schema: "PersonLexicon@1", slim_manifest_sha256: crypto.createHash("sha256").update(fs.readFileSync(D + "/manifest.json")).digest("hex"),
    provenance: { giver: "Wiktionary (slim), Russian pron entries", builder: "scripts/kinship/build-person-lexicon.mjs", note: "person read from the giver's first gloss by a declared anchor class (candidate, audited by the gloss): a pronoun with no anchor in its first gloss is absent, never guessed" },
    forms: Object.fromEntries(Object.keys(forms).sort().map((k) => [k, forms[k]])), counts: { admitted_lemmas: rows.size, forms: Object.keys(forms).length } };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const byP = {}; for (const f of Object.values(forms)) { const k = `${f.kind}:${f.person}`; byP[k] = (byP[k] ?? 0) + 1; }
  console.log(JSON.stringify(out.counts), JSON.stringify(byP));
}
