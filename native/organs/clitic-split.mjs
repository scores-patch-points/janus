// clitic-split.mjs: apply LEARNED clitic split rules (priors/tokenizer-clitics-<code>.json, TokenizerRules@1) to a token list. Pure: no clock, no log, no model, no regex, no word list. The rules are DATA with a named giver, a standing and per-rule evidence; replacing the data revises the tokenizer (REFERENT-FIRST rule 13).
//   splitToken(token, rules) -> [stem, clitic] | null     the first admitted rule (longest form first) whose clitic ends the token, leaving a non-empty stem; the typographic apostrophe variant declared in the rules is matched too
//   splitTokens(tokens, rules) -> tokens                  every token split at most once
//   admitted(rules)                                        the rules IN FORCE: kept by the learner AND status "survived" on a held-out corpus. A rule that is refuted, underexposed or unexposed stays in the data as a candidate and is NOT applied: a corpus can refute a rule and never earn it, and an untested rule does not touch text.
// What it never does: guess a stem, look a word up in a list, or split a rule that is not in the data.
import fs from "node:fs";
export const RULES_SCHEMA = "TokenizerRules@1";
/** loadClitics(file): reads a rules JSON FIXTURE (tests, offline inspection). The reader's rules come from log entries (rule-entries.mjs), never from a file a system wrote for itself. */
export function loadClitics(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8")); if (j.schema !== RULES_SCHEMA) throw new Error(`clitic rules: schema ${j.schema} is not ${RULES_SCHEMA}`);
  if (!j.giver?.name || !j.giver?.kind) throw new Error("clitic rules: no named giver"); if (!Array.isArray(j.sources) || !j.sources.length || !j.sources.every((s) => s.sha256)) throw new Error("clitic rules: no data hash for the treebank they were learned from");
  if (!["given", "candidate"].includes(j.standing)) throw new Error("clitic rules: standing must be given or candidate"); return j;
}
/** the rules in force: each carries `status` from the latest rule-verdict entry (see rule-entries.mjs); only `survived` is applied */
export const admitted = (rules) => (rules?.rules ?? []).filter((r) => r.kept && r.status === "survived").sort((a, b) => b.form.length - a.form.length);
const variantsOf = (rules, form) => { const v = rules.apostropheVariants, out = [form]; if (v && form.includes(v.from)) for (const to of v.to) out.push(form.split(v.from).join(to)); return out; };
export function splitToken(token, rules) {
  for (const r of admitted(rules)) for (const f of variantsOf(rules, r.form)) { const f_ = [...f].length, t_ = [...token]; if (t_.length > f_ && token.endsWith(f)) return [t_.slice(0, t_.length - f_).join(""), f]; }
  return null;
}
export function splitTokens(tokens, rules) { const out = []; for (const t of tokens) { const s = splitToken(t, rules); if (s) out.push(s[0], s[1]); else out.push(t); } return out; }
