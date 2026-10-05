// handlers.test.mjs — janus mounted: inert import, foreign paths untouched,
// /v1/reason doorway-compatible, wireWitnessRead once.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createJanusHandlers, validateReason } from "../native/handlers.js";
import * as corroboration from "../native/organs/corroboration.js";
import { mockReq, mockRes } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KHORA = path.resolve(HERE, "..", "..", "khora");
const haveKhora = fs.existsSync(path.join(KHORA, "claude-code-doorway.mjs")) && fs.existsSync(path.join(KHORA, "cli", "reason.mjs"));
const noop = { sourceOfWitness: (w) => String(w), recipeOfWitness: () => null };

test("importing the handlers is inert: no output, no live handles, exits at once", () => {
  const code = `import(${JSON.stringify(pathToFileURL(path.join(HERE, "..", "native", "handlers.js")).href)}).then((m) => { if (typeof m.createJanusHandlers !== "function") process.exit(3); })`;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8", timeout: 20000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, "");
  assert.ok(Date.now() - t0 < 15000);
});

test("the factory returns the mount contract", () => {
  const j = createJanusHandlers({ notesRead: noop, runReason: async () => ({ status: 200, type: "text/plain", body: "" }) });
  assert.equal(j.name, "janus");
  for (const k of ["handle", "derive", "close"]) assert.equal(typeof j[k], "function", k);
  assert.throws(() => createJanusHandlers({ runReason: "nope" }), /runReason must be a function/);
  assert.throws(() => createJanusHandlers({ notesRead: { sourceOfWitness: () => 1 } }), /notesRead must carry/);
});

test("handle ignores foreign paths and methods: returns false and writes nothing", async () => {
  let called = 0;
  const j = createJanusHandlers({ notesRead: noop, runReason: async () => { called++; return { status: 200, type: "text/plain", body: "x" }; } });
  const cases = [["GET", "/"], ["POST", "/v1/messages"], ["GET", "/v1/reasoning"], ["GET", "/v1/reason/extra"], ["GET", "/v1/surface"], ["POST", "/v1/hooks/claude-code"],
    ["PUT", "/v1/reason"], ["DELETE", "/api/reason"], ["OPTIONS", "/v1/reason"], ["GET", ""]];
  for (const [m, u] of cases) {
    const res = mockRes();
    assert.equal(await j.handle(mockReq(m, u), res), false, `${m} ${u}`);
    assert.equal(res.touched, false, `${m} ${u} wrote to the response`);
  }
  assert.equal(called, 0);
});

test("POST /v1/reason and /api/reason pass spec, flags and cwd to runReason and relay its answer verbatim", async () => {
  const seen = [];
  const j = createJanusHandlers({
    notesRead: noop,
    runReason: async (spec, flags, cwd) => { seen.push({ spec, flags, cwd }); return { status: 200, type: "application/json", body: '{"ok":true}', exit: 1 }; },
  });
  for (const u of ["/v1/reason", "/api/reason", "/v1/reason?x=1"]) {
    const res = mockRes();
    const spec = JSON.stringify({ claims: [], note: "é—ü" });
    assert.equal(await j.handle(mockReq("POST", u, { body: spec, headers: { "x-er7-reason-flags": "--json  --compact", "x-er7-cwd": "/tmp/p" } }), res), true);
    assert.equal(res.status, 200);
    assert.deepEqual(res.headers, { "content-type": "application/json", "x-er7-exit": "1" });
    assert.equal(res.body, '{"ok":true}');
    assert.deepEqual(seen.at(-1), { spec, flags: ["--json", "--compact"], cwd: "/tmp/p" });
  }
  // no x-er7-cwd header -> null, not ""
  await j.handle(mockReq("POST", "/v1/reason", { body: "{}" }), mockRes());
  assert.deepEqual(seen.at(-1), { spec: "{}", flags: [], cwd: null });
});

test("runReason's statuses and error shapes pass through: 400s, a crash body, exit 124 on timeout, no x-er7-exit when absent", async () => {
  const canned = [
    { status: 400, type: "application/json", body: JSON.stringify({ error: { type: "spec_not_json", message: "m" } }) },
    { status: 200, type: "text/plain; charset=utf-8", body: "boom\n", exit: 2 },
    { status: 200, type: "text/plain; charset=utf-8", body: "eoreader7 reason: no verdict within 110 s\n", exit: 124 },
    { status: 418, type: "text/plain", body: "tea" },
  ];
  let i = 0;
  const j = createJanusHandlers({ notesRead: noop, runReason: async () => canned[i++] });
  for (const c of canned) {
    const res = mockRes();
    await j.handle(mockReq("POST", "/v1/reason", { body: "{}" }), res);
    assert.equal(res.status, c.status);
    assert.equal(res.headers["content-type"], c.type);
    assert.equal(res.headers["x-er7-exit"], c.exit != null ? String(c.exit) : undefined);
    assert.equal(res.body, c.body);
  }
});

test("a throwing runReason is a 500 JSON error, never an unhandled rejection or a 404", async () => {
  const j = createJanusHandlers({ notesRead: noop, runReason: async () => { throw new Error("spawn EAGAIN"); } });
  const res = mockRes();
  assert.equal(await j.handle(mockReq("POST", "/v1/reason", { body: "{}" }), res), true);
  assert.equal(res.status, 500);
  assert.equal(JSON.parse(res.body).error.type, "reason_failed");
});

test("GET /v1/reason serves the format text as text/plain", async () => {
  const j = createJanusHandlers({ notesRead: noop, reasonFormat: () => "the format\n" });
  const res = mockRes();
  assert.equal(await j.handle(mockReq("GET", "/api/reason"), res), true);
  assert.equal(res.status, 200);
  assert.deepEqual(res.headers, { "content-type": "text/plain; charset=utf-8" });
  assert.equal(res.body, "the format\n");
  const j2 = createJanusHandlers({ notesRead: noop, khoraDir: path.join(os.tmpdir(), "no-such-khora") });
  const r2 = mockRes();
  assert.equal(await j2.handle(mockReq("GET", "/v1/reason"), r2), true);
  assert.equal(r2.status, 503);
});

test("close(): handle declines everything afterwards, without writing", async () => {
  const j = createJanusHandlers({ notesRead: noop, runReason: async () => ({ status: 200, type: "text/plain", body: "x" }) });
  j.close();
  const res = mockRes();
  assert.equal(await j.handle(mockReq("POST", "/v1/reason", { body: "{}" }), res), false);
  assert.equal(res.touched, false);
  j.close(); // idempotent
});

test("wireWitnessRead is called ONCE by the factory, with the injected pair, and never again by handle/derive", async () => {
  let reads = 0;
  const src = (w) => `S:${w}`, rec = () => "R";
  const notesRead = { get sourceOfWitness() { reads++; return src; }, get recipeOfWitness() { return rec; } };
  const j = createJanusHandlers({ notesRead, runReason: async () => ({ status: 200, type: "text/plain", body: "" }) });
  assert.equal(reads, 1, "destructured exactly once at construction");
  await j.handle(mockReq("POST", "/v1/reason", { body: "{}" }), mockRes());
  await j.derive("free text");
  await j.derive({ end1: "a", label: "r", end2: "b" });
  assert.equal(reads, 1, "never re-read after boot");
  assert.equal(corroboration.sourceOfWitness, src);
  assert.equal(corroboration.recipeOfWitness, rec);
  assert.equal([...corroboration.distinctSources(["x"])][0], "S:x", "the injected read is what corroboration really uses");
  // omitting notesRead afterwards leaves the earlier wiring alone and does not throw
  assert.doesNotThrow(() => createJanusHandlers({ runReason: async () => ({}) }));
  assert.equal(corroboration.sourceOfWitness, src);
});

// ── the doorway comparison ────────────────────────────────────────────────

test("COMPAT: validation errors are byte-identical to khora's doorway (unknown flag, spec_not_json, flag-before-json order)", { skip: !haveKhora && "khora checkout not found" }, async () => {
  const doorway = await import(pathToFileURL(path.join(KHORA, "claude-code-doorway.mjs")).href);
  const j = createJanusHandlers({ notesRead: noop, khoraDir: KHORA });
  const cases = [
    { body: "{}", flags: "--nope" },
    { body: "not json", flags: "" },
    { body: "not json", flags: "--json --bogus --alsobad" },
    { body: "", flags: "" },
  ];
  for (const c of cases) {
    const mk = () => mockReq("POST", "/v1/reason", { body: c.body, headers: { "x-er7-reason-flags": c.flags } });
    const a = mockRes(), b = mockRes();
    assert.equal(await doorway.route(mk(), a), true);
    assert.equal(await j.handle(mk(), b), true);
    assert.equal(b.status, 400);
    assert.deepEqual({ s: b.status, h: b.headers, b: b.body }, { s: a.status, h: a.headers, b: a.body }, JSON.stringify(c));
  }
  // and the exported validator says the same thing the doorway's runReason does
  const direct = await doorway.runReason("nope", []);
  assert.deepEqual(validateReason("nope", []), { status: direct.status, type: direct.type, body: direct.body });
});

test("COMPAT: GET format and a real spawned verdict (text and --json) are byte-identical to khora's doorway", { skip: !haveKhora && "khora checkout not found", timeout: 280000 }, async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "janus-compat-home-"));
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "janus-compat-proj-"));
  const prevHome = process.env.HOME;
  process.env.HOME = home; // reason.mjs writes a record under ~/.claude; keep it out of the real home
  try {
    const doorway = await import(pathToFileURL(path.join(KHORA, "claude-code-doorway.mjs")).href);
    const j = createJanusHandlers({ notesRead: noop, khoraDir: KHORA });
    const g1 = mockRes(), g2 = mockRes();
    await doorway.route(mockReq("GET", "/v1/reason"), g1);
    await j.handle(mockReq("GET", "/v1/reason"), g2);
    assert.deepEqual({ s: g2.status, h: g2.headers, b: g2.body }, { s: g1.status, h: g1.headers, b: g1.body });
    assert.ok(g2.body.includes("REASONING, DONE BY THE ENGINE"));

    const spec = JSON.stringify({ claims: [
      { ground: "/p1", rel: "has-type", roles: { ARG0: "x", ARG1: "int" }, polarity: "+", force: "strict", id: "c1" },
      { ground: "/p1", rel: "has-type", roles: { ARG0: "x", ARG1: "string" }, polarity: "+", force: "strict", id: "c2" },
    ], declare: { functional: ["has-type"] } });
    // each real run is ~20 s cold; run the doorway's and janus's side by side
    await Promise.all(["", "--json"].map(async (flags) => {
      const mk = () => mockReq("POST", "/v1/reason", { body: spec, headers: { "x-er7-reason-flags": flags, "x-er7-cwd": proj } });
      const a = mockRes(), b = mockRes();
      await Promise.all([doorway.route(mk(), a), j.handle(mk(), b)]);
      assert.equal(b.status, 200);
      assert.ok(["0", "1"].includes(b.headers["x-er7-exit"]), `exit ${b.headers["x-er7-exit"]}`);
      assert.deepEqual({ s: b.status, h: b.headers, b: b.body }, { s: a.status, h: a.headers, b: a.body }, `flags "${flags}"`);
    }));
  } finally {
    process.env.HOME = prevHome;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(proj, { recursive: true, force: true });
  }
});
