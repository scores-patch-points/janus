// organs/constraints.js: PROPERTY CONSTRAINTS exercised on facts. The rules are the declared nature of a relation (one-valued, symmetric, inverse,
// acyclic, requires, conflicts, inverse-functional); the cube reading is penelope experiments/zero-overlap/referent/eot/property-constraints.eot
// (DEF at Ground / Figure / Pattern, checked by an EVA at the same grain). Pure: no model, no network, no file IO; facts and rules are INJECTED.
//
// The law this file keeps (the nomos law, nomos.js and kinship.js): a rule is GIVEN (a named giver: an asker's declare, a property page of a knowledge base) or
// EXTRACTED (derived by a builder from observed material) and never revealed. makeRule REFUSES a rule with no giver. A knowledge base may give or ratify a rule,
// never be required at run time. An unknown kind, or a rule over a relation the facts never use, is a TYPED GAP, not a pass.
//
// What a violation becomes (THEORY-IDENTITY section 16): the four kinds of difference.
//   Conflict    two strong tied values where the rule allows one (a different value, a cycle, a forbidden pair)
//   Silence     the mirrored or required statement is ABSENT: a hole, never a vote
//   Resolution  the values differ but one CONTAINS the other in a declared container order (Topeka in Kansas): narrows, never convicts
// Accidental differences (spelling inside a codec's invariances) never reach this file: the caller folds them before the facts arrive.
// THE CUBE is INJECTED: the cell of a rule (DEF at its grain) and of its check (EVA at the same grain) come from the cellOf the caller passes, which is read through janus's pharos door (pharos-door.mjs: openDoor().cellOf, the pinned lib/cells.mjs). This file imports no other repo. With no cellOf a rule carries def/eva null and grounded:false, which a caller can see on every rule and every violation; nothing is guessed.
export const KINDS = Object.freeze(["single_value", "distinct_values", "symmetric", "inverse", "acyclic", "item_requires", "conflicts_with", "precedes"]);
const NEEDS_OTHER = new Set(["inverse", "item_requires", "conflicts_with", "precedes"]);
export function makeRule({ rel, kind, giver, other = null, source = null, grain = "Figure" }, { cellOf = null } = {}) {
  if (!giver) throw new TypeError("makeRule: a rule names its giver (an asker's declare, a property page, a builder); a rule from no-where is refused");
  if (!rel || !KINDS.includes(kind)) throw new TypeError(`makeRule: kind must be one of ${KINDS.join(", ")}`);
  if (NEEDS_OTHER.has(kind) && !other) throw new TypeError(`makeRule: ${kind} names the other relation`);
  let def = null, eva = null;
  if (cellOf) { def = cellOf("DEF", grain); eva = cellOf("EVA", grain); const bad = def.gap ? def : eva.gap ? eva : null; if (bad) throw new TypeError(`makeRule: grain must be Ground, Figure or Pattern (${bad.reason})`); }
  // a rule is a DEF at its grain (what holds in the frame); check() is the EVA at the same grain that tests it
  return Object.freeze({ rel, kind, giver, other, source, grain, def, eva, grounded: !!cellOf });
}
/** the asker's declare ({ functional, symmetric, acyclic }) as rules, giver "asker" */
export function rulesFromDeclare(d = {}, giver = "asker", opts = {}) {
  return [...(d.functional ?? []).map((rel) => makeRule({ rel, kind: "single_value", giver }, opts)), ...(d.symmetric ?? []).map((rel) => makeRule({ rel, kind: "symmetric", giver }, opts)), ...(d.acyclic ?? []).map((rel) => makeRule({ rel, kind: "acyclic", giver }, opts))];
}
const live = (facts, rel) => facts.filter((f) => f.rel === rel && f.polarity !== "-" && f.a != null && f.b != null);
/** containers: child -> parent. true if `big` contains `small` (transitively) */
function contains(containers, big, small) { let cur = small, n = 0; while (containers[cur] != null && n++ < 50) { cur = containers[cur]; if (cur === big) return true; } return false; }
/** check(facts, rules, { containers }) -> { violations: [{ rule, difference, facts, note }], gaps: [{ kind, rel }], checked } */
export function check(facts, rules, { containers = {}, order = null } = {}) {
  const violations = [], gaps = []; let checked = 0;
  const V = (rule, difference, fs, note) => violations.push({ rule, difference, facts: fs, note, eva: rule.eva });
  for (const rule of rules) {
    const own = live(facts, rule.rel);
    if (!own.length) { gaps.push({ kind: "no_facts", rel: rule.rel, note: "the facts never use this relation: nothing was checked, which is not a pass" }); continue; }
    checked++;
    const other = rule.other ? live(facts, rule.other) : [];
    const has = (list, a, b) => list.some((f) => f.a === a && f.b === b);
    if (rule.kind === "single_value" || rule.kind === "distinct_values") {
      const key = rule.kind === "single_value" ? "a" : "b", val = rule.kind === "single_value" ? "b" : "a", groups = new Map();
      for (const f of own) { if (!groups.has(f[key])) groups.set(f[key], new Map()); groups.get(f[key]).set(f[val], f); }
      for (const [k, m] of [...groups].sort((x, y) => String(x[0]).localeCompare(String(y[0])))) {
        const vals = [...m.keys()].sort(); if (vals.length < 2) continue;
        const nested = rule.kind === "single_value" && vals.every((x) => vals.some((y) => x !== y && (contains(containers, x, y) || contains(containers, y, x))));
        V(rule, nested ? "Resolution" : "Conflict", vals.map((x) => m.get(x)), `${rule.kind}: ${rule.rel} of ${k} has ${vals.join(" and ")}${nested ? " (one contains the other: narrows, does not convict)" : ""}`);
      }
    } else if (rule.kind === "symmetric") {
      for (const f of own) if (!has(own, f.b, f.a)) V(rule, "Silence", [f], `symmetric: ${f.a} ${rule.rel} ${f.b} is stated, the converse is not`);
    } else if (rule.kind === "inverse") {
      for (const f of own) if (!has(other, f.b, f.a)) V(rule, "Silence", [f], `inverse: ${f.a} ${rule.rel} ${f.b} is stated, ${f.b} ${rule.other} ${f.a} is not`);
    } else if (rule.kind === "item_requires") {
      for (const a of [...new Set(own.map((f) => f.a))].sort()) if (!other.some((f) => f.a === a)) V(rule, "Silence", own.filter((f) => f.a === a), `item_requires: ${a} has ${rule.rel} but no ${rule.other}`);
    } else if (rule.kind === "conflicts_with") {
      for (const f of own) if (other.some((g) => g.a === f.a)) V(rule, "Conflict", [f, ...other.filter((g) => g.a === f.a)], `conflicts_with: ${f.a} has both ${rule.rel} and ${rule.other}`);
    } else if (rule.kind === "precedes") {
      // rel (born) must not come after other (died) for the same item; equal is allowed. Only an item with BOTH is compared: no death is a living subject, not a hole.
      // The ORDER is declared, never computed here (EOT has no arithmetic; a codec decodes a date, the asker declares the order, like `containers`): order(x, y) -> <0, 0, >0, or null when it cannot say.
      if (typeof order !== "function") { gaps.push({ kind: "no_order", rel: rule.rel, note: "precedes needs a declared order to compare two values: none was given, nothing was checked, which is not a pass" }); checked--; continue; }
      const seen = new Set();
      for (const f of own) for (const g of other.filter((x) => x.a === f.a)) {
        const c = order(f.b, g.b);
        if (c == null || Number.isNaN(c)) { const k = `${f.a}|${f.b}|${g.b}`; if (!seen.has(k)) { seen.add(k); gaps.push({ kind: "unorderable", rel: rule.rel, note: `precedes: the declared order cannot compare ${f.a} ${rule.rel} ${f.b} with ${rule.other} ${g.b}: not checked, which is not a pass` }); } continue; }
        if (c > 0) V(rule, "Conflict", [f, g], `precedes: ${f.a} ${rule.rel} ${f.b} comes after ${rule.other} ${g.b}`);
      }
    } else if (rule.kind === "acyclic") {
      const adj = new Map(); for (const f of own) { if (!adj.has(f.a)) adj.set(f.a, new Set()); adj.get(f.a).add(f.b); }
      const color = new Map(), stack = []; let cyc = null;
      const dfs = (u) => { color.set(u, 1); stack.push(u); for (const v of [...(adj.get(u) ?? [])].sort()) { if (cyc) return; if (color.get(v) === 1) { cyc = [...stack.slice(stack.indexOf(v)), v]; return; } if (!color.get(v)) dfs(v); } stack.pop(); color.set(u, 2); };
      for (const u of [...adj.keys()].sort()) if (!color.get(u) && !cyc) dfs(u);
      if (cyc) V(rule, "Conflict", own.filter((f) => cyc.includes(f.a) && cyc.includes(f.b)), `acyclic: ${rule.rel} cycles ${cyc.join(" > ")}`);
    }
  }
  return { violations, gaps, checked };
}
