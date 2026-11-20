// rule-entries.mjs: READ the rules other systems wrote on the shared log, and turn them into what the codec reader applies. Janus does not write these entries: a rule is a DEF (Pattern grain: a standing prior with a named giver) and a falsification verdict is an EVA: both Penelope's.
//   tokenizer-rule     DEF·Pattern  body { language, variety, period, effect: "split", position: "suffix", form, giver: { kind, name, ... }, standing, evidence: [entry ids] }
//   tokenizer-variant  DEF·Pattern  body { language, from, to: [...], giver }              (a declared equivalence such as the typographic apostrophe)
//   rule-verdict       EVA·Pattern  body { rule: <addr of the tokenizer-rule>, status: survived | refuted | underexposed | unexposed, alpha, upTo, evidence: [ids] }   (the LATEST verdict for a rule, in log order, stands)
//   derivation-rule    DEF·Pattern  body { id, languages, host, dependent, add, giver, standing }
// A rule is IN FORCE only when its latest verdict is `survived`; no verdict, or any other, leaves it as data and untouched. An entry in the wrong cell, with no named giver, no language or no standing is REFUSED and listed, never silently used. Pure: entries in, rules out; nothing is read from or written to a file.
export const RULE_CELLS = Object.freeze({ "tokenizer-rule": "DEF·Pattern", "tokenizer-variant": "DEF·Pattern", "rule-verdict": "EVA·Pattern", "derivation-rule": "DEF·Pattern" });
export const RULE_KINDS = Object.freeze(Object.keys(RULE_CELLS));
const okGiver = (g) => g && typeof g.name === "string" && g.name && typeof g.kind === "string" && g.kind, okStanding = (s) => s === "given" || s === "candidate";
/** cliticRulesFrom(entries, { language, variety }) -> { rules, apostropheVariants, refused, verdicts }: the shape clitic-split.mjs applies. variety null matches only a rule with no variety (never silently the nearest variety). */
export function cliticRulesFrom(entries, { language, variety = null } = {}) {
  const refused = [], rules = [], verdict = new Map(); let variants = null;
  for (const e of entries ?? []) {
    if (!RULE_KINDS.includes(e?.kind)) continue; if (e.cell !== RULE_CELLS[e.kind]) { refused.push({ id: e.id ?? e.addr, why: `${e.kind} must be at ${RULE_CELLS[e.kind]}, not ${e.cell}` }); continue; }
    const b = e.body ?? {}; if (b.language !== undefined && b.language !== language) continue;
    if (e.kind === "rule-verdict") { if (typeof b.rule === "string" && typeof b.status === "string") verdict.set(b.rule, { status: b.status, alpha: b.alpha ?? null, id: e.id ?? e.addr }); continue; }
    if (e.kind === "tokenizer-variant") { if (!okGiver(b.giver) || !b.from || !Array.isArray(b.to)) { refused.push({ id: e.id ?? e.addr, why: "a variant needs from, to and a named giver" }); continue; } variants = { from: b.from, to: b.to, giver: b.giver }; continue; }
    if (e.kind !== "tokenizer-rule") continue;
    if (b.language !== language) continue; if ((b.variety ?? null) !== (variety ?? null)) continue;
    if (!okGiver(b.giver) || !okStanding(b.standing) || b.effect !== "split" || b.position !== "suffix" || typeof b.form !== "string" || !b.form) { refused.push({ id: e.id ?? e.addr, why: "a tokenizer rule needs a named giver, a standing, effect split, position suffix and a form" }); continue; }
    rules.push({ addr: e.addr ?? e.id, form: b.form, giver: b.giver, standing: b.standing, period: b.period ?? null, kept: true, status: null });
  }
  for (const r of rules) { const v = verdict.get(r.addr); r.status = v ? v.status : null; r.verdictId = v?.id ?? null; }
  return { rules, apostropheVariants: variants, refused, verdicts: verdict.size };
}
/** derivationsFrom(entries) -> { rules, refused }: the derivation-rule entries a reader applies (applyDerivations in eot-read.mjs) */
export function derivationsFrom(entries) {
  const rules = [], refused = [];
  for (const e of entries ?? []) { if (e?.kind !== "derivation-rule") continue; if (e.cell !== RULE_CELLS["derivation-rule"]) { refused.push({ id: e.id ?? e.addr, why: `derivation-rule must be at DEF·Pattern, not ${e.cell}` }); continue; } const b = e.body ?? {};
    if (!b.id || !okGiver(b.giver) || !Array.isArray(b.languages) || !b.languages.length || !okStanding(b.standing) || !b.host || !b.dependent || !b.add) { refused.push({ id: e.id ?? e.addr, why: "a derivation needs an id, a named giver, language scope, standing, host, dependent and add" }); continue; } rules.push(b); }
  return { rules, refused };
}
/** rulesFromDoor(door, { language, variety }) -> { clitics, derivations, gaps }: ask the log for the rule kinds; a door that is off, or no entries, is a typed gap and the reader applies nothing */
export function rulesFromDoor(door, { language, variety = null } = {}) {
  if (!door?.on) return { clitics: { gap: "no_clitic_rules", why: door?.why ?? "no door" }, derivations: null, gaps: [{ gap: "no_door", why: door?.why ?? "no door" }] };
  const entries = door.ask(RULE_KINDS); if (!entries) return { clitics: { gap: "no_clitic_rules", why: "the log could not be read" }, derivations: null, gaps: [{ gap: "log_unreadable" }] };
  const c = cliticRulesFrom(entries, { language, variety }), d = derivationsFrom(entries).rules.filter((r) => r.languages.includes(language)), gaps = [];
  if (!c.rules.some((r) => r.status === "survived")) gaps.push({ gap: "no_clitic_rules", why: `no tokenizer rule for ${language}${variety ? "/" + variety : ""} has a surviving verdict on the log: no clitic is split` });
  return { clitics: c.rules.some((r) => r.status === "survived") ? { ...c, giver: { kind: "log", name: "pharos tokenizer-rule entries" }, standing: "candidate", sources: [{ sha256: "from-log" }] } : { gap: "no_clitic_rules", why: gaps[0].why }, derivations: { rules: d }, gaps, refused: c.refused };
}
