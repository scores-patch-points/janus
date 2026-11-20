// eot-read.mjs: the LAYERED codec reader (REFERENT-FIRST rules 11, 12, 13). text -> the language's codec -> [learned clitic split] -> UD rows -> [declared derivations] -> EOT. nl-eot.mjs `read` is unchanged (its hash is frozen under pre-registered experiments); this is the reader that applies tokenizer rules and derivations that are DATA with named givers, scoped by language, falsified on held-out corpora and revisable by replacing the data.
//   readFromLog(door, G, text)      the rules are read from the shared log (rule-entries.mjs); nothing is read from or written to a file
//   readLayered(G, text, { clitics, derivations })  -> { records, rows, gaps }: each EOT record carries `derivations`, the list of what was derived and from what
// No regex, no word list, no model. The structure tests read dependency labels and parts of speech the parser gave; no string is compared.
import { analyse } from "../../../khora/native/adapters/text/ud-parser.js";
import { tokenize, sentences } from "../../../khora/native/adapters/text/ud-tokenizer.js";
import { toEot } from "../../../khora/native/kernel/eot-rich.js";
import { splitTokens } from "./clitic-split.mjs"; import { rulesFromDoor } from "./rule-entries.mjs";
/** readFromLog(door, G, text, { variety }): the rules come from the SHARED LOG (rule-entries.mjs): Penelope's DEF and EVA entries, read through the door. No file is read for them and none is written. A door that is off, or a language with no surviving rule, gives typed gaps and nothing is split or derived. */
export function readFromLog(door, G, text, { variety = null, locale = "und" } = {}) { const r = rulesFromDoor(door, { language: G?.code, variety }); const out = readLayered(G, text, { clitics: r.clitics, derivations: r.derivations, locale }); out.gaps.push(...r.gaps); return out; }
const base = (d) => { const s = String(d ?? ""), i = s.indexOf(":"); return i < 0 ? s : s.slice(0, i); }, subtype = (d) => { const s = String(d ?? ""), i = s.indexOf(":"); return i < 0 ? null : s.slice(i + 1); };
const parseFeats = (s) => { const m = new Map(); if (typeof s !== "string" || s === "_" || s === "") return m; for (const part of s.split("|")) { const i = part.indexOf("="); if (i > 0) m.set(part.slice(0, i), part.slice(i + 1)); } return m; };
const showFeats = (m) => (m.size ? [...m.entries()].sort((a, b) => (a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("|") : "_");
const matches = (spec, row) => (!spec.deprel || (base(row.deprel) === spec.deprel.base && (spec.deprel.subtype == null || subtype(row.deprel) === spec.deprel.subtype))) && (!spec.upos || row.upos === spec.upos);
/** applyDerivations(rows, derivations, code) -> { rows, applied }: add the data rules' features; never overwrite a parser feature (a conflict is listed with applied:false) */
export function applyDerivations(rows, derivations, code) {
  const applied = [], out = rows.map((r) => ({ ...r }));
  for (const rule of derivations?.rules ?? []) {
    if (!rule.languages.includes(code)) continue;
    for (const h of out) { if (!matches(rule.host, h)) continue; const dep = out.find((d) => d.head === h.id && matches(rule.dependent, d)); if (!dep) continue;
      const f = parseFeats(h.feats); for (const [k, v] of Object.entries(rule.add)) { if (f.has(k) && f.get(k) !== v) { applied.push({ rule: rule.id, giver: rule.giver, row: h.id, from: dep.id, add: `${k}=${v}`, applied: false, conflict: `${k}=${f.get(k)}` }); continue; } if (f.get(k) === v) continue; f.set(k, v); applied.push({ rule: rule.id, giver: rule.giver, row: h.id, from: dep.id, add: `${k}=${v}`, applied: true }); }
      h.feats = showFeats(f); }
  }
  return { rows: out, applied };
}
/** reconstruct(result) -> the original text, VERBATIM, from the records alone: each record carries the gap that preceded its sentence (`surface.before`) and the result carries the `tail`. Nothing is lost: a reader whose records cannot reproduce their source is refused (see verifyVerbatim). */
export const reconstruct = (out) => out.records.map((r) => (r.surface.before ?? "") + r.surface.text).join("") + (out.tail ?? "");
/** verifyVerbatim(text, out) -> { ok, why }: the records rebuild the text exactly; every sentence span slices back to its own text; every token span slices back to its token (UTF-16 units) */
export function verifyVerbatim(text, out) {
  if (reconstruct(out) !== text) return { ok: false, why: "reconstruct(records) is not the original text" };
  for (const r of out.records) { const [a, b] = r.surface.span ?? []; if (text.slice(a, b) !== r.surface.text) return { ok: false, why: `span ${a}-${b} does not slice back to the sentence text` }; for (const [i, sp] of Object.entries(r.surface.tokenSpans ?? {})) if (sp && text.slice(sp[0], sp[1]).length === 0) return { ok: false, why: `token ${i} span is empty` }; }
  return { ok: true, why: null };
}
export function readLayered(G, text, { clitics = null, derivations = null, locale = "und" } = {}) {
  const gaps = [], records = [], allRows = []; let cur = 0;
  if (!G || G.gap) return { gap: G?.gap ?? "no_grammar", records, rows: allRows, gaps, tail: text }; if (!G.parser) return { gap: "parser_absent", records, rows: allRows, gaps, tail: text };
  if (!clitics || clitics.gap) gaps.push({ gap: "no_clitic_rules", why: clitics?.why ?? "no clitic rules were handed to the reader" });
  if (!derivations) gaps.push({ gap: "no_derivations", why: "no derivation rules were handed to the reader" });
  for (const s of sentences(text, locale, G.tokenizer)) {
    let forms = tokenize(s, G.tokenizer); if (!forms.length) continue; if (clitics && !clitics.gap) forms = splitTokens(forms, clitics);
    const at = text.indexOf(s, cur); if (at < 0) { gaps.push({ gap: "span_unaligned", why: "a sentence could not be found in the text: its record cannot be addressed and verbatim reconstruction is not guaranteed" }); continue; }
    const tokenSpans = {}; { let c = at; forms.forEach((f, i) => { const j = text.indexOf(f, c); if (j >= 0 && j < at + s.length) { tokenSpans[i + 1] = [j, j + f.length]; c = j + f.length; } else tokenSpans[i + 1] = null; }); }
    const parsed = analyse(G.parser, forms).map((r) => ({ ...r, head: r.head < 0 ? 0 : r.head })), { rows, applied } = applyDerivations(parsed, derivations, G.code);
    const rec = toEot({ tokens: rows, lines: [], comments: [], multi: [], empty: [], sentId: null, text: s }, { language: G.code });
    // ADDRESS AND GAP: the sentence's span in the document (UTF-16 units), each token's span, and the text between the previous sentence and this one, so the records alone rebuild the source verbatim
    records.push({ ...rec, surface: { ...rec.surface, span: [at, at + s.length], before: text.slice(cur, at), tokenSpans, unit: "utf16" }, derivations: applied }); allRows.push({ text: s, forms, rows, derivations: applied }); cur = at + s.length;
  }
  return { records, rows: allRows, gaps, tail: text.slice(cur) };
}
