#!/usr/bin/env node
// scripts/vendor-ud-codec.mjs — vendor ONE pointed-at UD codec onto the machine that uses it.
//
// THE ISTHMUS (khora native/docs/THE-ISTHMUS.md): a language's codec is its UD grammar. A codec whose treebank licence
// does not allow redistribution (non-commercial, research-only, or unknown) is never committed to this repository; the
// manifest (priors/ud-codecs.json, UDCodecManifest@1) POINTS AT its source — repo, file, sha256 — and this script builds it
// here, from that source, into the local codec cache. The treebank's own licence travels with it: the receipt names it,
// and the cache is this machine's, not a redistribution.
//
//   node scripts/vendor-ud-codec.mjs <code> [--cache=<dir>] [--force]
//   (the cache: --cache, else $FOLD_UD_CODECS, else ~/.fold/ud-codecs)
//
// Steps: fetch the treebank's train/dev/test .conllu from github.com/UniversalDependencies/<treebank> (raw, the manifest's
// ref); check the trained file against the pinned sha256 (a moved upstream is built anyway and the drift is recorded in the
// receipt, never hidden); run khora's builder (native/scripts/train-ud-language.mjs) with the cache as both its --ud and its
// --out; write vendored-<code>.json. nl-eot.mjs::loadGrammar runs this in the background the first time a pointed-at codec
// is asked for, and answers with the typed gap `codec_vendoring` until it lands.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PRIORS = path.resolve(HERE, "../priors");
export const KHORA_BUILDER = path.resolve(HERE, "../../khora/native/scripts/train-ud-language.mjs");
export const codecCache = () => process.env.FOLD_UD_CODECS || path.join(os.homedir(), ".fold", "ud-codecs");

let _manifest = null;
export function manifest() {
  if (_manifest) return _manifest;
  try { _manifest = JSON.parse(fs.readFileSync(path.join(PRIORS, "ud-codecs.json"), "utf8")); } catch { _manifest = { codecs: {} }; }
  return _manifest;
}
export const rowOf = (code) => manifest().codecs?.[code] ?? null;
export const lockOf = (code, cache = codecCache()) => path.join(cache, `.vendoring-${code}`);
export const receiptOf = (code, cache = codecCache()) => path.join(cache, `vendored-${code}.json`);
export const vendorCommand = (code) => `node ${path.relative(process.cwd(), fileURLToPath(import.meta.url)) || fileURLToPath(import.meta.url)} ${code}`;

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

/** vendorCodec(code) → { ok, receipt } or { gap, why }. Synchronous build; the network fetch is the only await. */
export async function vendorCodec(code, { cache = codecCache(), force = false, builder = KHORA_BUILDER, log = (s) => console.error(s) } = {}) {
  const row = rowOf(code);
  if (!row) return { gap: "not_in_manifest", why: `no row for ${code} in priors/ud-codecs.json` };
  if (!row.source?.file) return { gap: "no_source", why: `the manifest names no source file for ${code}` };
  if (!fs.existsSync(builder)) return { gap: "builder_absent", why: `khora's builder is not at ${builder} (a khora checkout beside janus is required)` };
  fs.mkdirSync(cache, { recursive: true });
  const receiptPath = receiptOf(code, cache);
  if (!force && fs.existsSync(receiptPath)) return { ok: true, receipt: JSON.parse(fs.readFileSync(receiptPath, "utf8")), cached: true };
  const lock = lockOf(code, cache);
  try { fs.writeFileSync(lock, String(process.pid), { flag: "wx" }); } catch { return { gap: "codec_vendoring", why: `${code} is already being vendored (${lock})` }; }
  try {
    const dir = path.join(cache, "ud", row.treebank);
    fs.mkdirSync(dir, { recursive: true });
    const prefix = row.source.file.replace(/-ud-(?:train|dev|test)\.conllu$/, "");
    const fetched = [];
    for (const split of ["train", "dev", "test"]) {
      const name = `${prefix}-ud-${split}.conllu`;
      const url = `https://raw.githubusercontent.com/${row.source.repo}/${row.source.ref || "master"}/${name}`;
      const r = await fetch(url);
      if (r.status === 404) continue;
      if (!r.ok) return { gap: "fetch_failed", why: `${url}: HTTP ${r.status}` };
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(path.join(dir, name), buf);
      fetched.push({ name, url, bytes: buf.length, sha256: sha256(buf) });
      log(`[vendor ${code}] fetched ${name} (${buf.length} bytes)`);
    }
    const trained = fetched.find((f) => f.name === row.source.file);
    if (!trained) return { gap: "source_moved", why: `${row.source.file} is not at ${row.source.repo}@${row.source.ref}` };
    const t0 = Date.now();
    const b = spawnSync(process.execPath, [builder, `--code=${code}`, `--dir=${row.treebank}`, `--ud=${path.join(cache, "ud")}`, `--out=${cache}`], { cwd: cache, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (b.status !== 0) return { gap: "build_failed", why: String(b.stderr || b.stdout).slice(-600) };
    const receipt = {
      schema: "UDCodecVendored@1",
      code, treebank: row.treebank, licence: row.licence, licenceSource: row.licenceSource,
      source: { ...row.source, fetched },
      pinMatches: trained.sha256 === row.source.sha256,
      drift: trained.sha256 === row.source.sha256 ? null : { pinned: row.source.sha256, fetched: trained.sha256 },
      lexicon: row.source.lexicon ? { gap: "lexicon_absent", named: row.source.lexicon, why: "the UniMorph lexicon is not fetched by this script; the parser reads without it" } : null,
      builder: path.relative(cache, builder), builtMs: Date.now() - t0, builtAt: new Date().toISOString(),
      note: "built on this machine from the treebank's own files; not redistributed. The treebank's licence governs any use.",
    };
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 1) + "\n");
    log(`[vendor ${code}] built in ${receipt.builtMs} ms; pin ${receipt.pinMatches ? "matches" : "DRIFTED"}`);
    return { ok: true, receipt };
  } finally {
    fs.rmSync(lock, { force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const code = args.find((a) => !a.startsWith("--"));
  const cacheArg = args.find((a) => a.startsWith("--cache="))?.slice(8);
  if (!code) { console.error("usage: node scripts/vendor-ud-codec.mjs <code> [--cache=<dir>] [--force]"); process.exit(2); }
  const out = await vendorCodec(code, { cache: cacheArg || codecCache(), force: args.includes("--force") });
  console.log(JSON.stringify(out.ok ? { ok: true, code, cached: !!out.cached, pinMatches: out.receipt.pinMatches, licence: out.receipt.licence } : out));
  process.exit(out.ok ? 0 : 1);
}
