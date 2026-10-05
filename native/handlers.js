// native/handlers.js — JANUS, MOUNTABLE (the one Fold server).
//
// janus is a library; the operator wants khora + penelope + janus + heimdall in
// ONE process. This file is janus's mount point: a factory the composition
// root calls once, returning
//
//   { name: "janus", handle(req, res): Promise<boolean>, derive, close() }
//
//   handle   true iff janus consumed the request (it has written the response);
//            false for anything that is not janus's, WITHOUT writing a byte —
//            never a 404, so the next organ in the chain gets its turn.
//   derive   the seam `classifyTurn({ derive })` (khora's organs/reason-gate.js)
//            expects: derive(task, { notes, taskLog, hyperlexicon })
//              -> { settled, reason?, derivation? }
//   close    stop owning anything: kills in-flight reason runs, and handle
//            declines every request afterwards.
//
// WHAT JANUS OWNS HERE: GET|POST /v1/reason, alias /api/reason — the door the
// khora has served from claude-code-doorway.mjs by spawning cli/reason.mjs.
// The response shape is the doorway's, byte for byte (statuses, error bodies,
// the x-er7-exit header); test/handlers.test.mjs compares the two directly.
//
// DEFAULT runReason = the doorway's own spawn of khora's cli/reason.mjs
// (resolved from opts.khoraDir). An in-process port is out of scope: reason.mjs
// imports khora's own copies of the closure plus mathjs, and janus must not
// grow a second copy of either. Inject `runReason` to replace it.
//
// THE ONE CROSSING (JANUS-EXTRACTION.md, D1): corroboration.js reads witnesses
// off the perceiver's ledger through `wireWitnessRead({ sourceOfWitness,
// recipeOfWitness })`; unwired it throws TypeError on first use. The factory
// wires it ONCE, from `opts.notesRead` (khora's kernel/notes.js exports).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { wireWitnessRead, sourceOfWitness as wiredSource, recipeOfWitness as wiredRecipe } from "./organs/corroboration.js";
import { makeDerivation, DERIVED_PREFIX } from "./organs/derivation.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KHORA_DIR = path.resolve(HERE, "..", "..", "khora");

// The doorway's own numbers (claude-code-doorway.mjs: REASON_BUDGET_MS). The
// brief said 60 s; the doorway says 110 s. Byte-compat with the doorway wins,
// and `reasonBudgetMs` overrides it.
export const REASON_BUDGET_MS = 110000;
export const REASON_FLAGS = Object.freeze(["--ants", "--json", "--compact"]);
export const REASON_PATHS = Object.freeze(["/v1/reason", "/api/reason"]);

const jsonError = (status, type, message) => ({ status, type: "application/json", body: JSON.stringify({ error: { type, message } }) });

/** The doorway's validation, shared by the default runner. null = fine. */
export function validateReason(spec, flags) {
  const known = new Set(REASON_FLAGS);
  const unknown = flags.filter((f) => !known.has(f));
  if (unknown.length) return jsonError(400, "unknown_reason_flag", `unknown flag(s): ${unknown.join(" ")}; known: ${[...known].join(" ")}`);
  try { JSON.parse(spec); } catch (e) { return jsonError(400, "spec_not_json", `the spec is not JSON: ${e.message}`); }
  return null;
}

/**
 * The DEFAULT runReason: the doorway's runReason, with the khora directory and
 * the budget made parameters and the children tracked so close() can kill them.
 * (spec, flags, cwd) -> { status, type, body, exit? }
 */
export function makeSpawnReason({ khoraDir = DEFAULT_KHORA_DIR, budgetMs = REASON_BUDGET_MS, children = new Set() } = {}) {
  const script = path.join(khoraDir, "cli", "reason.mjs");
  const runNode = (args, input, cwd) => new Promise((resolve) => {
    let out = "", err = "", timedOut = false;
    const child = spawn(process.execPath, [script, ...args], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    children.add(child);
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, budgetMs);
    const done = (v) => { clearTimeout(timer); children.delete(child); resolve(v); };
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.stdin.on("error", () => {});
    child.on("error", (e) => done({ code: null, out, err: String(e?.message ?? e), timedOut }));
    child.on("close", (code) => done({ code, out, err, timedOut }));
    child.stdin.end(input);
  });
  return async function runReason(spec, flags = [], cwd = null) {
    const bad = validateReason(spec, flags);
    if (bad) return bad;
    const dir = cwd && path.isAbsolute(cwd) && fs.existsSync(cwd) ? cwd : khoraDir;
    const r = await runNode(flags, spec, dir);
    // Exit 0 is a pass and 1 a verdict with errors; anything else is a crash,
    // and then its stderr is the answer.
    const crashed = r.timedOut || (r.code !== 0 && r.code !== 1);
    const body = crashed ? `${r.out}${r.err || (r.timedOut ? `eoreader7 reason: no verdict within ${budgetMs / 1000} s\n` : "")}` : r.out;
    return { status: 200, type: flags.includes("--json") && !crashed ? "application/json" : "text/plain; charset=utf-8", body, exit: r.timedOut ? 124 : r.code ?? 1 };
  };
}

/** reason.mjs's leading comment block, as the doorway's reasonFormat writes it. */
export function readReasonFormat(khoraDir = DEFAULT_KHORA_DIR) {
  const lines = fs.readFileSync(path.join(khoraDir, "cli", "reason.mjs"), "utf8").split("\n");
  const head = [];
  for (const l of lines) {
    if (l.startsWith("#!")) continue;
    if (!l.startsWith("//")) break;
    head.push(l.slice(l.startsWith("// ") ? 3 : 2));
  }
  return head.join("\n") + "\n";
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

// ── derive ───────────────────────────────────────────────────────────────

/** Why derive declines — a closed class of typed gaps (II.2), each a sentence naming what to supply. */
export const DERIVE_REFUSALS = Object.freeze({
  no_witness_read: "janus's corroboration is unwired: pass `notesRead` ({sourceOfWitness, recipeOfWitness} from khora's kernel/notes.js) to createJanusHandlers (JANUS-EXTRACTION.md D1)",
  no_ledger: "no notes ledger: derive needs `notes` (the ledger log), `taskLog` and `hyperlexicon` — in the second argument, or as `context` on createJanusHandlers. Janus never reads them itself",
  no_policy: "no declared derivation policy: `declarations`, `floor` ({sources, instruments}), `carry` (boolean) and `maxSteps` are the caller's declared numbers (derivation.js: never defaulted here)",
  no_claim: "the task is free text and janus does not read: pass a structured claim ({end1, label, end2} or {subject, verb, object}) as the task, or inject `claimOf(task)` — the reader's job, khora's side of the seam",
  not_derived: "the deriver ran to quiescence over the declared floor and no derived product is this claim",
});

const claimEnds = (c) => {
  if (!c || typeof c !== "object") return null;
  const end1 = c.end1 ?? c.subject, label = c.label ?? c.verb, end2 = c.end2 ?? c.object;
  return [end1, label, end2].every((x) => typeof x === "string" && x.trim()) ? { end1, label, end2 } : null;
};

/**
 * makeDerive({ context, claimOf, log }) -> derive(task, ctx)
 *
 * A thin, honest composition of derivation.js (`makeDerivation(...).derive`),
 * the kernel's own licensed closure over a ledger. It settles a claim iff that
 * closure produces a derived note whose identity IS the claim's identity
 * (`derived:` + hyperlexicon.assertionId). It never matches on prose, never
 * invents a step, never writes the ledger (the deriver returns a NEW log; it is
 * discarded). Everything else is `{ settled:false, reason }`, and so is every
 * throw — classifyTurn awaits derive bare, and a typed gap beats a 500.
 *
 * `context` (object or () => object) supplies defaults for the second argument,
 * because classifyTurn today calls `derive(task)` with ONE argument:
 *   { notes, taskLog, hyperlexicon, declarations, floor, carry, maxSteps,
 *     cue?, presenceFloor?, cycleLimit? }
 */
export function makeDerive({ context = null, claimOf = null, log = () => {} } = {}) {
  return async function derive(task, ctx = {}) {
    try {
      const base = typeof context === "function" ? (context() ?? {}) : (context ?? {});
      const c = { ...base, ...(ctx ?? {}) };
      const refuse = (reason) => ({ settled: false, reason });

      let claim = claimEnds(task);
      if (!claim && typeof task === "string" && typeof claimOf === "function") claim = claimEnds(await claimOf(task));
      if (!claim) return refuse(DERIVE_REFUSALS.no_claim);
      if (typeof wiredSource !== "function" || typeof wiredRecipe !== "function") return refuse(DERIVE_REFUSALS.no_witness_read);
      const { notes: ledger, taskLog, hyperlexicon: hl } = c;
      if (!ledger || !taskLog || !hl) return refuse(DERIVE_REFUSALS.no_ledger);
      const { declarations, floor, carry, maxSteps } = c;
      if (!declarations || !floor || typeof carry !== "boolean" || !Number.isInteger(maxSteps)) return refuse(DERIVE_REFUSALS.no_policy);

      const D = makeDerivation({ hl, taskLog });
      const r = D.derive(ledger, { declarations, floor, carry, maxSteps, ...(c.cue != null ? { cue: c.cue, presenceFloor: c.presenceFloor } : {}), ...(c.cycleLimit != null ? { cycleLimit: c.cycleLimit } : {}) });
      const id = DERIVED_PREFIX + hl.assertionId(claim.end1, claim.label, claim.end2);
      const hit = r.derived.find((d) => d.id === id);
      if (!hit) {
        return refuse(`${DERIVE_REFUSALS.not_derived} (${r.derived.length} derived, ${r.stopped.length} premise(s) stopped at the floor, ${r.withheld.length} withheld, ${r.vetoed.length} vetoed)`);
      }
      const byId = new Map(hl.foldNotes(ledger).map((n) => [n.id, n]));
      return {
        settled: true,
        reason: `derived from ${hit.premises.length} premise(s) at depth ${hit.depth} under licence of ${hit.giver} — computed by the kernel, never generated`,
        derivation: {
          id: hit.id, claim, subject: hit.subject, verb: hit.verb, object: hit.object,
          depth: hit.depth, paths: hit.paths, giver: hit.giver, affordance: hit.affordance,
          premises: hit.premises.map((p) => { const n = byId.get(p); return n ? { id: p, end1: n.end1, label: n.label, end2: n.end2 } : { id: p }; }),
          grounds: hit.grounds, provenance: hit.provenance, restsOn: hit.restsOn,
          licences: r.licences, quiescent: r.quiescent, steps: r.steps,
        },
      };
    } catch (e) {
      log(`janus derive: ${e?.message ?? e}`);
      return { settled: false, reason: `derivation could not run: ${String(e?.message ?? e)}` };
    }
  };
}

// ── the factory ──────────────────────────────────────────────────────────

/**
 * createJanusHandlers(opts)
 *   notesRead        { sourceOfWitness, recipeOfWitness } — khora's kernel/notes.js. Wired ONCE here.
 *   runReason        (spec, flags, cwd) -> { status, type, body, exit? }. Default: spawn khora's cli/reason.mjs.
 *   khoraDir         where khora lives (default ../khora next to this checkout).
 *   reasonBudgetMs   default 110000 (the doorway's).
 *   reasonFormat     () -> string for GET /v1/reason. Default: reason.mjs's header, from khoraDir.
 *   deriveContext    object | () => object — defaults for derive's second argument (see makeDerive).
 *   claimOf          (task string) -> claim | null — optional reader for free-text tasks.
 *   log              (line) => void
 */
export function createJanusHandlers(opts = {}) {
  const { notesRead = null, khoraDir = DEFAULT_KHORA_DIR, reasonBudgetMs = REASON_BUDGET_MS, deriveContext = null, claimOf = null, log = () => {} } = opts;
  if (opts.runReason != null && typeof opts.runReason !== "function") throw new TypeError("createJanusHandlers: runReason must be a function (spec, flags, cwd) => {status, type, body, exit?}");
  if (notesRead != null) {
    // read each property exactly once (a getter-backed bundle must see one read)
    const { sourceOfWitness: s, recipeOfWitness: r } = notesRead;
    if (typeof s !== "function" || typeof r !== "function") {
      throw new TypeError("createJanusHandlers: notesRead must carry sourceOfWitness and recipeOfWitness functions (khora's kernel/notes.js exports)");
    }
    wireWitnessRead({ sourceOfWitness: s, recipeOfWitness: r });
  } else if (typeof wiredSource !== "function") {
    log("janus: notesRead not given and corroboration is unwired — /v1/reason works, but derive will decline until the witness read is injected");
  }

  const children = new Set();
  const runReason = opts.runReason ?? makeSpawnReason({ khoraDir, budgetMs: reasonBudgetMs, children });
  const reasonFormat = opts.reasonFormat ?? (() => readReasonFormat(khoraDir));
  const derive = makeDerive({ context: deriveContext, claimOf, log });
  let closed = false;

  async function handle(req, res) {
    if (closed) return false;
    const url = String(req?.url ?? "").split("?")[0];
    if (!REASON_PATHS.includes(url)) return false;
    if (req.method === "GET") {
      let text;
      try { text = reasonFormat(); } catch (e) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { type: "reason_unavailable", message: `the reason door's format is unreadable: ${e?.message ?? e}` } }));
        return true;
      }
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(text);
      return true;
    }
    if (req.method === "POST") {
      const spec = await readBody(req);
      const flags = String(req.headers?.["x-er7-reason-flags"] ?? "").split(/\s+/).filter(Boolean);
      let r;
      try { r = await runReason(spec, flags, String(req.headers?.["x-er7-cwd"] ?? "") || null); } catch (e) {
        log(`janus /v1/reason: runReason threw: ${e?.message ?? e}`);
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { type: "reason_failed", message: String(e?.message ?? e) } }));
        return true;
      }
      res.writeHead(r.status, { "content-type": r.type, ...(r.exit != null ? { "x-er7-exit": String(r.exit) } : {}) });
      res.end(r.body);
      return true;
    }
    return false;
  }

  function close() {
    closed = true;
    for (const c of children) { try { c.kill("SIGKILL"); } catch { /* already gone */ } }
    children.clear();
  }

  return { name: "janus", handle, derive, close };
}
