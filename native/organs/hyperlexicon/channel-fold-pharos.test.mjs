import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { openDoor } from "../pharos-door.mjs";
import { weaveWordFold, WORD_FOLD_KIND } from "./channel-fold-pharos.mjs";

const LIB = process.env.PHAROS_LIB ?? "";
const skip = LIB && fs.existsSync(LIB) ? false : "pharos library not found (set PHAROS_LIB to pharos/lib/pharos.mjs)";
const reading = { schema: "ChannelFold@1", channel: "link:translation", a: "buy", b: "purchase", per: [{ radius: 1, shared: 41, sizes: [335, 204], capped: false, empty: false, null: { n: 3, mean: 1, counts: [0, 1, 2] } }] };

test("a door that is off weaves nothing", () => {
  assert.equal(weaveWordFold({ on: false }, reading), null);
});

test("the fold is woven as counts by writer janus, with no verdict in it", { skip }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "wf-"));
  const pointer = path.join(d, "pharos.json");
  fs.writeFileSync(pointer, JSON.stringify({ lib: LIB, sha256: crypto.createHash("sha256").update(fs.readFileSync(LIB)).digest("hex") }));
  const door = await openDoor({ pointer, dir: path.join(d, "log") });
  const e = weaveWordFold(door, reading, { store: "test" });
  assert.equal(e.by, "janus");
  assert.equal(e.addr, "word-fold:link:translation:buy|purchase");
  assert.deepEqual(e.body.per[0].null.counts, [0, 1, 2]);
  assert.equal(door.fold({ kind: WORD_FOLD_KIND }).length, 1);
  const flat = JSON.stringify(e.body);
  for (const k of ["above", "same", "verdict", "p95"]) assert.equal(flat.includes(`"${k}"`), false);
});
