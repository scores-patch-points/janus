// organs/consequence-verdict.test.mjs — the retained mind follows the REAL reasoning record, untouched.
import test from "node:test";
import assert from "node:assert/strict";
import { appendReasoning } from "./reasoning-spiral.js";
import consequenceVerdict from "./consequence-verdict.js";

test("shared gate: supported earns, an unassessed candidate is withheld, a refuted claim is preserved", () => {
  const S = "rigveda"; const R = { subject: "reciter", verb: "retains", object: "the passed" };
  let log = [];
  log = appendReasoning(log, { kind: "propose", id: "x:rec:v2", forWhom: "Reader", relation: R, witnesses: ["rigveda#1-2"] });
  log = appendReasoning(log, { kind: "assess", id: "x:rec:v2", verdict: "supported", method: "testimony", by: "giver", basis: "attested by the passed", witnesses: ["rigveda#1-2"] });
  log = appendReasoning(log, { kind: "propose", id: "x:cheap", forWhom: "Reader", relation: { subject: "reciter", verb: "sells", object: "the short" } });
  log = appendReasoning(log, { kind: "propose", id: "x:rec", forWhom: "Reader", relation: R, witnesses: ["rigveda#3-4"] });
  log = appendReasoning(log, { kind: "assess", id: "x:rec", verdict: "refuted", method: "perturbation", by: "falsify", basis: "adversarial trial" });
  const v = consequenceVerdict(log);
  assert.equal(v.schema, "EOConsequenceVerdict@1");
  assert.ok(v.earned.includes("x:rec:v2"), "supported earns");
  assert.ok(v.withheld.includes("x:cheap"), "an unassessed candidate is withheld, never counted");
  assert.ok(v.defeated.includes("x:rec"), "a refuted claim is PRESERVED");
  assert.equal(v.retainedMind, 0);   // one earned, one refuted — the retained mind is honest
});

test("the verdict reads the record as-is: nothing is edited here (append-only is the record's, not ours)", () => {
  let log = [];
  log = appendReasoning(log, { id: "x", verdict: "supported", method: "deduction", license: "l", premises: [], by: "g", seq: 1 });
  const before = log.length;
  consequenceVerdict(log);
  assert.equal(log.length, before, "the verdict must not mutate the log");
});