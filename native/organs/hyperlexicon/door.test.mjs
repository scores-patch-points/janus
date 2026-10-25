// door.test.mjs — the hyperlexicon door answers what the traversal API answers, over HTTP, and adds nothing of its own.
// A stand-in hyperlexicon (the shape traverse.mjs::openHyperlexicon returns) over a two-document corpus; the full log's own checks
// are traverse.check.mjs, run where the log lives.
//   node --test native/organs/hyperlexicon/door.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { answer, door, SCHEMA } from "./door.mjs";

const TEXT = { "a.txt": "Bread, eggs, etc. were sold. The ports. Dr. Lee left.", "b.txt": "He sailed to the ports. Etc. and so on." };
const tokens = (path) => [...TEXT[path].matchAll(/\w+/g)].map((m) => ({ w: m[0].toLowerCase(), start: Buffer.byteLength(TEXT[path].slice(0, m.index)), length: Buffer.byteLength(m[0]) }));
const hl = {
  head: "stand-in-head", manifest: { types: 99 }, docs: () => [{ path: "a.txt" }, { path: "b.txt" }],
  usesOf(word, ground = {}, { limit = 100, offset = 0 } = {}) {
    const all = Object.keys(TEXT).flatMap((path) => tokens(path).filter((t) => t.w === String(word).toLowerCase()).map((t) => ({ doc: path, path, address: `${path}#${t.start}`, start: t.start, length: t.length, offsets: "byte" })));
    return { word, head: this.head, ground, total: all.length, uses: all.slice(offset, offset + limit) };
  },
  reopen(address, { length = 64, context = 0 } = {}) {
    const [path, s] = address.split("#"), buf = Buffer.from(TEXT[path]), a = Math.max(0, +s - context), b = Math.min(buf.length, +s + length + context);
    return { address, bytes: buf.subarray(a, b), text: buf.subarray(a, b).toString("utf8") };
  },
  companyOf(word, ground, { radius }) { return { word, head: this.head, reach: { radius, basis: "declared by the caller" } }; },
  along(word) { return { word, head: this.head, points: [] }; },
  absence(word) { return { null: "never-set", word }; },
  nodesAt(path, byte) { return { head: this.head, address: `${path}#${byte}` }; },
  node(id) { return id === "n_1" ? { id, lemma: "port" } : null; },
  relations(id) { return { head: this.head, node: id }; },
};

test("after: the characters straight after each use, read off the bytes, each with its address", () => {
  const a = answer(hl, { op: "after", word: "etc", chars: 3 });
  assert.equal(a.total, 2);
  assert.deepEqual(a.after.map((x) => x.next), [". w", ". a"]);
  assert.deepEqual(a.after.map((x) => x.address), ["a.txt#13", "b.txt#24"]);
  const p = answer(hl, { op: "after", word: "ports", chars: 3 });
  assert.deepEqual(p.after.map((x) => x.next), [". D", ". E"], "what follows is the material's own bytes: the door says what is there, not what it means");
});

test("company is read only at a reach the caller declares", () => {
  assert.equal(answer(hl, { op: "company", word: "ports" }).gap, "no_radius");
  assert.equal(answer(hl, { op: "company", word: "ports", radius: 3 }).reach.radius, 3);
});

test("reopen answers text, never raw bytes; unknown asks and missing arguments are typed refusals", () => {
  const r = answer(hl, { op: "reopen", address: "a.txt#0", length: 5 });
  assert.equal(r.text, "Bread"); assert.equal(r.bytes, undefined); assert.equal(r.head, "stand-in-head");
  assert.equal(answer(hl, { op: "uses" }).gap, "no_word");
  assert.equal(answer(hl, { op: "shout", word: "x" }).gap, "unknown_op");
  assert.equal(answer(hl, { op: "node", id: "n_2" }).gap, "not_a_giver_node");
});

test("the HTTP door: a handshake, one ask, a batch in order, and typed errors", async () => {
  const srv = door(hl); await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const h = await (await fetch(`${base}/v1/hyperlexicon`)).json();
    assert.equal(h.schema, SCHEMA); assert.equal(h.head, "stand-in-head"); assert.equal(h.docs, 2);
    const one = await (await fetch(`${base}/v1/ask`, { method: "POST", body: JSON.stringify({ op: "uses", word: "ports" }) })).json();
    assert.equal(one.total, 2);
    const b = await (await fetch(`${base}/v1/batch`, { method: "POST", body: JSON.stringify({ asks: [{ op: "uses", word: "etc" }, { op: "after", word: "dr", chars: 4 }, { op: "nope" }] }) })).json();
    assert.equal(b.head, "stand-in-head");
    assert.deepEqual([b.answers[0].total, b.answers[1].after[0].next, b.answers[2].gap], [2, ". Le", "unknown_op"]);
    assert.equal((await fetch(`${base}/v1/ask`, { method: "POST", body: "{not json" })).status, 400);
    assert.equal((await fetch(`${base}/v1/elsewhere`)).status, 404);
    const many = await fetch(`${base}/v1/batch`, { method: "POST", body: JSON.stringify({ asks: Array(401).fill({ op: "uses", word: "x" }) }) });
    assert.equal(many.status, 413);
  } finally { srv.close(); }
});
