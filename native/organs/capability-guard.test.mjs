// capability-guard: the gate that was missing when janus's edit-intent re-built negation and question handling beside khora's solved ones (2026-11-27).
// (1) no organ of janus lists the closed words of negation or interrogation: those are read from UD features (negation-read.js) or kept in khora's declared, given closed classes; a new list here means a capability was not looked up.
// (2) the capability index is honest: every entry names a `where` that exists in a sibling checkout that is present (skips when the sibling is absent: typed `<repo>-absent`), and says whether it is reachable by kind.
// A source linter by plain string scanning (no pattern is applied to language). An allowlisted file names its reason; adding one needs the owner's word.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
const HERE = path.dirname(new URL(import.meta.url).pathname), ORGANS = HERE, WS = path.resolve(HERE, "..", "..", "..");
const NEG = new Set(["not", "never", "no", "nobody", "nothing", "none", "nowhere", "neither", "nor", "n't"]), INT = new Set(["who", "whom", "whose", "what", "which", "when", "where", "why", "how"]);
const ALLOW = {};   // file basename -> reason. Empty on purpose.
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "fixtures") walk(f, out); } else if (e.name.endsWith(".mjs") || e.name.endsWith(".js")) out.push(f); } return out; };
/** the string literals of a line, by a plain scan for ' and " (escapes skipped): no pattern */
export function literalsOf(line) { const out = []; let i = 0; while (i < line.length) { const q = line[i]; if (q === '"' || q === "'") { let j = i + 1, s = ""; while (j < line.length && line[j] !== q) { if (line[j] === "\\") j++; s += line[j] ?? ""; j++; } if (j < line.length) out.push(s.toLowerCase()); i = j + 1; } else i++; } return out; }
/** a line that spells out three or more distinct closed-class words of one kind */
export function listsClosedWords(line) { const lits = new Set(literalsOf(line)); for (const [name, set] of [["negation", NEG], ["interrogation", INT]]) { const hit = [...lits].filter((w) => set.has(w)); if (hit.length >= 3) return { name, hit }; } return null; }

test("no organ of janus lists the closed words of negation or interrogation (read them off the UD features or reuse khora's declared classes; see capability-index.json)", () => {
  const bad = []; for (const f of walk(ORGANS).filter((f) => !f.endsWith(".test.mjs"))) { if (ALLOW[path.basename(f)]) continue; fs.readFileSync(f, "utf8").split("\n").forEach((l, n) => { const r = listsClosedWords(l); if (r) bad.push(`${path.relative(ORGANS, f)}:${n + 1} lists ${r.name} words ${r.hit.join(",")}`); }); }
  assert.deepEqual(bad, [], "a closed list of negation or question words was re-built here: use the capability index (native/organs/capability-index.json) and the UD features");
});
test("FALSIFIER: the linter catches a re-built list, and does not fire on a sentence of ordinary code", () => {
  assert.equal(listsClosedWords('const NEG = new Set(["not", "never", "no"]);').name, "negation"); assert.equal(listsClosedWords("const Q = ['who', 'what', 'why'];").name, "interrogation");
  assert.equal(listsClosedWords('const x = ["not", "root", "obj"];'), null); assert.equal(listsClosedWords('Polarity=Neg or PronType=Neg'), null);
});
test("the capability index: every entry names where it is handled and whether it is reachable by kind; every `where` that can be checked exists", () => {
  const idx = JSON.parse(fs.readFileSync(path.join(HERE, "capability-index.json"), "utf8")); assert.equal(idx.schema, "CapabilityIndex@1"); assert.ok(idx.entries.length >= 5);
  for (const e of idx.entries) { assert.ok(e.phenomenon && e.rule && Array.isArray(e.where) && e.where.length && typeof e.by_kind === "boolean", e.phenomenon);
    for (const w of e.where) { const repo = w.split("/")[0], f = path.join(WS, w); if (!fs.existsSync(path.join(WS, repo))) continue; assert.ok(fs.existsSync(f), `${e.phenomenon}: ${w} does not exist`); } }
  for (const e of idx.entries) if (e.by_kind) assert.ok(typeof e.kind === "string" && e.kind.length, `${e.phenomenon}: reachable by kind must NAME the kind`);
  assert.ok(idx.entries.some((e) => e.by_kind === false), "the index names what is still NOT reachable by kind");
});
