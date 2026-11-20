// guards for PREREG-ANT-COLONY-SURPRISE: node test_ants.mjs
import assert from "node:assert/strict"; import fs from "node:fs";
import { items, cut, join, apply, allowed, walk, layTrail, lcg, permuteTokens, candidateMoves, goldF1, DEPTH } from "./antlib.mjs";
const toks = (its) => its.map((x) => x.t);
// 1. moves: cut splits a suffix off any token that ends with it and keeps spans; join undoes ONLY the pieces a cut produced
const base = items(["Oscar's", "knot", "'s", "A"]), c = cut(base, "'s"); assert.deepEqual(toks(c), ["Oscar", "'s", "knot", "'s", "A"], "a token that IS the suffix is not cut (nothing is left of it)"); assert.deepEqual(c.map((x) => [x.a, x.b]).slice(0, 2), [[0, 5], [5, 7]]);
assert.deepEqual(toks(join(c, "'s")), ["Oscar's", "knot", "'s", "A"].map((w) => w), "join re-attaches only the cut piece (tag), not the standalone 's");
assert.deepEqual(toks(apply(base, ["cut:'s", "join:'s"])), toks(base), "cut then join is the identity");
// 2. THE DEPENDENCY ORDER: guard on, all SEG before any CON; join only after its own cut; no move twice; guard off allows anything unused
const R = ["cut:a", "cut:b", "join:a", "join:b"];
assert.deepEqual(allowed([], R, true), ["cut:a", "cut:b"], "a join cannot start a program: nothing was cut"); assert.deepEqual(allowed(["cut:a"], R, true), ["cut:b", "join:a"]);
assert.deepEqual(allowed(["cut:a", "join:a"], R, true), [], "after a CON move no SEG move may follow, and join:b has no cut:b"); assert.deepEqual(allowed(["cut:a"], R, false), ["cut:b", "join:a", "join:b"], "guard off: join:b before cut:b is allowed");
assert.equal(allowed(["cut:a", "cut:b"], R, true).includes("cut:a"), false, "no move twice");
// 3. a walk never violates the guard (over many seeded walks) and is deterministic for a seed; trails steer it
const routes = ["cut:a", "cut:b", "cut:c", "join:a", "join:b", "join:c"]; let seenJoin = false;
for (let s = 1; s <= 200; s++) { const w = walk({}, { routes, rng: lcg(s), now: 1e12, tried: new Set(), guard: true, useTrails: true }); if (!w) continue; let joined = false; const cuts = new Set(); for (const m of w) { if (m.startsWith("cut:")) { assert.equal(joined, false, `SEG after CON in ${w}`); cuts.add(m.slice(4)); } else { joined = true; seenJoin = true; assert.ok(cuts.has(m.slice(5)), `join without cut in ${w}`); } } assert.ok(w.length <= DEPTH); }
assert.ok(seenJoin, "guarded walks do reach joins"); assert.deepEqual(walk({}, { routes, rng: lcg(7), now: 1e12, tried: new Set(), guard: true, useTrails: true }), walk({}, { routes, rng: lcg(7), now: 1e12, tried: new Set(), guard: true, useTrails: true }));
let trails = {}; for (let i = 0; i < 6; i++) trails = layTrail(trails, ["cut:c"], true, i, 1e12); const first = new Map(); for (let s = 1; s <= 60; s++) { const w = walk(trails, { routes, rng: lcg(s), now: 1e12, tried: new Set(), guard: true, useTrails: true }); first.set(w[0], (first.get(w[0]) ?? 0) + 1); } assert.ok((first.get("cut:c") ?? 0) > 30, "a strong trail on cut:c makes ants take it first most of the time");
assert.equal(layTrail({}, ["cut:a"], false, 0, 1e12) && Object.keys(layTrail({}, ["cut:a"], false, 0, 1e12)).length, 0, "a failure deposits nothing");
// 4. the ceiling's null keeps each token's characters and destroys their order
const p = permuteTokens(["Oscar's", "knot", "residence"], 5); p.forEach((t, i) => assert.equal([...t].sort().join(""), [...["Oscar's", "knot", "residence"][i]].sort().join(""))); assert.notDeepEqual(p, ["Oscar's", "knot", "residence"]); assert.deepEqual(p, permuteTokens(["Oscar's", "knot", "residence"], 5), "seeded");
// 5. candidate moves come from the stream only, as cut and join pairs (a suffix must end at least MIN distinct types and fire at least MIN times)
const rep = []; for (let i = 0; i < 30; i++) rep.push(`walk${String.fromCharCode(97 + (i % 26))}${i}ing`, `x${i}ing`); const cm = candidateMoves(rep); assert.ok(cm.includes("cut:ing") && cm.includes("join:ing"), cm.join(" ")); assert.equal(cm.length % 2, 0); assert.deepEqual(candidateMoves(["a", "bb", "cc"]), [], "a stream with no recurring suffix proposes nothing");
// 6. gold is read only by goldF1: the program evaluation code names no gold; an identity program equals the baseline tokenizer's boundary F1
const src = fs.readFileSync(new URL("./antlib.mjs", import.meta.url), "utf8"), outside = src.slice(0, src.indexOf("/** GOLD AGREEMENT")).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); assert.equal(/gold/i.test(outside), false, "gold appears in code outside goldF1");
const tk = (s) => s.split(" "), g = goldF1([{ raw: "Oscar's knot", gold: ["Oscar", "'s", "knot"] }], ["cut:'s"], tk), g0 = goldF1([{ raw: "Oscar's knot", gold: ["Oscar", "'s", "knot"] }], [], tk); assert.ok(g.F1 > g0.F1, "the right cut raises agreement with the gold tokenization");
assert.equal(/RegExp|\.match\(|\.replace\(\//.test(src), false, "no regex"); console.log("test_ants: OK");
