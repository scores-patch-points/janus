#!/usr/bin/env node
// scripts/tokenizer-evidence.mjs attach|fire <conllu> --language L --corpus NAME --licence TXT [--variety V] [--forms f1,f2 | --from-log] [--log NAME --dir DIR]  (DRY RUN unless --log is given)
// Janus observes a treebank and writes COUNTS to the shared log through its door (Structure cells only). It writes no rule and no verdict, and NO FILE. Without --log nothing is written: the entries are printed.
import fs from "node:fs"; import crypto from "node:crypto"; import path from "node:path";
import { openDoor } from "../native/organs/pharos-door.mjs"; import { attachmentEvidence, firingEvidence, writeTokenizerEvidence } from "../native/organs/tokenizer-evidence.mjs";
import { tokenize } from "../../khora/native/adapters/text/ud-tokenizer.js";
const a = process.argv.slice(2), mode = a[0], file = a[1], opt = (k, d = null) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : d);
if (!["attach", "fire", "both"].includes(mode) || !file) { console.error("usage: tokenizer-evidence.mjs attach|fire <conllu> --language L --corpus NAME --licence TXT [--variety V] [--forms f1,f2 | --from-log] [--log NAME --dir DIR]"); process.exit(2); }
const buf = fs.readFileSync(file), meta = { language: opt("language"), corpus: opt("corpus", path.basename(file)), licence: opt("licence"), variety: opt("variety"), sha256: crypto.createHash("sha256").update(buf).digest("hex") }; if (!meta.language) { console.error("--language is required"); process.exit(2); }
const logName = opt("log"), door = logName ? await openDoor({ log: logName, ...(opt("dir") ? { dir: opt("dir") } : {}) }) : null; if (logName && !door.on) { console.error("door is off:", door.why); process.exit(1); }
let entries;
if (mode === "both") {   // attach on <conllu> (the learning corpus) and fire on --held <conllu> (a held-out corpus); keep a form only if it is TESTABLE: cut more than left inside a word in the learning corpus AND fired at least once on the held-out corpus
  const heldF = opt("held"); if (!heldF) { console.error("both needs --held <conllu>"); process.exit(2); }
  const att = attachmentEvidence(buf.toString("utf8"), meta).filter((e) => e.body.nSplit > e.body.nGlued), hbuf = fs.readFileSync(heldF), hmeta = { ...meta, corpus: opt("held-corpus", path.basename(heldF)), licence: opt("held-licence", meta.licence), sha256: crypto.createHash("sha256").update(hbuf).digest("hex") };
  const fire = firingEvidence({ conllu: hbuf.toString("utf8"), tokenize: (s) => tokenize(s, null), forms: att.map((e) => e.body.form), variants: { from: "'", to: ["\u2019"] } }, hmeta).filter((e) => e.body.fired >= 1), keep = new Set(fire.map((e) => e.body.form));
  entries = [...att.filter((e) => keep.has(e.body.form)), ...fire]; console.log(`both: ${att.length} forms cut more than glued in ${meta.corpus}; ${keep.size} of them fire at least once on ${hmeta.corpus}: attachment (${keep.size}) + firing (${fire.length}) entries`);
} else if (mode === "attach") { entries = attachmentEvidence(buf.toString("utf8"), meta); if (a.includes("--cut-majority")) entries = entries.filter((e) => e.body.nSplit > e.body.nGlued); }   // what to write is the researcher's attention: only forms the gold cut MORE often than it left inside a word (a structural fact, not a rule)
else {
  let forms = opt("forms") ? opt("forms").split(",") : null;
  if (!forms && a.includes("--from-log")) { if (!door) { console.error("--from-log needs --log"); process.exit(2); } forms = (door.ask(["clitic-attachment"]) ?? []).filter((e) => e.body.corpus.language === meta.language && e.body.nSplit > e.body.nGlued).map((e) => e.body.form); }   // what to TEST is the researcher's attention (a structural fact: more cut than left inside), not a rule
  if (!forms?.length) { console.error("no forms to test"); process.exit(2); }
  entries = firingEvidence({ conllu: buf.toString("utf8"), tokenize: (s) => tokenize(s, null), forms: [...new Set(forms)], variants: { from: "'", to: ["’"] } }, meta);
}
console.log(`${mode}: ${entries.length} entries from ${meta.corpus} (sha256 ${meta.sha256.slice(0, 12)})`); for (const e of entries.slice(0, 12)) console.log(`  ${e.kind} ${JSON.stringify(e.body.form).padEnd(7)} ${mode === "attach" ? `split ${e.body.nSplit} glued ${e.body.nGlued}` : `fired ${e.body.fired} correct ${e.body.correct}`}`);
if (door) console.log("written to the log:", JSON.stringify(writeTokenizerEvidence(door, entries))); else console.log("DRY RUN: nothing written (give --log NAME to write through the door)");
