import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { hits, gate, carried } from "./text-regex-ratchet.mjs";
const mk = (files) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "trr-")); fs.mkdirSync(path.join(d, "organs")); for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(d, "organs", n), t); return d; };
test("a regex applied to a value is a hit; a plain string, a comment-only mention and a test file are not", () => {
  const d = mk({ "a.mjs": 'const x = s.match(/where.*live/i);\nconst y = s.indexOf("a");\n', "b.test.mjs": "s.match(/x/)\n" });
  const h = hits(["organs"], d); assert.equal(h.length, 1); assert.equal(h[0].line, 1);
});
test("the forms: replace, split, exec, .test on a literal", () => { const d = mk({ "a.mjs": 's.replace(/a/g, "")\ns.split(/,/)\n/^x$/.test(s)\nre.exec(s)\n' }); assert.equal(hits(["organs"], d).length, 3, "re.exec(s) has no literal: not seen, and the header says so"); });
test("a declared non-language use is exempt, with a reason on the line or the line before; an empty reason is not", () => {
  const d = mk({ "a.mjs": 's.match(/\\d+/) // regex-ok: a page number in a url\n// regex-ok: a sha\nh.replace(/[^a-f0-9]/g, "")\ns.match(/x/) // regex-ok:\n' });
  assert.equal(hits(["organs"], d).length, 1, "only the one with an empty reason counts");
});
test("the ratchet: a carried hit passes, a NEW hit fails, a fixed-then-returned hit fails again", () => {
  const d = mk({ "a.mjs": "s.match(/a/)\n" }), h0 = hits(["organs"], d), rec = (h, st) => ({ id: h.id, status: st });
  assert.equal(gate(h0, [rec(h0[0], "red")]).ok, true);
  assert.equal(gate(h0, []).ok, false);
  fs.writeFileSync(path.join(d, "organs", "a.mjs"), "s.match(/a/)\ns.match(/b/)\n"); const h1 = hits(["organs"], d); assert.deepEqual(gate(h1, [rec(h0[0], "red")]).fresh.map((x) => x.text), ["s.match(/b/)"]);
  assert.equal(gate(h0, [rec(h0[0], "red"), rec(h0[0], "green")]).ok, false, "fixed, then it returned: NEW again");
  assert.deepEqual([...carried([rec(h0[0], "red"), rec(h0[0], "green")])], []);
});
test("the id survives an edit elsewhere in the file and changes when the line changes", () => {
  const d = mk({ "a.mjs": "s.match(/a/)\n" }), a = hits(["organs"], d)[0].id; fs.writeFileSync(path.join(d, "organs", "a.mjs"), "// new header\ns.match(/a/)\n"); assert.equal(hits(["organs"], d)[0].id, a);
  fs.writeFileSync(path.join(d, "organs", "a.mjs"), "s.match(/ab/)\n"); assert.notEqual(hits(["organs"], d)[0].id, a);
});
import { addedHits } from "./text-regex-ratchet.mjs";
test("hook decision: an edit that adds a language regex is flagged; a declared, a carried, an already-present and a test-file line are not", () => {
  assert.equal(addedHits("organs/a.mjs", "const m = q.match(/where.*live/i);").length, 1);
  assert.equal(addedHits("organs/a.mjs", "const m = q.match(/\\d+/); // regex-ok: a page number in a url").length, 0);
  assert.equal(addedHits("organs/a.mjs", "const m = q.match(/x/);", "const m = q.match(/x/);").length, 0, "the line was already there: not added by this edit");
  assert.equal(addedHits("organs/a.test.mjs", "q.match(/x/)").length, 0);
  assert.equal(addedHits("README.md", "q.match(/x/)").length, 0);
});
