// gym/text-regex-ratchet.mjs — language is read by the READER, not by a pattern: the number of regex applications in source may not GROW.
//
//   node gym/text-regex-ratchet.mjs                      gate: exit 1 on any hit not in the baseline
//   node gym/text-regex-ratchet.mjs --list               every current hit (id, file:line)
//   node gym/text-regex-ratchet.mjs --record --why "..." APPEND current hits not in the baseline (you are knowingly carrying them)
//   node gym/text-regex-ratchet.mjs --tighten --why "..." APPEND a green mark for baseline hits that are gone
//   --root <dir> (repeatable; default: those of organs, gym, native, lib, eoql/src that exist)  --baseline <file>
//
// THE RULE (the owner's, 2026-11-18/19 and the standing no-regex law: janus fa3e72c "claims-from-rows: no regex", GL-EN-10 "a structure, never a regex"): a sentence, a question, a name or a relation is read by the reader's rows (the
// parser's own tags: upos, deprel, feats, offsets), never by a pattern or a word list matched against the text. A pattern on a path, a hash, an id or a file format is not language and is declared so on the same or the
// previous line:  // regex-ok: <why it is not language>   (a reason is required: an empty one does not exempt).
// WHY A RATCHET: the existing uses are real and are not all language; a ban would be noise and would be bypassed. The baseline records what is carried today (append-only; a fixed hit stays on the record as green, and returns as NEW red).
// WHAT IT CANNOT SEE: a word-list `includes`, a `startsWith`, an `===` against a spelling, or a `new RegExp(...)` built at run time. It counts regex literals applied to a value; it does not prove a repo is clean. Falsifier: a language read by a pattern that this gate passes.
// Portable: Node built-ins only, no repo import, so any repo of the nexus can copy this one file and a baseline.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.basename(HERE) === "gym" ? path.resolve(HERE, "..") : HERE;   // beside gym/ (penelope) or at the repo root (a repo with no gym/)
const APPLY = /\.(?:match|matchAll|exec|replace|replaceAll|split|search)\(\s*\/(?![/*])|\/(?:[^/\\\n]|\\.)+\/[dgimsuvy]*\s*\.(?:test|exec)\(/;
const OK = /\/\/\s*regex-ok:\s*\S+/;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 8);
const walk = (d, out = []) => { if (!fs.existsSync(d)) return out; for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === "node_modules" || e.name.startsWith(".")) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (/\.(mjs|js)$/.test(e.name) && !/\.test\.m?js$/.test(e.name)) out.push(p); } return out; };
/** every hit as { id, file, line, text }. id = file + hash of the trimmed line: survives edits elsewhere in the file, changes when the line changes. A repeated identical line in one file gets #2, #3. */
export function hits(roots, base = ROOT) {
  const out = [], seen = new Map();
  for (const f of roots.flatMap((r) => walk(path.resolve(base, r))).sort()) {
    const rel = path.relative(base, f), lines = fs.readFileSync(f, "utf8").split("\n");
    lines.forEach((ln, i) => { if (!APPLY.test(ln) || OK.test(ln) || OK.test(lines[i - 1] ?? "")) return; const key = `${rel}:${sha(ln.trim())}`, n = (seen.get(key) ?? 0) + 1; seen.set(key, n); out.push({ id: n > 1 ? `${key}#${n}` : key, file: rel, line: i + 1, text: ln.trim().slice(0, 140) }); });
  }
  return out;
}
export const readBaseline = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
/** the ids currently carried as red: the LAST record per id decides (green after red = fixed; red after green = back, and counts as new until recorded again) */
export const carried = (recs) => { const last = new Map(); for (const r of recs) last.set(r.id, r.status); return new Set([...last].filter(([, s]) => s === "red").map(([id]) => id)); };
export function gate(cur, recs) { const k = carried(recs); const fresh = cur.filter((h) => !k.has(h.id)); const gone = [...k].filter((id) => !cur.some((h) => h.id === id)); return { ok: fresh.length === 0, fresh, gone, carried: cur.length - fresh.length }; }
const argv = process.argv.slice(2), val = (f) => { const i = argv.indexOf(f); return i < 0 ? null : argv[i + 1]; };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const roots = argv.flatMap((a, i) => (a === "--root" ? [argv[i + 1]] : [])), R = roots.length ? roots : ["organs", "gym", "native", "lib", "eoql/src"].filter((d) => fs.existsSync(path.join(ROOT, d))), BASE = val("--baseline") ?? path.join(ROOT, fs.existsSync(path.join(ROOT, "gym")) ? "gym" : ".", "text-regex-baseline.jsonl");
  const cur = hits(R), recs = readBaseline(BASE), g = gate(cur, recs), why = val("--why");
  if (argv.includes("--list")) { for (const h of cur) console.log(`${h.id}  ${h.file}:${h.line}  ${h.text}`); console.log(`${cur.length} hit(s); ${g.fresh.length} not in the baseline`); }
  else if (argv.includes("--record") || argv.includes("--tighten")) {
    if (!why) { console.error("--why \"<reason>\" is required: carrying or fixing a hit is a decision"); process.exit(2); }
    const add = argv.includes("--record") ? g.fresh.map((h) => ({ id: h.id, status: "red", why, at: new Date().toISOString(), where: `${h.file}:${h.line}` })) : g.gone.map((id) => ({ id, status: "green", why, at: new Date().toISOString() }));
    if (add.length) fs.appendFileSync(BASE, add.map((r) => JSON.stringify(r)).join("\n") + "\n"); console.log(`appended ${add.length} record(s)`);
  } else { console.log(`text-regex ratchet: ${cur.length} hit(s), ${g.carried} carried, ${g.fresh.length} NEW, ${g.gone.length} fixed-not-marked`); for (const h of g.fresh) console.log(`  NEW ${h.file}:${h.line}  ${h.text}`); if (!g.ok) { console.log("language is read by the reader, not a pattern: read it through the reader's rows, or declare `// regex-ok: <why it is not language>`, or --record --why \"...\" if you knowingly carry it"); process.exit(1); } }
}
