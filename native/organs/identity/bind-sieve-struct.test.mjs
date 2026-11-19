import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NO_KINDS, makeKindView, pointsOf, round2 } from "./bind-sieve-struct.mjs";

const A = "text:aaaaaaaaaaaaaaaa";
const B = "text:bbbbbbbbbbbbbbbb";
const D = "text:dddddddddddddddd";

const mention = (m, key, cls = "description") => ({ m, key, ikey: [key], class: cls });
const role = (r, m) => ({ role: r, filler: { m }, borrowed: null });
const act = (a, pred, roles) => ({ a, pred, roles });

// A: "<org> bought <widget> on <day>", "<org> shipped to <carrier>"
// B: the same two events, with differently written roles on the second
function makeGroup({ predB = "buy", rolesB1, keysB } = {}) {
  const kb = keysB || ["firm", "gadget", "monday", "courier"];
  const ta = {
    acts: {
      mentions: [mention(0, "company"), mention(1, "widget"), mention(2, "tuesday"), mention(3, "carrier")],
      acts: [
        act(0, "buy", [role("nsubj", 0), role("obj", 1), role("obl[on]", 2)]),
        act(1, "ship", [role("nsubj", 0), role("iobj", 3)]),
      ],
    },
    place: null,
    doc: null,
    context: null,
  };
  const tb = {
    acts: {
      mentions: kb.map((k, i) => mention(i, k)),
      acts: [
        act(0, predB, [role("nsubj", 0), role("obj", 1), role("obl[on]", 2)]),
        act(1, "ship", rolesB1 || [role("nsubj", 0), role("obl[via]", 3)]),
      ],
    },
    place: null,
    doc: null,
    context: null,
  };
  return { members: [A, B], texts: { [A]: ta, [B]: tb } };
}

const L = (id, pass, a, b, extra = {}) => ({ id, pass, a, b, evidence: {}, round: 0, kinds: null, ...extra });
const standingOf = (ids, more = {}) => ({ runKey: "rk", round: 1, fixed: false, stands: ids, held: [], refused: [], ...more });
const none = { kinds: "none", maxCombinations: 64, passes: "all", dictPermute: null };
const on = { ...none, kinds: "standing" };

const idA0 = L("i0", "identity", `${A}#m0`, `${B}#m0`);

test("pointsOf: components of standing links, singletons kept, held excluded", () => {
  const g = makeGroup();
  const l1 = L("i0", "identity", `${A}#m0`, `${B}#m0`);
  const l2 = L("h1", "antecedent", `${A}#m1`, `${B}#m1`);
  const pts = pointsOf(g, standingOf(["i0"], { held: [{ group: "g", alternatives: [["h1"]] }] }), [l1, l2]);
  assert.equal(pts.length, 8 - 1); // 8 mentions, one pair joined
  const joined = pts.find((p) => p.mentions.length === 2);
  assert.deepEqual(joined.mentions, [`${A}#m0`, `${B}#m0`]);
  assert.deepEqual(joined.texts, [A, B]);
  assert.deepEqual(joined.keys, ["company", "firm"]);
  assert.ok(pts.every((p) => /^pt:[0-9a-f]{16}$/.test(p.id)));
  assert.ok(pts.find((p) => p.mentions.length === 1 && p.mentions[0] === `${A}#m1`));
});

test("pointsOf: document mentions are nodes too", () => {
  const g = makeGroup();
  g.texts[A].doc = { address: D, acts: { mentions: [mention(0, "company")], acts: [] } };
  const l = L("id1", "identity-doc", `${A}#m0`, `${D}#m0`);
  const pts = pointsOf(g, standingOf(["id1"]), [l]);
  assert.equal(pts.length, 8);
  assert.ok(pts.find((p) => p.mentions.includes(`${D}#m0`) && p.mentions.includes(`${A}#m0`)));
});

test("5a act: equal pred with one shared point", () => {
  const r = round2(makeGroup(), NO_KINDS, none, standingOf(["i0"]), [idA0], []);
  assert.equal(r.acts.length, 2);
  const buy = r.acts.find((l) => l.a === `${A}#a0`);
  assert.equal(buy.b, `${B}#a0`);
  assert.equal(buy.pass, "act");
  assert.equal(buy.round, 2);
  assert.equal(buy.evidence.L, 1);
  assert.deepEqual(buy.evidence.rolePairs, [["nsubj", "nsubj"]]);
  assert.deepEqual(buy.evidence.preds, ["buy", "buy"]);
  assert.equal(buy.evidence.predEvidence, null);
  assert.equal(buy.evidence.kind, null);
  assert.match(buy.id, /^[0-9a-f]{16}$/);
  assert.deepEqual(r.links, []);
});

test("5a act: different preds need predEvidence, a kind, or two shared points", () => {
  const g = makeGroup({ predB: "purchase" });
  const st1 = standingOf(["i0"]);
  const pairKey = { a: `${A}#a0`, b: `${B}#a0` };
  // L = 1, no evidence: not proposed (the ship acts still are, equal pred)
  let r = round2(g, NO_KINDS, none, st1, [idA0], []);
  assert.equal(r.acts.filter((l) => l.a === `${A}#a0`).length, 0);
  // positive predEvidence
  r = round2(g, NO_KINDS, none, st1, [idA0], [{ ...pairKey, e: {}, ab: { shared: 3 }, ba: { shared: 2 }, score: 2, antonym: false }]);
  const withPe = r.acts.find((l) => l.a === `${A}#a0`);
  assert.ok(withPe);
  assert.equal(withPe.evidence.predEvidence.score, 2);
  // zero score is not evidence
  r = round2(g, NO_KINDS, none, st1, [idA0], [{ ...pairKey, e: {}, ab: {}, ba: {}, score: 0, antonym: false }]);
  assert.equal(r.acts.filter((l) => l.a === `${A}#a0`).length, 0);
  // L >= 2
  const i1 = L("i1", "dictionary", `${A}#m1`, `${B}#m1`);
  r = round2(g, NO_KINDS, none, standingOf(["i0", "i1"]), [idA0, i1], []);
  const two = r.acts.find((l) => l.a === `${A}#a0`);
  assert.equal(two.evidence.L, 2);
  assert.deepEqual(two.evidence.rolePairs, [["nsubj", "nsubj"], ["obj", "obj"]]);
});

test("5a act: acts joined by a standing act link count as shared fillers", () => {
  const g = makeGroup();
  g.texts[A].acts.acts.push(act(2, "say", [{ role: "ccomp", filler: { a: 0 }, borrowed: null }, role("nsubj", 3)]));
  g.texts[B].acts.acts.push(act(2, "claim", [{ role: "ccomp", filler: { a: 0 }, borrowed: null }, role("nsubj", 3)]));
  const act1 = L("act1", "act", `${A}#a0`, `${B}#a0`);
  const r = round2(g, NO_KINDS, none, standingOf(["act1"]), [act1], []);
  const say = r.acts.find((l) => l.a === `${A}#a2`);
  assert.ok(!say, "different preds with one shared act filler are not enough");
  const i3 = L("i3", "dictionary", `${A}#m3`, `${B}#m3`);
  const r2 = round2(g, NO_KINDS, none, standingOf(["act1", "i3"]), [act1, i3], []);
  const say2 = r2.acts.find((l) => l.a === `${A}#a2` && l.b === `${B}#a2`);
  assert.ok(say2);
  assert.equal(say2.evidence.L, 2);
});

test("5b role: every pair of fillers of a shared role in different points", () => {
  const g = makeGroup();
  const act0 = L("act0", "act", `${A}#a0`, `${B}#a0`);
  const r = round2(g, NO_KINDS, none, standingOf(["i0", "act0"]), [idA0, act0], []);
  const roles = r.links.filter((l) => l.pass === "role");
  assert.deepEqual(
    roles.map((l) => [l.a, l.b, l.evidence.role]).sort(),
    [
      [`${A}#m1`, `${B}#m1`, "obj"],
      [`${A}#m2`, `${B}#m2`, "obl[on]"],
    ],
  );
  assert.equal(roles[0].evidence.actLink, "act0");
  assert.equal(roles[0].kinds, null);
});

test("5b role: coordinated fillers give every pair", () => {
  const g = makeGroup();
  g.texts[A].acts.mentions.push(mention(4, "gizmo"));
  g.texts[A].acts.acts[0].roles.push(role("obj", 4));
  const act0 = L("act0", "act", `${A}#a0`, `${B}#a0`);
  const r = round2(g, NO_KINDS, none, standingOf(["i0", "act0"]), [idA0, act0], []);
  const objs = r.links.filter((l) => l.evidence.role === "obj").map((l) => l.a).sort();
  assert.deepEqual(objs, [`${A}#m1`, `${A}#m4`]);
});

test("5c forced: one unlinked filler on each side", () => {
  const g = makeGroup();
  const act1 = L("act1", "act", `${A}#a1`, `${B}#a1`);
  const r = round2(g, NO_KINDS, none, standingOf(["i0", "act1"]), [idA0, act1], []);
  assert.equal(r.links.length, 1);
  const f = r.links[0];
  assert.equal(f.pass, "forced");
  assert.deepEqual([f.a, f.b], [`${A}#m3`, `${B}#m3`]);
  assert.deepEqual(f.evidence.roles, ["iobj", "obl[via]"]);
});

test("5c forced: two unlinked on a side force nothing; alternatives are never forced", () => {
  const g = makeGroup();
  g.texts[B].acts.mentions.push(mention(4, "depot"));
  g.texts[B].acts.acts[1].roles.push(role("obl[from]", 4));
  const act1 = L("act1", "act", `${A}#a1`, `${B}#a1`);
  let r = round2(g, NO_KINDS, none, standingOf(["i0", "act1"]), [idA0, act1], []);
  assert.deepEqual(r.links, []);
  // single unlinked pair, but B#m3 is an end of a held alternative: not forced
  const g2 = makeGroup();
  const h1 = L("h1", "antecedent", `${B}#m3`, `${A}#m0`);
  r = round2(
    g2,
    NO_KINDS,
    none,
    standingOf(["i0", "act1"], { held: [{ group: "g", alternatives: [["h1"], ["h2"]] }] }),
    [idA0, act1, h1],
    [],
  );
  assert.deepEqual(r.links, []);
});

test("5c forced: the filler already in a shared point is not left over", () => {
  const g = makeGroup();
  const i3 = L("i3", "dictionary", `${A}#m3`, `${B}#m3`);
  const act1 = L("act1", "act", `${A}#a1`, `${B}#a1`);
  const r = round2(g, NO_KINDS, none, standingOf(["i0", "i3", "act1"]), [idA0, i3, act1], []);
  assert.deepEqual(r.links, []);
});

// ---- kind evidence ----------------------------------------------------------

const kindStanding = {
  record: "rec1",
  seq: 0,
  kinds: [
    { id: "kind:entity:k1", population: "entity", size: 2, stands: true },
    { id: "kind:entity:k2", population: "entity", size: 2, stands: false },
    { id: "kind:predicate:p1", population: "predicate", size: 2, stands: true },
  ],
};
const kindCandidates = {
  populations: {
    entity: {
      kinds: [
        {
          id: "kind:entity:k1",
          members: ["widget", "gadget"],
          company: {
            widget: ["sell/obj", "ship/obl[at]"],
            gadget: ["ship/obl[to]", "sell/obj"],
          },
        },
        { id: "kind:entity:k2", members: ["tuesday", "monday"], company: { tuesday: ["x/y"], monday: ["x/y"] } },
      ],
    },
    predicate: { kinds: [{ id: "kind:predicate:p1", members: ["buy", "purchase"] }] },
  },
};

test("makeKindView: standing kinds only, none when kinds is none", () => {
  const kv = makeKindView(kindStanding, kindCandidates, on);
  assert.equal(kv.on, true);
  assert.equal(kv.recordSha, "rec1");
  assert.equal(kv.kindOf("widget", "entity"), "kind:entity:k1");
  assert.equal(kv.kindOf("tuesday", "entity"), null, "a kind that does not stand is absent");
  assert.equal(kv.kindOf("nothing", "entity"), null);
  assert.equal(kv.sameKind("entity", "widget", "gadget"), "kind:entity:k1");
  assert.equal(kv.sameKind("entity", "widget", "tuesday"), null);
  assert.equal(kv.sameKind("predicate", "buy", "purchase"), "kind:predicate:p1");
  assert.equal(kv.companyCount("kind:entity:k1", "sell/obj"), 2);
  assert.equal(kv.companyCount("kind:entity:k1", "ship/obl[to]"), 1);
  assert.equal(kv.companyCount("kind:entity:k1", "no/such"), 0);
  assert.equal(kv.slotCount("widget", "sell", "obj"), 2);
  assert.equal(kv.slotCount("tuesday", "sell", "obj"), null, "no standing kind: null");
  const off = makeKindView(kindStanding, kindCandidates, none);
  assert.equal(off, NO_KINDS);
  assert.equal(NO_KINDS.on, false);
  assert.equal(NO_KINDS.kindOf("widget", "entity"), null);
  assert.equal(NO_KINDS.slotCount("widget", "a", "b"), null);
  assert.equal(NO_KINDS.sameKind("entity", "a", "b"), null);
  assert.equal(NO_KINDS.companyCount("k", "a"), null);
});

function kindGroup() {
  // A ship: nsubj company, obj widget, obl[at] shop ; B ship: nsubj firm, iobj gadget, obl[to] thing
  const g = makeGroup();
  g.texts[A].acts.mentions = [mention(0, "company"), mention(1, "widget"), mention(2, "shop")];
  g.texts[A].acts.acts = [act(0, "ship", [role("nsubj", 0), role("obj", 1), role("obl[at]", 2)])];
  g.texts[B].acts.mentions = [mention(0, "firm"), mention(1, "gadget"), mention(2, "thing")];
  g.texts[B].acts.acts = [act(0, "ship", [role("nsubj", 0), role("iobj", 1), role("obl[to]", 2)])];
  return g;
}

test("5d kind and role-frame: proposed with kinds standing", () => {
  const kv = makeKindView(kindStanding, kindCandidates, on);
  const g = kindGroup();
  const act0 = L("act0", "act", `${A}#a0`, `${B}#a0`);
  const r = round2(g, kv, on, standingOf(["i0", "act0"]), [idA0, act0], []);
  // 5b: nothing shares a role besides nsubj (same point); 5c: two on each side
  assert.equal(r.links.filter((l) => l.pass === "role" || l.pass === "forced").length, 0);
  const kind = r.links.filter((l) => l.pass === "kind");
  assert.equal(kind.length, 1);
  assert.deepEqual([kind[0].a, kind[0].b], [`${A}#m1`, `${B}#m1`]);
  assert.equal(kind[0].evidence.kind, "kind:entity:k1");
  assert.deepEqual(kind[0].kinds, { a: "kind:entity:k1", b: "kind:entity:k1" });
  const frame = r.links.filter((l) => l.pass === "role-frame").sort((p, q) => (p.a < q.a ? -1 : 1));
  // widget (k1) with thing (no kind): gadget's company holds ship/obl[to] -> but widget is in k1,
  // thing's slot is B's ship/obl[to], held by gadget (count 1)
  const wt = frame.find((l) => l.a === `${A}#m1` && l.b === `${B}#m2`);
  assert.ok(wt);
  assert.equal(wt.evidence.company, "ship/obl[to]");
  assert.equal(wt.evidence.count, 1);
  assert.deepEqual(wt.kinds, { a: "kind:entity:k1", b: null });
  // shop (no kind) with gadget (k1): A's ship/obl[at], held by widget
  const sg = frame.find((l) => l.a === `${A}#m2` && l.b === `${B}#m1`);
  assert.ok(sg);
  assert.equal(sg.evidence.company, "ship/obl[at]");
  assert.equal(sg.evidence.count, 1);
  // shop with thing: neither has a kind: nothing; company, firm: same point already
  assert.ok(!r.links.find((l) => l.a === `${A}#m2` && l.b === `${B}#m2`));
  assert.equal(frame.length, 2);
});

test("5d refuses to propose: different standing kinds, absent company", () => {
  const cand = JSON.parse(JSON.stringify(kindCandidates));
  cand.populations.entity.kinds.push({ id: "kind:entity:k3", members: ["thing", "shop"], company: { thing: ["a/b"], shop: ["a/b"] } });
  const st = JSON.parse(JSON.stringify(kindStanding));
  st.kinds.push({ id: "kind:entity:k3", population: "entity", size: 2, stands: true });
  const kv = makeKindView(st, cand, on);
  const act0 = L("act0", "act", `${A}#a0`, `${B}#a0`);
  const r = round2(kindGroup(), kv, on, standingOf(["i0", "act0"]), [idA0, act0], []);
  // widget(k1)-gadget(k1) kind link; shop/thing in k3 -> kind link; widget-thing and shop-gadget: different kinds, refused
  const pairs = r.links.map((l) => `${l.pass}:${l.a.split("#")[1]}-${l.b.split("#")[1]}`).sort();
  assert.deepEqual(pairs, ["kind:m1-m1", "kind:m2-m2"]);
  // no company: role-frame refused
  const bare = JSON.parse(JSON.stringify(kindCandidates));
  for (const k of bare.populations.entity.kinds) k.company = { widget: ["z/z"], gadget: ["z/z"], tuesday: [], monday: [] };
  const kv2 = makeKindView(kindStanding, bare, on);
  const r2 = round2(kindGroup(), kv2, on, standingOf(["i0", "act0"]), [idA0, act0], []);
  assert.deepEqual(r2.links.map((l) => l.pass), ["kind"]);
});

test("K5: a standing predicate kind proposes an act link on one shared point", () => {
  const kv = makeKindView(kindStanding, kindCandidates, on);
  const g = makeGroup({ predB: "purchase" });
  const r = round2(g, kv, on, standingOf(["i0"]), [idA0], []);
  const a0 = r.acts.find((l) => l.a === `${A}#a0`);
  assert.ok(a0);
  assert.equal(a0.evidence.kind, "kind:predicate:p1");
  // the same input with kinds none proposes no such link
  const off = round2(g, kv, none, standingOf(["i0"]), [idA0], []);
  assert.equal(off.acts.find((l) => l.a === `${A}#a0`), undefined);
});

test("kinds none: every kind rule is inert even when a live view is passed", () => {
  const kv = makeKindView(kindStanding, kindCandidates, on);
  const act0 = L("act0", "act", `${A}#a0`, `${B}#a0`);
  const r = round2(kindGroup(), kv, none, standingOf(["i0", "act0"]), [idA0, act0], []);
  assert.deepEqual(r.links, []);
  const g = makeGroup();
  const act0b = L("act0", "act", `${A}#a0`, `${B}#a0`);
  const rr = round2(g, kv, none, standingOf(["i0", "act0"]), [idA0, act0b], []);
  assert.ok(rr.links.length > 0);
  assert.ok(rr.links.every((l) => l.kinds === null));
});

test("K1: with kinds standing the links record both heads' kinds", () => {
  const kv = makeKindView(kindStanding, kindCandidates, on);
  const g = makeGroup({ keysB: ["firm", "gadget", "monday", "courier"] });
  const act0 = L("act0", "act", `${A}#a0`, `${B}#a0`);
  const r = round2(g, kv, on, standingOf(["i0", "act0"]), [idA0, act0], []);
  const obj = r.links.find((l) => l.evidence.role === "obj");
  assert.deepEqual(obj.kinds, { a: "kind:entity:k1", b: "kind:entity:k1" });
  const day = r.links.find((l) => l.evidence.role === "obl[on]");
  assert.deepEqual(day.kinds, { a: null, b: null });
});

// ---- bridge check -----------------------------------------------------------

test("6 bridge: refused pair in one point reports every path of standing links", () => {
  const g = makeGroup();
  const l1 = L("l1", "identity", `${A}#m0`, `${B}#m0`);
  const l2 = L("l2", "identity", `${B}#m0`, `${A}#m1`);
  const l3 = L("l3", "dictionary", `${A}#m0`, `${B}#m1`);
  const l4 = L("l4", "dictionary", `${B}#m1`, `${A}#m1`);
  const refused = L("rf", "dictionary", `${A}#m0`, `${A}#m1`);
  const st = standingOf(["l1", "l2", "l3", "l4"], { refused: [["rf", "mismatch"]] });
  const r = round2(g, NO_KINDS, none, st, [l1, l2, l3, l4, refused], []);
  assert.equal(r.bridges.length, 1);
  const b = r.bridges[0];
  assert.deepEqual([b.a, b.b], [`${A}#m0`, `${A}#m1`]);
  assert.deepEqual(b.refused, { id: "rf", rule: "mismatch" });
  assert.deepEqual(b.paths, [["l1", "l2"], ["l3", "l4"]]);
});

test("6 bridge: a refused pair in different points is no bridge", () => {
  const g = makeGroup();
  const l1 = L("l1", "identity", `${A}#m0`, `${B}#m0`);
  const refused = L("rf", "dictionary", `${A}#m1`, `${B}#m1`);
  const r = round2(g, NO_KINDS, none, standingOf(["l1"], { refused: [["rf", "mismatch"]] }), [l1, refused], []);
  assert.deepEqual(r.bridges, []);
});

test("6 bridge: held links are not standing, so they carry no path", () => {
  const g = makeGroup();
  const l1 = L("l1", "identity", `${A}#m0`, `${B}#m0`);
  const l2 = L("l2", "identity", `${B}#m0`, `${A}#m1`);
  const refused = L("rf", "dictionary", `${A}#m0`, `${A}#m1`);
  const st = standingOf(["l1"], { held: [{ group: "g", alternatives: [["l2"]] }], refused: [["rf", "mismatch"]] });
  const r = round2(g, NO_KINDS, none, st, [l1, l2, refused], []);
  assert.deepEqual(r.bridges, []);
});

// ---- purity and order -------------------------------------------------------

test("deterministic and independent of member and mention order", () => {
  const act0 = L("act0", "act", `${A}#a0`, `${B}#a0`);
  const act1 = L("act1", "act", `${A}#a1`, `${B}#a1`);
  const st = standingOf(["i0", "act0", "act1"]);
  const kv = makeKindView(kindStanding, kindCandidates, on);
  const g1 = makeGroup();
  const g2 = makeGroup();
  g2.members = [B, A];
  g2.texts = { [B]: g2.texts[B], [A]: g2.texts[A] };
  const r1 = round2(g1, kv, on, st, [idA0, act0, act1], []);
  const r2 = round2(g2, kv, on, st, [act1, act0, idA0], []);
  assert.equal(JSON.stringify(r1), JSON.stringify(r2));
  assert.equal(JSON.stringify(r1), JSON.stringify(round2(g1, kv, on, st, [idA0, act0, act1], [])));
  assert.equal(JSON.stringify(pointsOf(g1, st, [idA0, act0])), JSON.stringify(pointsOf(g2, st, [act0, idA0])));
});

test("a round proposes only ids new to the links it was given", () => {
  const g = makeGroup();
  const first = round2(g, NO_KINDS, none, standingOf(["i0"]), [idA0], []);
  const again = round2(g, NO_KINDS, none, standingOf(["i0"]), [idA0, ...first.acts, ...first.links], []);
  assert.deepEqual(again.acts, []);
  assert.deepEqual(again.links, []);
});

test("no model, network or other-repo import in the source", () => {
  const src = readFileSync(fileURLToPath(new URL("./bind-sieve-struct.mjs", import.meta.url)), "utf8");
  const imports = [...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["node:crypto"]);
  for (const bad of ["pair-witness", "unit-witness", "smell", "testimony", "ollama", "11434", "11450", "anthropic", "/api/generate", "/api/chat", "/api/embed", "fetch(", "child_process", "khora", "penelope"]) {
    assert.ok(!src.toLowerCase().includes(bad.toLowerCase()), `source mentions ${bad}`);
  }
});
