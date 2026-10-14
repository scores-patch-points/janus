// organs/nonsense.test.mjs — janus catches non-sense by kind, falsifiably.
import test from "node:test";
import assert from "node:assert/strict";
import { senseOf } from "./nonsense.js";

test("self-undo: nothing does a thing to itself when the act has no reflex", () => {
  const r = senseOf([
    { s: "anna", v: "hug", o: "prince", at: 1 },
    { s: "prince", v: "hug", o: "anna", at: 2 },
    { s: "anna", v: "hug", o: "anna", at: 3 },
    { s: "anna", v: "betray", o: "prince", at: 4 },
  ], { nameSignals: new Set(["anna", "prince"]) });
  assert.equal(r.nonsense.length, 1);
  assert.equal(r.nonsense[0].because, "self-undo");
  assert.equal(r.nonsense[0].s, "anna");
});

test("one-shot-agent: an otherwise-inert word acting once is not an actor the record attests", () => {
  const r = senseOf([
    { s: "prince", v: "offer", o: "seat", at: 1 },
    { s: "anna", v: "offer", o: "seat", at: 2 },
    { s: "pierre", v: "offer", o: "seat", at: 3 },
    { s: "step", v: "offer", o: "contrast", at: 4 }, // acts exactly once, not a name
  ], { nameSignals: new Set(["prince", "anna", "pierre"]) });
  assert.equal(r.nonsense.length, 1);
  assert.equal(r.nonsense[0].because, "one-shot-agent");
  assert.equal(r.nonsense[0].s, "step");
});

test("inverted-role: both directions bound while the act drifts one way — one is the tag's mis-bind", () => {
  const r = senseOf([
    { s: "anna", v: "reply", o: "prince", at: 1 },
    { s: "prince", v: "reply", o: "anna", at: 2 },
    { s: "oster", v: "reply", o: "x", at: 3 },
    { s: "oster", v: "reply", o: "y", at: 4 },
    { s: "oster", v: "reply", o: "z", at: 5 },
    { s: "oster", v: "reply", o: "w", at: 6 }, // dilutes 'reply' below the 0.2 reciprocal floor
  ], { nameSignals: new Set(["anna", "prince", "oster"]) });
  assert.equal(r.nonsense.length, 2);
  assert.ok(r.nonsense.slice(0, 2).every((n) => n.because === "inverted-role"));
});

test("a name acting repeatedly is sound — the kind says it can say such things", () => {
  const names = new Set(["anna", "prince"]);
  const edges = [
    { s: "anna", v: "warn", o: "prince", at: 1 },
    { s: "prince", v: "enter", o: "court", at: 2 },
    { s: "anna", v: "ask", o: "prince", at: 3 },
  ];
  const r = senseOf(edges, { nameSignals: names });
  assert.equal(r.nonsense.length, 0);
  assert.equal(r.kept.length, 3);
});