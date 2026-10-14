#!/usr/bin/env node
// scripts/scrub-priors.mjs — make the generated POS/params priors publishable.  (2026-10-14)
//   node scripts/scrub-priors.mjs [--dry]
// What the sweep found in the 229-language priors commit (5feb27a) and what this does about it:
//   DROP    pos-oci (UD_Occitan-TTB is CC BY-NC-SA 4.0 — labelled CC BY-SA), pos-lij (UD_Ligurian-GLT is C-UDA 1.0 — labelled CC BY-SA),
//           pos-tyv (21.8 MB: not publishable as a git blob; rebuild it locally with native/scripts/build-pos-prior.mjs) — and any params-*
//           file derived from a dropped language.
//   RELABEL pos-tha: UD_Thai-PUD is CC BY-SA 3.0, not 4.0.
//   SCRUB   form keys that are an e-mail address, a URL or a run of 9+ digits (web text leaked into the treebank-free sources): such a key
//           is a person's contact detail or an identifier, not a word. The file says how many it removed.
// The README line each licence claim rests on was read on 2026-10-14 (raw.githubusercontent.com/UniversalDependencies/<repo>/master/README.md).
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const DRY = process.argv.includes("--dry");
const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "priors");
const DROP = new Set(["oci", "lij", "tyv"]);
const RELABEL = { tha: "CC BY-SA 3.0 (UD_Thai-PUD, per its README)" };
const BAD = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|https?:\/\/|www\.|\d{9,}/;
const report = { dropped: [], relabelled: [], scrubbed: {}, untouched_existing: 0 };
// Only files this change INTRODUCES are touched: anything already on origin/main stays byte-for-byte as it is.
const onMain = new Set(execFileSync("git", ["ls-tree", "-r", "--name-only", "origin/main", "priors"], { encoding: "utf8", cwd: path.resolve(DIR, "..") }).split("\n").filter(Boolean).map((x) => path.basename(x)));
for (const f of fs.readdirSync(DIR).sort()) {
  const m = f.match(/^(pos|params)-([a-z0-9_]+)\.json$/); if (!m) continue;
  const [, kind, iso] = m; const p = path.join(DIR, f);
  if (onMain.has(f)) { report.untouched_existing++; continue; }
  const raw = fs.readFileSync(p, "utf8");
  // only files this change introduced are touched: they carry the POSPrior@1 / params schema stamped by the builder
  let d; try { d = JSON.parse(raw); } catch { continue; }
  if (!d?.provenance?.builder?.includes("build-pos-prior") && !String(d?.provenance?.giver ?? "").length) continue;
  if (DROP.has(iso)) { report.dropped.push(f); if (!DRY) fs.rmSync(p); continue; }
  let changed = false;
  if (RELABEL[iso] && kind === "pos") { d.provenance.license = RELABEL[iso]; report.relabelled.push(f); changed = true; }
  if (d.forms && typeof d.forms === "object") {
    const keys = Object.keys(d.forms); const bad = keys.filter((k) => BAD.test(k));
    if (bad.length) {
      for (const k of bad) delete d.forms[k];
      d.provenance.scrubbed = { removed_form_keys: bad.length, rule: "key is an e-mail address, a URL, or contains a run of 9+ digits" };
      if ("distinct_forms" in d.provenance) d.provenance.distinct_forms = Object.keys(d.forms).length;
      report.scrubbed[f] = bad.length; changed = true;
    }
  }
  if (changed && !DRY) fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 1));
