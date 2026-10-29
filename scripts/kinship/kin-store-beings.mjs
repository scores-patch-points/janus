// kin-store-beings.mjs — what the HYPERLEXICON STORE says about the written forms of the beings of one window's ledger, as a derived file a scorer can read without the 761 MiB store.
//   node kin-store-beings.mjs --store <HyperlexiconBin@2 dir> --ledger <KinLedger.json> --out <beings.json>
// For every being (standing `referent`) of the ledger, for its face and each of its forms (and each word of a multi-word form): the store's `names` answer in Russian: whether any row folds with it, and for each row its kind (lemma / form-of), part(s) of speech and the lemma it is a form of.
// Nothing is inferred here; kind-kin.mjs reads "a proper name" off a `name` part of speech and "a common word" off a known form that is none. Deterministic; no model; no network.
import fs from "node:fs";
import crypto from "node:crypto";
import { openHyperlexiconBin } from "../../native/organs/hyperlexicon/bin.mjs";
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const storeDir = arg("store"), ledgerPath = arg("ledger"), outPath = arg("out");
if (!storeDir || !ledgerPath || !outPath) { console.error("usage: node kin-store-beings.mjs --store <dir> --ledger <KinLedger.json> --out <beings.json>"); process.exit(2); }
const hl = openHyperlexiconBin(storeDir), ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const beings = ledger.referents.filter((r) => r.standing === "referent").sort((a, b) => (a.id < b.id ? -1 : 1));
const want = new Set(); const surfacesOf = new Map();
for (const b of beings) { const ss = new Set(); for (const f of [b.face, ...b.forms]) { const n = String(f).normalize("NFC"); ss.add(n); for (const w of n.split(/\s+/)) if (w) ss.add(w); } surfacesOf.set(b.id, [...ss].sort()); for (const s of ss) want.add(s); }
const list = [...want].sort(), answers = {};
for (let i = 0; i < list.length; i += 500) { const r = hl.answer({ op: "names", lang: "ru", surfaces: list.slice(i, i + 500) }); for (const [s, v] of Object.entries(r.surfaces)) answers[s] = v.here.map((x) => ({ kind: x.kind, pos: [...x.pos].sort(), of: x.of ?? [] })).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1); }
const out = { schema: "KinStoreBeings@1", store_head: hl.head, ledger_text_sha256: ledger.text_sha256, beings: Object.fromEntries(beings.map((b) => [b.id, { face: b.face, forms: Object.fromEntries(surfacesOf.get(b.id).map((s) => [s, { found: answers[s].length > 0, entries: answers[s] }])) }])) };
fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
const kind = (b) => { let known = false; for (const f of Object.values(b.forms)) { if (!f.found) continue; known = true; if (f.entries.some((e) => e.pos.includes("name"))) return "name"; } return known ? "common" : "unknown"; };
const c = {}; for (const b of Object.values(out.beings)) c[kind(b)] = (c[kind(b)] ?? 0) + 1;
console.log(JSON.stringify({ beings: beings.length, store_kind: c, sha256: crypto.createHash("sha256").update(fs.readFileSync(outPath)).digest("hex") }));
