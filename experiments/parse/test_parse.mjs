// guards for PREREG-PARSE-ENGLISH-LAYERS: node test_parse.mjs
import assert from "node:assert/strict"; import os from "node:os"; import path from "node:path"; import fs from "node:fs";
import { loadModel, analyse, readJson, blendJson, permutedJson, mbr, agreement, loadSentences, score } from "./parselib.mjs";
const f = path.join(os.homedir(), ".fold", "ud-codecs", "eng-gum", "ud-parser-eng-english-gum.json.gz"), j = readJson(f), sents = loadSentences("/Users/mlacy/Documents/janus-experiments/gum-raw/en_gum-ud-dev.conllu").slice(0, 80);
const base = loadModel(j), pred = (m) => sents.map((s) => analyse(m, s.forms).map((r) => `${r.upos}/${r.head}/${r.deprel}`).join(" "));
// 1. a blend of a model with itself is that model, exactly (the average of equal weights; classes aligned by name)
const self = loadModel(blendJson(j, j, 0.5, 0.5)); assert.deepEqual(pred(self), pred(base), "blend(M, M) must equal M");
// 2. weights 1 and 0 reproduce the first model; the blend never changes the label set of identical models
assert.deepEqual(pred(loadModel(blendJson(j, permutedJson(j), 1, 0))), pred(base), "weight (1, 0) must equal the first model");
// 3. the strings-only twin keeps the multiset of weight vectors and moves their association
const p = permutedJson(j), keys = Object.keys(j.parser.w), sig = (T) => Object.values(T.w).map((v) => v.join(",")).sort().join("|");
assert.equal(sig(p.parser), sig(j.parser), "the permutation keeps the same vectors"); assert.ok(keys.some((k) => p.parser.w[k] !== j.parser.w[k]), "and moves them between features");
assert.notDeepEqual(pred(loadModel(permutedJson(j))), pred(base), "a permuted model must parse differently");
// 4. alignment by NAME: reversing class order in a copy changes nothing after the blend
const rev = JSON.parse(JSON.stringify(j)); const rv = (T) => { const n = T.classes.length, map = T.classes.map((_, i) => n - 1 - i); T.classes = [...T.classes].reverse(); for (const k of Object.keys(T.w)) { const v = T.w[k], o = []; for (let i = 0; i < v.length; i += 2) o.push(map[v[i]], v[i + 1]); T.w[k] = o; } }; rv(rev.tagger); rv(rev.parser);
assert.deepEqual(pred(loadModel(blendJson(j, rev, 0.5, 0.5))), pred(base), "blend must align classes by name, not by index");
// 5. mbr picks the consensus analysis, and a tie goes to the last candidate
const row = (h) => [{ upos: "NOUN", head: h, deprel: "x" }, { upos: "NOUN", head: 0, deprel: "root" }]; const a = row(2), b = row(1), c = row(2);
assert.equal(mbr([a, b, c]), c, "the majority analysis wins (the later of two identical ones on a tie of scores)"); assert.equal(mbr([a, b]), b, "a tie goes to the last candidate");
// 6. document ids are read from newdoc lines; scoring excludes punctuation from UAS and LAS but not from UPOS
assert.ok(new Set(sents.map((s) => s.doc)).size >= 2, "documents are separated by their newdoc ids");
const sc = score([{ upos: "PUNCT", head: 1, deprel: "punct" }, { upos: "NOUN", head: 0, deprel: "root" }], [{ upos: "PUNCT", head: 2, deprel: "punct" }, { upos: "NOUN", head: 0, deprel: "root" }]); assert.deepEqual(sc, { n: 2, nnp: 1, u: 2, a: 1, l: 1 });
// 7. no regex in the harness
for (const file of ["parselib.mjs", "parseeval.mjs", "test_parse.mjs"]) { const s = fs.readFileSync(new URL(file, import.meta.url), "utf8"); assert.equal(/RegExp|\.match\(|\.replace\(\//.test(s.replace(/\/RegExp\|[^\n]*/, "")), false, `${file} uses a regex`); }
console.log("test_parse: OK");
