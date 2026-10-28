// polarity-lexicon.mjs — read the POLARITY CUES of Russian FROM THE GIVER (the Wiktionary slim), not from a typed word list.
//   node polarity-lexicon.mjs <slimDir> <outJson>
// What is declared here (the second and last hand-typed list of G1-2's kin work, filed as a candidate class, not a verdict, exactly as kin-lexicon.mjs declares its atoms): two ANCHOR PHRASES an English gloss must open with, and the parts of speech
// that may carry them. A Russian single-word entry whose FIRST sense's first gloss opens with the negation anchor and whose part of speech is a particle, adverb, preposition, conjunction or interjection is a NEGATION cue; an adjective whose first gloss opens
// with the 'former' anchor is a FORMER cue (the relation no longer holds); a negation cue whose gloss also says the thing is absent ("without", "there is no") is an EXIST cue. Nothing else is read as polarity. The cue words themselves come from the giver; none is typed here.
import fs from "node:fs"; import zlib from "node:zlib"; import crypto from "node:crypto";
export const NEG_ANCHOR = /^(not|no|never|without|neither|nor|there (?:is|are) (?:not|no))\b/i;
export const EXIST_ANCHOR = /^(without|there (?:is|are) (?:not|no))\b/i;   // of the negation cues, those whose gloss says the thing is ABSENT (an existential or privative cue), which negate a relation in any case
export const FORMER_ANCHOR = /^(former|ex-)/i;
export const NEG_POS = new Set(["particle", "adv", "prep", "conj", "intj"]), FORMER_POS = new Set(["adj"]);
const foldRu = (s) => s.normalize("NFC").toLowerCase().replace(/́/g, "").replace(/ё/g, "е");
if (import.meta.url === `file://${process.argv[1]}`) {
  const D = process.argv[2], OUT = process.argv[3], man = JSON.parse(fs.readFileSync(D + "/manifest.json", "utf8")), forms = {};
  for (const c of man.chunks) {
    const txt = zlib.brotliDecompressSync(fs.readFileSync(`${D}/chunks/${c.sha256}.br`)).toString("utf8");
    for (const line of txt.split("\n")) {
      if (!line || !line.includes('"tag":"ru"')) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      const w = foldRu(o.w ?? ""); if (!w || /[\s-]/.test(w) || !/^\p{Script=Cyrillic}+$/u.test(w)) continue;
      for (const e of o.e || []) {
        if (e.tag !== "ru") continue; const g = ((e.s || [])[0]?.g || [])[0]; if (!g) continue;
        const cue = NEG_POS.has(e.p) && NEG_ANCHOR.test(g) ? (EXIST_ANCHOR.test(g) ? "exist" : "neg") : FORMER_POS.has(e.p) && FORMER_ANCHOR.test(g) ? "former" : null; if (!cue) continue;
        const prev = forms[w]; if (!prev || (prev.cue === "former" && cue !== "former") || (prev.cue === "neg" && cue === "exist")) forms[w] = { cue, pos: e.p, witness: g };
      }
    }
  }
  const sorted = Object.fromEntries(Object.keys(forms).sort().map((k) => [k, forms[k]]));
  const out = { schema: "PolarityLexicon@1", slim_manifest_sha256: crypto.createHash("sha256").update(fs.readFileSync(D + "/manifest.json")).digest("hex"), anchors: { neg: NEG_ANCHOR.source, exist: EXIST_ANCHOR.source, former: FORMER_ANCHOR.source, neg_pos: [...NEG_POS], former_pos: [...FORMER_POS] },
    counts: { neg: Object.values(sorted).filter((x) => x.cue === "neg").length, exist: Object.values(sorted).filter((x) => x.cue === "exist").length, former: Object.values(sorted).filter((x) => x.cue === "former").length }, forms: sorted };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n"); console.log(JSON.stringify(out.counts));
}
