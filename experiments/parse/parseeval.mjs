// parseeval.mjs <dev|test> <out.json>: PREREG-PARSE-ENGLISH-LAYERS. Per sentence, every arm's UPOS/UAS/LAS counts with GOLD tokenization; the gold is read here only to score. Arms: EWT GUM POOL BLEND BLEND_W25 BLEND_W75 BLEND_PERM ENS_MBR VARIETY_ORACLE + references REF_EWT_PRIOR REF_GUM_PRIOR.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { loadModel, analyse, readJson, blendJson, permutedJson, mbr, loadSentences, score } from "./parselib.mjs";
const set = process.argv[2], out = process.argv[3], O = process.env.PARSE_MODELS ?? path.join(os.homedir(), ".fold", "ud-parse-eval"), D = "/Users/mlacy/Documents/data/ud/en_ewt", G = "/Users/mlacy/Documents/janus-experiments/gum-raw";
if (!["dev", "test"].includes(set)) throw new Error("set must be dev or test");
const J = (tb) => readJson(path.join(O, tb, `ud-parser-eng-english-${tb}.json.gz`)), jE = J("ewt"), jG = J("gum"), jP = J("pool");
const M = { EWT: loadModel(jE), GUM: loadModel(jG), POOL: loadModel(jP), BLEND: loadModel(blendJson(jE, jG, 0.5, 0.5)), BLEND_W25: loadModel(blendJson(jE, jG, 0.25, 0.75)), BLEND_W75: loadModel(blendJson(jE, jG, 0.75, 0.25)), BLEND_PERM: loadModel(blendJson(jE, permutedJson(jG), 0.5, 0.5)) };
const refs = {}; try { const f = "/Users/mlacy/Documents/janus/priors/ud-parser-eng-ewt.json.gz", j = readJson(f), lexF = j.meta?.lexicon ? path.resolve("/Users/mlacy/Documents/janus", j.meta.lexicon) : null; let lex = null; if (lexF && fs.existsSync(lexF)) lex = new Map(Object.entries(readJson(lexF).forms)); refs.REF_EWT_PRIOR = loadModel(j, { lex }); } catch (e) { console.error("no REF_EWT_PRIOR:", e.message); }
try { refs.REF_GUM_PRIOR = loadModel(readJson(path.join(os.homedir(), ".fold", "ud-codecs", "eng-gum", "ud-parser-eng-english-gum.json.gz"))); } catch (e) { console.error("no REF_GUM_PRIOR:", e.message); }
const corpora = { EWT: loadSentences(path.join(D, `en_ewt-ud-${set}.conllu`)), GUM: loadSentences(path.join(G, `en_gum-ud-${set}.conllu`)) }, res = [];
for (const [corpus, sents] of Object.entries(corpora)) {
  console.error(`${corpus}-${set}: ${sents.length} sentences`);
  for (const s of sents) {
    const rows = {}; for (const [k, m] of Object.entries({ ...M, ...refs })) rows[k] = analyse(m, s.forms);
    rows.ENS_MBR = mbr([rows.EWT, rows.GUM, rows.POOL]); rows.VARIETY_ORACLE = corpus === "EWT" ? rows.EWT : rows.GUM;
    const arms = {}; for (const [k, r] of Object.entries(rows)) arms[k] = score(r, s.gold);
    res.push({ corpus, doc: s.doc, arms });
  }
}
fs.writeFileSync(out, JSON.stringify({ set, files: { ewt: `en_ewt-ud-${set}.conllu`, gum: `en_gum-ud-${set}.conllu` }, sentences: res }));
console.log(`wrote ${out}: ${res.length} sentences`);
