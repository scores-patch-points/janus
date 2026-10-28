// validate-gold-scene2.mjs — validate-gold-scene.mjs (unchanged) plus the POLARITY field the second scene lens asks for: every statement carries `polarity` in {affirmed, negated, former, other}.
//   node validate-gold-scene2.mjs --text <window> --ledger <ledger.json> --gold <gold.json>
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { extract } from "./extract-kin.mjs";
import { loadPriors } from "./bind-kin2.mjs";
import { validateGold } from "./validate-gold-scene.mjs";
export const POLARITIES = ["affirmed", "negated", "former", "other"];
export function validateGold2(args) {
  const bad = validateGold(args);
  if (Array.isArray(args.gold.statements)) args.gold.statements.forEach((g, i) => { if (!POLARITIES.includes(g.polarity)) bad.push(`statement ${i}: polarity must be one of ${POLARITIES.join(", ")}`); });
  return bad;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
  const priors = loadPriors(), text = fs.readFileSync(arg("text"), "utf8"), ledger = JSON.parse(fs.readFileSync(arg("ledger"), "utf8")), gold = JSON.parse(fs.readFileSync(arg("gold"), "utf8"));
  const bad = validateGold2({ gold, text, ledger, extraction: extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts }) });
  console.log(bad.length ? bad.join("\n") : "OK: the gold is well-formed"); process.exit(bad.length ? 1 : 0);
}
