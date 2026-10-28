// dump-ledger.mjs — write the reader's referent ledger for one text as plain JSON (KinLedger@1), so the kin binder (bind-kin.mjs) can run with no reader in the process.
//   node dump-ledger.mjs --khora <khora clone> --text <text file> --out <ledger.json> [--priors <janus priors dir>]
// The reader is khora's readDocument with the options the foldcode experiments used ({language:'ru', minCharacters:0, referents:true, declension:true, lexicon:false}).
// khora reads its priors from <workspace>/janus/priors; a clone elsewhere is pointed at this repository's priors with KHORA_PRIORS_DIR (set here from --priors, default ../../priors).
// Only the reader's own output is written: spans (name mentions, with character AND byte offsets) and referents (id, face, standing, forms), plus the sentence count. Nothing is added or inferred,
// and the text itself is not copied (the binder reads the text from its own file).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const khora = arg("khora"), textPath = arg("text"), out = arg("out"), priors = path.resolve(arg("priors", path.join(here, "..", "..", "priors")));
if (!khora || !textPath || !out) { console.error("usage: node dump-ledger.mjs --khora <khora clone> --text <text file> --out <ledger.json> [--priors <dir>]"); process.exit(2); }
process.env.KHORA_PRIORS_DIR = priors;

export const READ_OPTIONS = Object.freeze({ language: "ru", minCharacters: 0, referents: true, declension: true, lexicon: false });
const { readDocument } = await import(pathToFileURL(path.join(path.resolve(khora), "native/reading.js")).href);
const buf = fs.readFileSync(textPath), text = buf.toString("utf8");
const entry = await readDocument(text, { ...READ_OPTIONS });
if (entry.error) throw new Error(`readDocument error: ${JSON.stringify(entry.error)}`);
if (entry.readCharacters !== text.length) throw new Error("the reader did not read the whole text");
const L = entry.referents;
// character offset -> byte offset (the kin extractor speaks bytes, the ledger speaks UTF-16 characters)
const byteAt = new Int32Array(text.length + 1);
{
  let b = 0;
  for (let i = 0; i < text.length; i++) {
    byteAt[i] = b;
    const c = text.charCodeAt(i);
    if (c < 0x80) b += 1; else if (c < 0x800) b += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) { byteAt[i + 1] = b; b += 4; i++; }
    else b += 3;
  }
  byteAt[text.length] = b;
  if (b !== buf.length) throw new Error(`byte map is off: ${b} vs ${buf.length}`);
}
const refOf = new Map(); for (const r of L.referents) for (const sid of r.mentions) refOf.set(sid, r.id);
const spans = L.spans.map((s) => {
  if (text.slice(s.at[0], s.at[1]) !== s.text) throw new Error(`span ${s.id} does not read back from the text`);
  return { id: s.id, kind: s.kind, text: s.text, at: s.at, bytes: [byteAt[s.at[0]], byteAt[s.at[1]]], ref: refOf.get(s.id) ?? null };
}).sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1] || (a.id < b.id ? -1 : 1));
const referents = L.referents.map((r) => ({ id: r.id, face: r.face, standing: r.standing, forms: r.forms, mentions: r.mentions.length }));
const ledger = { schema: "KinLedger@1", text_sha256: crypto.createHash("sha256").update(buf).digest("hex"), characters: text.length, bytes: buf.length, options: READ_OPTIONS, referents, spans, sentence_count: entry.sentences.length };
fs.writeFileSync(out, JSON.stringify(ledger));
console.log(JSON.stringify({ out, sha256: crypto.createHash("sha256").update(JSON.stringify(ledger)).digest("hex"), spans: spans.length, referents: referents.length, beings: referents.filter((r) => r.standing === "referent").length, sentences: ledger.sentence_count }));
