import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { cliticRulesFrom, derivationsFrom, rulesFromDoor, RULE_CELLS } from "./rule-entries.mjs"; import { admitted, splitToken } from "./clitic-split.mjs";
const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/rule-entries.fixture.json", import.meta.url), "utf8")).entries;
test("only rules whose latest EVA verdict is `survived` are in force; underexposed, unexposed and unjudged rules stay as data and touch no text", () => {
  const c = cliticRulesFrom(fx, { language: "eng" }); assert.equal(c.rules.length, 9); assert.deepEqual(admitted(c).map((r) => r.form).sort(), ["'ll", "'m", "'re", "'s", "'ve", "n't"]);
  const unjudged = cliticRulesFrom(fx.filter((e) => e.kind !== "rule-verdict"), { language: "eng" }); assert.equal(admitted(unjudged).length, 0, "no verdict, no force");
  assert.equal(splitToken("knot", c), null); assert.equal(splitToken("he'd", c), null); assert.deepEqual(splitToken("Oscar’s", c), ["Oscar", "’s"], "the declared variant is applied to a rule in force");
});
test("the LATEST verdict stands: a later refutation removes a rule from force", () => {
  const rule = fx.find((e) => e.kind === "tokenizer-rule" && e.body.form === "'s"), later = { id: "v2", addr: "rule-verdict:later", cell: "EVA·Pattern", kind: "rule-verdict", body: { rule: rule.addr, status: "refuted", alpha: 0.01 } };
  assert.ok(!admitted(cliticRulesFrom([...fx, later], { language: "eng" })).some((r) => r.form === "'s")); assert.ok(admitted(cliticRulesFrom([later, ...fx], { language: "eng" })).some((r) => r.form === "'s"), "log order decides");
});
test("scope: another language or variety gets none of these rules, and a creole is never given the English ones", () => {
  for (const [lang, variety] of [["pcm", null], ["hat", null], ["eng", "scots"], ["fra", null]]) assert.equal(cliticRulesFrom(fx, { language: lang, variety }).rules.length, 0, `${lang}/${variety}`);
});
test("entries in the wrong cell, or with no named giver, language or standing, are REFUSED and listed, never silently used", () => {
  const rule = fx.find((e) => e.kind === "tokenizer-rule"), bad = [{ ...rule, id: "x1", cell: "SEG·Pattern" }, { ...rule, id: "x2", body: { ...rule.body, giver: {} } }, { ...rule, id: "x3", body: { ...rule.body, standing: "certain" } }, { ...fx.find((e) => e.kind === "derivation-rule"), id: "x4", cell: "CON·Figure" }];
  const c = cliticRulesFrom(bad, { language: "eng" }); assert.equal(c.rules.length, 0); assert.equal(c.refused.length, 4, "every rule kind is checked for its cell, derivations included"); assert.equal(derivationsFrom(bad).refused.length, 1);
});
test("the door: a door that is off, or a log with no surviving rule, is a typed gap and nothing is split", () => {
  const off = rulesFromDoor({ on: false, why: "no pointer" }, { language: "eng" }); assert.equal(off.clitics.gap, "no_clitic_rules"); assert.ok(off.gaps.some((g) => g.gap === "no_door"));
  const door = (entries) => ({ on: true, ask: (kinds) => entries.filter((e) => kinds.includes(e.kind)) }); const g = rulesFromDoor(door([]), { language: "eng" }); assert.equal(g.clitics.gap, "no_clitic_rules");
  const ok = rulesFromDoor(door(fx), { language: "eng" }); assert.equal(ok.clitics.gap, undefined); assert.equal(admitted(ok.clitics).length, 6); assert.equal(ok.derivations.rules.length, 1);
  assert.equal(rulesFromDoor(door(fx), { language: "pcm" }).clitics.gap, "no_clitic_rules", "no English rules for a creole");
});
test("the cell of each rule kind: rules and derivations are DEF·Pattern, verdicts EVA·Pattern: Interpretation, never Janus's", () => { assert.deepEqual(Object.values(RULE_CELLS).sort(), ["DEF·Pattern", "DEF·Pattern", "DEF·Pattern", "EVA·Pattern"]); for (const c of Object.values(RULE_CELLS)) assert.ok(["DEF", "EVA", "REC"].includes(c.split("·")[0])); });
