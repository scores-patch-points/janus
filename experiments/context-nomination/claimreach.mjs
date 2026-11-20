// DEV-only FEASIBILITY DIAGNOSTIC (exploratory, nothing scored, no arm): how far can a claim-and-binding universe REACH beyond the name-bearing sentences?
// For each ZERO-CLEAN gold sentence: does it hold an anaphor (a pronoun or a definite description) whose binding CANDIDATES include the target (a possible bond), and how near is it to a name-bearing sentence?
import fs from "node:fs";
const m = await import("/Users/mlacy/Documents/khora-pharos-reading/native/the-fold/pharos-reading.mjs"), { bindingsOf } = await import("/Users/mlacy/Documents/janus/native/organs/binding-evidence.mjs");
const g = await m.grammarFor("eng"); if (g.gap) throw new Error(g.why);
const fold = (s) => [...s.normalize("NFKD").toLowerCase()].filter((c) => !/\p{M}/u.test(c)).join(""), stem = (t) => (t.length >= 5 && t.endsWith("es") ? t.slice(0, -2) : t.length >= 4 && t.endsWith("s") ? t.slice(0, -1) : t);
const Q = JSON.parse(fs.readFileSync("dev-queries.json", "utf8")), lim = process.argv[2] ? +process.argv[2] : Q.length, tot = {};
const bump = (k, n = 1) => (tot[k] = (tot[k] ?? 0) + n); let t0 = Date.now();
for (const doc of Q.slice(0, lim)) {
  const text = JSON.parse(fs.readFileSync(doc.file, "utf8")).text, rows = m.readingRows(g, text).filter((r) => r.at != null), sentOf = (at) => { let lo = 0, hi = doc.sent.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (doc.sent[mid][0] <= at) lo = mid; else hi = mid - 1; } return lo; };
  const props = []; for (let i = 0; i < rows.length; i++) if (rows[i].upos === "PROPN") { let j = i; while (j + 1 < rows.length && rows[j + 1].upos === "PROPN" && rows[j + 1].s === rows[i].s) j++; props.push({ being: "P:" + rows.slice(i, j + 1).map((r) => r.form).join(" "), at: rows[i].at, end: rows[j].end }); i = j; }
  bump("documents"); bump("rows", rows.length);
  for (const q of doc.qs) {
    if (!q.zc.length) continue;
    const nt = q.name.split(/\s+/).map((w) => stem(fold(w))).filter(Boolean), spans = [];
    for (let i = 0; i + nt.length <= rows.length; i++) { let ok = true; for (let k = 0; k < nt.length; k++) { const r = rows[i + k]; if (r.s !== rows[i].s || stem(fold(r.form)) !== nt[k]) { ok = false; break; } } if (ok) spans.push({ being: "T", at: rows[i].at, end: rows[i + nt.length - 1].end }); }
    const others = props.filter((p) => !spans.some((s) => p.at < s.end && s.at < p.end)), res = bindingsOf(rows, [...spans, ...others], { window: +(process.env.W ?? 3) });
    const anaphorsBySent = new Map(); for (const a of res.anaphors) { const si = sentOf(a.anaphor.at); if (!anaphorsBySent.has(si)) anaphorsBySent.set(si, []); anaphorsBySent.get(si).push(a); }
    for (const gs of q.zc) {
      bump("ZC gold"); const seeds = q.bearing, dist = seeds.length ? Math.min(...seeds.map((b) => Math.abs(b - gs))) : null; bump(seeds.length ? "ZC gold with a name-bearing sentence (ZC_QUERY)" : "ZC gold, name in no sentence (ZC_NOQUERY)");
      if (!seeds.length) { if (!spans.length) bump("   (and the reader finds no contiguous name mention either)"); continue; }
      if (dist <= 1) bump("  ZC_QUERY gold within 1 sentence of a name-bearing sentence"); if (dist <= 3) bump("  ZC_QUERY gold within 3 sentences of a name-bearing sentence");
      const an = anaphorsBySent.get(gs) ?? []; if (an.length) bump("  ZC_QUERY gold that holds an anaphor (pronoun or definite description)");
      const bond = an.filter((a) => a.candidates.some((c) => c.ref.being === "T" && c.agreement.number !== "mismatch"));
      if (bond.length) { bump("  ZC_QUERY gold with a POSSIBLE bond to the target (candidate list includes it)"); if (dist > 3) bump("     of which farther than 3 sentences from any name-bearing sentence"); }
    }
  }
}
console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, JSON.stringify(tot, null, 1));
