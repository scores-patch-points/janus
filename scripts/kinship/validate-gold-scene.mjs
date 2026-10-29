// validate-gold-scene.mjs — the STRUCTURAL check of a scene gold (KinSceneGold@1): form, closed sets, quotes that read back. It never checks the truth of a label.
//   node validate-gold-scene.mjs --text <window> --ledger <ledger.json> --gold <gold.json>
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { extract } from "./extract-kin.mjs";
import { loadPriors } from "./bind-kin2.mjs";
import { paragraphsOf } from "./scene-kin.mjs";
export const KINDS = ["apposition", "genitive", "pronoun", "reflexive", "deictic", "subject", "discourse", "scene"];
export const WHYS = ["generic", "unnamed", "not_in_ledger"], DIRECTIONS = ["same_sentence", "before", "after"];
export function validateGold({ gold, text, ledger, extraction }) {
  const bad = [], buf = Buffer.from(text), beings = new Set(ledger.referents.filter((r) => r.standing === "referent").map((r) => r.id)), paras = paragraphsOf(text);
  if (gold.schema !== "KinSceneGold@1") bad.push("schema");
  if (!Array.isArray(gold.scene_breaks) || !gold.scene_breaks.every((n) => Number.isInteger(n) && n > 0 && n < paras.length) || gold.scene_breaks.some((n, i, a) => i && n <= a[i - 1])) bad.push("scene_breaks: strictly increasing integers in 1..paragraphs-1");
  const headingParas = new Set(paras.filter((p) => p.heading && p.idx > 0).map((p) => p.idx)); for (const h of headingParas) if (!gold.scene_breaks.includes(h)) bad.push(`scene_breaks: the first paragraph after a chapter heading (${h}) must start a scene`);
  if (!Array.isArray(gold.statements) || gold.statements.length !== extraction.stmts.length) { bad.push(`statements: ${gold.statements?.length} for ${extraction.stmts.length}`); return bad; }
  const nScenes = gold.scene_breaks.length + 1;
  gold.statements.forEach((g, i) => {
    const s = extraction.stmts[i], at = `statement ${i}`;
    if (g.i !== i) bad.push(`${at}: i`); if (g.term !== s.en) bad.push(`${at}: term`); if (JSON.stringify(g.termSpan) !== JSON.stringify(s.span)) bad.push(`${at}: termSpan`);
    if (!Number.isInteger(g.scene) || g.scene < 0 || g.scene >= nScenes) bad.push(`${at}: scene`);
    for (const e of ["holder", "possessor"]) { const x = g[e]; if (!x) { bad.push(`${at}: ${e} missing`); continue; }
      if (x.ref) { if (!beings.has(x.ref)) bad.push(`${at}.${e}: ref not a ledger being`); if (!KINDS.includes(x.kind)) bad.push(`${at}.${e}: kind`); if (!DIRECTIONS.includes(x.direction)) bad.push(`${at}.${e}: direction`); }
      else { if (x.ref !== null) bad.push(`${at}.${e}: ref must be a being id or null`); if (!WHYS.includes(x.why)) bad.push(`${at}.${e}: why`); }
      if (x.ref && (typeof x.quote !== "string" || !x.quote)) bad.push(`${at}.${e}: a bound end needs a quote`);
      if (typeof x.quote === "string" && x.quote) for (const piece of x.quote.split(" … ")) if (!text.includes(piece.trim())) bad.push(`${at}.${e}: quote piece does not read back: ${piece.slice(0, 40)}`);
      if (x.quoteAt) for (const q of x.quoteAt) if (!(Array.isArray(q) && q[0] >= 0 && q[1] <= buf.length && q[0] < q[1])) bad.push(`${at}.${e}: quoteAt`); }
    if (g.holder?.ref && g.holder.ref === g.possessor?.ref && !(g.holder.doubtful && g.possessor.doubtful)) bad.push(`${at}: both ends one ledger referent (allowed only with both ends flagged doubtful: a ledger merge)`);
  });
  return bad;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
  const priors = loadPriors(), text = fs.readFileSync(arg("text"), "utf8"), ledger = JSON.parse(fs.readFileSync(arg("ledger"), "utf8")), gold = JSON.parse(fs.readFileSync(arg("gold"), "utf8"));
  const bad = validateGold({ gold, text, ledger, extraction: extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts }) });
  console.log(bad.length ? bad.join("\n") : "OK: the gold is well-formed"); process.exit(bad.length ? 1 : 0);
}
