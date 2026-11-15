import test from "node:test";
import assert from "node:assert/strict";
import { lemmaNodes, makeFold } from "./channel-fold.mjs";

// a tiny store in the shape of bin.mjs's answer(): names and links only
function store({ names, links }) {
  return { answer(ask) {
    if (ask.op === "names") return { surfaces: Object.fromEntries(ask.surfaces.map((s) => [s, { written: names[s] ?? [] }])) };
    if (ask.op === "relations") return { links: (links[ask.id] ?? []).map(([kind, to]) => ({ kind, to })) };
    return {};
  } };
}
const T = "link:translation";
const H = store({
  names: {
    buy: [{ kind: "lemma", node: "n_buy" }], bought: [{ kind: "form-of", node: "n_x", of: ["buy"] }],
    purchase: [{ kind: "lemma", node: "n_purchase" }], sell: [{ kind: "lemma", node: "n_sell" }], lone: [{ kind: "lemma", node: "n_lone" }],
  },
  links: {
    n_buy: [[T, "fr_acheter"], [T, "de_kaufen"], [T, "es_comprar"], ["other", "zz"]],
    n_purchase: [[T, "fr_acheter"], [T, "es_comprar"], [T, "fr_achat"]],
    n_sell: [[T, "fr_vendre"], [T, "de_verkaufen"]],
    fr_acheter: [[T, "it_comprare"]], es_comprar: [[T, "it_comprare"]], fr_vendre: [[T, "it_vendere"]],
  },
});

test("a form is taken to its lemma by the store's own form-of rows", () => {
  assert.deepEqual(lemmaNodes(H, "bought"), ["n_buy"]);
  assert.deepEqual(lemmaNodes(H, "nothere"), []);
});

test("ball: only the named channel is followed, shell by shell", () => {
  const f = makeFold(H);
  assert.deepEqual([...f.ball("buy", 1).nodes].sort(), ["de_kaufen", "es_comprar", "fr_acheter"]);
  assert.deepEqual(f.ball("buy", 2).sizes, [3, 4]);
  assert.equal(f.ball("bought", 1).nodes.size, 3);
});

test("shared: counts the nodes two balls hold in common, per radius", () => {
  const f = makeFold(H);
  assert.equal(f.shared("buy", "purchase", 1), 2);
  assert.equal(f.shared("buy", "sell", 1), 0);
  assert.equal(f.shared("buy", "purchase", 2), 3);
});

test("readings: counts and a null, no verdict; an empty ball is marked, never above", () => {
  const f = makeFold(H);
  const r = f.readings("buy", "purchase", { radii: [1, 2], nullWords: ["sell", "lone"] });
  assert.deepEqual(r.per.map((p) => [p.shared, p.null.p95, p.above]), [[2, 0, true], [3, 0, true]]);
  assert.equal(r.moving, false);
  const e = f.readings("buy", "lone", { radii: [1], nullWords: ["sell"] });
  assert.deepEqual([e.per[0].empty, e.per[0].above], [true, false]);
  for (const k of ["same", "verdict", "settled", "standing"]) assert.equal(k in r, false);
});

test("the cap stops a ball and says so", () => {
  const f = makeFold(H, { cap: 2 });
  const b = f.ball("buy", 2);
  assert.deepEqual([b.nodes.size, b.capped], [2, true]);
});
