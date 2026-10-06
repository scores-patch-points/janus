import test from "node:test";
import assert from "node:assert/strict";
import { derivedClaims, appendDerived, claimsAt } from "./fold-claims.js";
import { claimAt, appendClaims } from "../../../khora/native/the-fold/fold-record.js";

const rows = [
  { id: "derived:a-yields-c", subject: "Eiffel Tower", verb: "taller-than", object: "Big Ben", depth: 2, paths: 1, premises: ["n1", "n2"], provenance: ["r#1-9"], landed: "new" },
  { id: "derived:x", subject: "A", verb: "is", object: "B", landed: "unchanged" },
  { id: "derived:y", subject: "A", verb: "", object: "B" },
];

test("a derived row becomes a claim in lane d, carrying its premises and source addresses; unchanged and malformed rows are not claims", () => {
  const cs = derivedClaims(7, rows);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].ground, "/t7/d1");
  assert.equal(cs[0].rel, "taller-than");
  assert.deepEqual([cs[0].roles.ARG0, cs[0].roles.ARG1], ["Eiffel Tower", "Big Ben"]);
  assert.deepEqual(cs[0].basis.premises, ["n1", "n2"]);
  assert.deepEqual(cs[0].basis.provenance, ["r#1-9"]);
});

test("accrual: a re-derived claim is not stored twice; the surface's own claims are untouched and read first", () => {
  const surface = [claimAt(7, 1, "said", "The tower is tall.")];
  let store = appendClaims([], surface);
  store = appendDerived(store, 7, rows);
  store = appendDerived(store, 8, rows);   // the same derivation on a later pass
  assert.equal(store.length, 2);
  assert.deepEqual(claimsAt("/t7", store).map((c) => c.id), ["t7c1", "t7d1"]);
});
