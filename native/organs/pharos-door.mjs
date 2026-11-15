// native/organs/pharos-door.mjs — janus's own door onto the shared log (pharos), 2026-11-14.
// The ruling: no repo reports to another; each writes its own entries to the log
// directly and reads the others' entries from it. This file is the only place
// janus opens pharos. It knows pharos by a POINTER, the file pharos's own door
// writes ({ lib, sha256 }), and knows no other repo at all.
//
//   pointer = opts.pointer, else $JANUS_PHAROS_JSON, else <this checkout>/pharos.json
//   log     = opts.log, else $PHAROS_LOG, else "fold"   (one shared log; a plain token)
//   writer  = "janus" (one file per writer inside the log's directory)
//
// No pointer, or a lib whose bytes do not match the pin: the door is OFF and
// says why. Nothing is written anywhere else in its place, and nothing throws:
// a caller keeps its own record and counts the miss. Writing here is additive,
// never blocking, the caller decides what a miss costs.
//
// COST, DISCLOSED: pharos's weave re-reads its view per call (measured in the
// pharos notes at about 0.2 s per call at 3,000 entries). Fine for a run of a
// few dozen claims; a bulk path is pharos's to add, not this file's.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WRITER = "janus";
const TOKEN = /^[A-Za-z0-9._-]+$/;

/** openDoor({ pointer, log, dir, writer }) -> { on, why, log, weave, fold, declare, counts }. Never throws. */
export async function openDoor({ pointer = null, log = null, dir = null, writer = WRITER } = {}) {
  const counts = { woven: 0, refused: 0, lastReason: null };
  const off = (why) => ({ on: false, why, log: null, counts, weave: () => { counts.refused += 1; counts.lastReason = why; return null; }, fold: () => null, declare: () => null });
  try {
    const name = log ?? process.env.PHAROS_LOG ?? "fold";
    if (!TOKEN.test(name)) return off(`log name must be a plain token: ${name}`);
    const ptrPath = pointer ?? process.env.JANUS_PHAROS_JSON ?? path.join(HERE, "..", "..", "pharos.json");
    if (!fs.existsSync(ptrPath)) return off(`no pharos pointer at ${ptrPath}`);
    const ptr = JSON.parse(fs.readFileSync(ptrPath, "utf8"));
    const lib = path.resolve(path.dirname(ptrPath), String(ptr.lib));
    const got = crypto.createHash("sha256").update(fs.readFileSync(lib)).digest("hex");
    if (got !== ptr.sha256) return off(`pharos lib at ${lib} is not the pinned one (${got.slice(0, 12)} vs ${String(ptr.sha256).slice(0, 12)})`);
    const P = await import(pathToFileURL(lib).href);
    const h = P.open(name, { writer, ...(dir ? { dir } : {}) });
    const weave = (input) => {
      try { const e = P.weave(h, input); counts.woven += 1; return e; }
      catch (e) { counts.refused += 1; counts.lastReason = `${e?.code ?? "ERR"} ${e?.message ?? e}`; return null; }
    };
    const fold = (filter = {}) => { try { return P.fold(h, filter).entries; } catch (e) { counts.lastReason = String(e?.message ?? e); return null; } };
    /** declare(name, cell, why): a kind is an entry, written once before its first mark. */
    const declare = (kind, cell, why) => {
      const have = (fold({ kind: "kind" }) ?? []).find((e) => e.body?.name === kind);
      if (have) return have;
      return weave({ cell: "DEF·Figure", kind: "kind", addr: `kind:${kind}`, body: { name: kind, cell, why } });
    };
    return { on: true, why: "open", log: name, counts, weave, fold, declare };
  } catch (e) { return off(`could not open pharos: ${e?.message ?? e}`); }
}
