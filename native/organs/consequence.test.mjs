// janus/native/organs/consequence.test.mjs — the consequence verdict's own
// falsifier: a real retained signal must EARN, and the same scores against a
// streamed outcome must FAIL, on the pre-registered battery bar.
import test from "node:test";
import assert from "node:assert/strict";
import { consequenceVerdict, CONSEQUENCE_SCHEMA, CONSEQUENCE_BAR } from "./consequence.js";

test("the consequence verdict earns a true retained signal and refuses noise", () => {
  const refs = Array.from({ length: 200 }, (_, i) => `r${i}`);
  // planted: the first 40 refs are 'true' outcomes, and the predicted score is
  // 1 for them, 0.1 for the rest — a signal that must earn.
  const predictOf = (r) => (Number(r.slice(1)) < 40 ? 1 : 0.1);
  const actualOf = (r) => (Number(r.slice(1)) < 40 ? 1 : 0);
  const good = consequenceVerdict({ predictOf, actualOf, refs, method: "planted" });
  assert.equal(good.schema, CONSEQUENCE_SCHEMA);
  assert.equal(good.success, true);
  assert.ok(good.effect >= CONSEQUENCE_BAR.effect);
  assert.ok(good.pValue <= CONSEQUENCE_BAR.alpha);

  // the SAME predicting scores, but the outcome streamed independent of them
  // (flip the outcome assignment): no signal may earn.
  const ohran = consequenceVerdict({
    predictOf,
    actualOf: (r) => (Number(r.slice(1)) >= 40 ? 1 : 0),
    refs,
    method: "flipped",
  });
  assert.equal(ohran.success, false);
});