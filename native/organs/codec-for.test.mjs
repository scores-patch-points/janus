import test from "node:test"; import assert from "node:assert/strict";
import { codecFor, readLayers, requireDerivation, loadSources, DERIVATION_SCHEMA } from "./codec-for.mjs";
const fake = (id, over = {}) => ({ id, material: "text", language: "eng", variety: "web", period: null, giver: { kind: "treebank", name: `UD_${id}` }, standing: "candidate", grammar: { code: id }, dataHash: `hash-${id}`, ...over });
const loader = (code) => ({ code, parser: {}, tokenizer: null });   // an injected codec door: the tests do not load a parser
test("the real registry: English text has two sources (EWT, and GUM where vendored), each with a named giver, a data hash and standing candidate; the derivation says so and weights them uniformly", async () => {
  const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path"), have = fs.existsSync(path.join(process.env.FOLD_UD_CODECS || path.join(os.homedir(), ".fold", "ud-codecs"), "eng-gum"));
  const c = codecFor({ language: "eng" }); assert.equal(c.gap, undefined); assert.equal(c.layers.length, have ? 2 : 1);
  for (const s of c.derivation.sources) { assert.ok(["eng-ewt", "eng-gum"].includes(s.id)); assert.ok(s.giver.name.startsWith("UD_English")); assert.equal(s.standing, "candidate"); assert.match(s.dataHash, /^[0-9a-f]{64}$/); }
  assert.ok(Math.abs(c.layers.reduce((a, l) => a + l.weight, 0) - 1) < 1e-12); assert.equal(c.derivation.schema, DERIVATION_SCHEMA);
  assert.ok(c.derivation.gaps.some((g) => g.gap === "no_context_uniform_weights"), "no context is said, not hidden");
  if (!have) assert.ok(c.derivation.gaps.some((g) => g.gap === "codec_not_vendored" && g.source === "eng-gum"), "a pointed-at source absent on this machine is a typed gap that names it");
  const web = codecFor({ language: "eng", variety: "multi-genre" }); assert.deepEqual((web.layers ?? []).map((l) => l.source.id), have ? ["eng-gum"] : []);
});
test("a language no source covers is the typed gap no_codec_source: never English, never another language's codec", () => {
  for (const lang of ["fra", "xxx", "ang"]) { const c = codecFor({ language: lang }); assert.equal(c.gap, "no_codec_source", lang); assert.equal(c.layers, undefined); assert.equal(c.derivation.sources.length, 0); }
  assert.equal(codecFor({}).gap, "no_codec_source", "no language named: nothing is chosen by default");
});
test("variety and period narrow the selection; a variety no source holds is a gap, not a fallback to the nearest", () => {
  const S = [fake("a", { variety: "web" }), fake("b", { variety: "fiction", period: { from: 1800, to: 1899 } }), fake("c", { variety: "fiction", period: { from: 1900, to: 1999 } })];
  assert.deepEqual(codecFor({ language: "eng", variety: "fiction" }, { sources: S, loader }).layers.map((l) => l.source.id), ["b", "c"]);
  assert.deepEqual(codecFor({ language: "eng", variety: "fiction", period: { from: 1850, to: 1860 } }, { sources: S, loader }).layers.map((l) => l.source.id), ["b"]);
  assert.equal(codecFor({ language: "eng", variety: "legal" }, { sources: S, loader }).gap, "no_codec_source");
  assert.equal(codecFor({ language: "eng", variety: "fiction", period: { from: 1700, to: 1750 } }, { sources: S, loader }).gap, "no_codec_source");
  const u = codecFor({ language: "eng", variety: "web", period: { from: 2000, to: 2010 } }, { sources: [fake("a")], loader }); assert.ok(u.derivation.gaps.some((g) => g.gap === "period_unknown"), "an unknown period is a hole, said");
});
test("no context: every source for the language, uniform weights summing to 1; the derivation id is deterministic and independent of source order", () => {
  const S = [fake("a"), fake("b"), fake("c")], x = codecFor({ language: "eng" }, { sources: S, loader }), y = codecFor({ language: "eng" }, { sources: [...S].reverse(), loader });
  assert.equal(x.layers.length, 3); assert.ok(Math.abs(x.layers.reduce((a, l) => a + l.weight, 0) - 1) < 1e-12); assert.ok(x.layers.every((l) => Math.abs(l.weight - 1 / 3) < 1e-12));
  assert.equal(x.derivation.composed, y.derivation.composed, "same sources, same derivation"); assert.notEqual(x.derivation.composed, codecFor({ language: "eng" }, { sources: S.slice(0, 2), loader }).derivation.composed);
  assert.notEqual(x.derivation.composed, codecFor({ language: "eng" }, { sources: [fake("a", { dataHash: "other" }), fake("b"), fake("c")], loader }).derivation.composed, "a different data hash is a different derivation");
});
test("every EOT record read through a layer carries the derivation id and its source; a record without a derivation is refused", () => {
  const c = codecFor({ language: "eng" }, { sources: [fake("a"), fake("b")], loader }), r = readLayers(c, "x", { reader: () => ({ records: [{ meaning: {} }] }) });
  assert.equal(r.layers.length, 2); for (const l of r.layers) for (const rec of l.records) { assert.equal(rec.derivation, c.derivation.composed); assert.ok(["a", "b"].includes(rec.source)); requireDerivation(rec); }
  assert.throws(() => requireDerivation({ meaning: {} }), /without a codec derivation/); assert.throws(() => requireDerivation(null));
  assert.equal(readLayers(codecFor({ language: "fra" }), "x").layers.length, 0, "a gap codec reads nothing");
});
test("a source with no named giver, no scope or no data hash is refused at load (a source that cannot be audited is not a source)", async () => {
  const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path"), d = fs.mkdtempSync(path.join(os.tmpdir(), "cs-"));
  for (const [name, patch] of [["giver", { giver: { kind: "treebank" } }], ["hash", { dataHash: "" }], ["standing", { standing: "certain" }]]) { const f = path.join(d, name + ".json"); fs.writeFileSync(f, JSON.stringify({ schema: "CodecSources@1", sources: [{ ...fake("z"), ...patch }] })); assert.throws(() => loadSources(f), /codec source z/, name); }
});
test("the real English codec decodes through the door: every layer's records stamped with the derivation id (EWT, a codec we hold)", () => {
  const c = codecFor({ language: "eng" }), r = readLayers(c, "Michael met Anna. She greeted him.");
  assert.ok(r.layers.length >= 1); for (const rec of r.layers.flatMap((l) => l.records)) { assert.equal(requireDerivation(rec).derivation, c.derivation.composed); assert.equal(rec.schema, "EOTRich@1"); }
});
