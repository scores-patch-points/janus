// make-patched-fold.mjs — the premise-ledger rerun's input: the development fold with the kin binder's candidate facts added to its fact base and its unbound list shortened to what the binder left open.
//   node make-patched-fold.mjs <janus clone> <ledger-dev.json> <outdir> [none]   ("none" writes the unpatched control)
import fs from "node:fs"; import path from "node:path";
const [J, ledgerPath, outDir, mode] = process.argv.slice(2);
const SRC = "/Users/mlacy/Downloads/workspace/foldcode-answer";
const fold = JSON.parse(fs.readFileSync(path.join(SRC, "fold.json"), "utf8"));
const K = await import(path.join(J, "native/organs/kinship.js"));
const { extract } = await import(path.join(J, "scripts/kinship/extract-kin.mjs"));
const { bindKin, loadPriors } = await import(path.join(J, "scripts/kinship/bind-kin.mjs"));
const priors = loadPriors(path.join(J, "priors"));
const textPath = fold.inputs.text_ru.path, buf = fs.readFileSync(textPath), text = buf.toString("utf8");
const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
const res = bindKin({ text, ledger, extraction, priors, tier: 2 });
const quote = (a, b) => buf.subarray(a, b).toString("utf8").replace(/\s+/g, " ").trim();
let specs = fold.kin.specs.slice(), unbound = fold.kin.unbound.slice();
if (mode !== "none") { // modes: (default) relabel half-tied statements; "drop" only remove the fully tied ones
  const plainBound = new Set(fold.kin.statements.map((s, i) => (s.holder ? i : -1)).filter((i) => i >= 0));
  // only the statements the plain arm did not already tie: the binder's duplicate of a plain fact would count one sentence twice
  const added = []; res.statements.forEach((b, i) => { if (b.fact && !plainBound.has(i)) added.push(...res.specs.filter((x) => x.giver === b.fact.giver && x.witness === b.fact.witness)); });
  specs = [...specs, ...added]; res.addedSpecs = added;
  unbound = []; fold.kin.statements.forEach((s, i) => {
    if (plainBound.has(i)) return; const b = res.statements[i];
    if (b.fact) return;
    // mode "drop": a statement the binder only half ties keeps its original category (the ledger audit reads a half-tied statement by its own span text, which cannot show that the tied end is the subject); mode default: the category follows the binder
    const why = mode === "drop" ? fold.kin.unbound.find((u) => u.byteSpan[0] === s.byteSpan[0])?.why : b.possessor.ref && !b.holder.ref ? "holder_unbound" : b.holder.ref && !b.possessor.ref ? "possessor_unbound" : "both_ends_unbound";
    unbound.push({ ...s, why });
  });
}
const base = K.factBase(specs);
const witnessText = (w) => { const [a, b] = w.split("#")[1].split("-").map(Number); return quote(a, b); };
const facts = base.facts.map((f) => ({ id: f.id, rel: f.rel, a: f.a, b: f.b, value: f.value, term: f.term, giver: f.giver, standing: f.standing, witnesses: f.witnesses, witnessText: witnessText(f.witnesses[0]) }));
const rules = K.rulesFromLexicon(priors.lexicon);
const battery = fold.derivation.battery;
const stepBrief = (s) => (s.kind === "rule" ? { kind: "rule", rule: s.rule, giver: s.giver, standing: s.standing } : { kind: "fact", rel: s.rel, a: s.a, b: s.b, value: s.value, giver: s.giver, witness: s.witness, standing: s.standing });
const byReferent = {};
for (const R of fold.six) { byReferent[R] = {}; for (const term of battery) { const a = K.deriveKin({ term, of: R }, { base, rules });
  byReferent[R][term] = { state: a.state, items: a.items.map((i) => ({ who: i.who, derivations: i.derivations.map((d) => ({ standing: d.standing, steps: d.steps.map(stepBrief) })) })), gaps: a.gaps.map((g) => ({ kind: g.kind, slot: g.slot, detail: g.detail ?? null, opinionFillable: g.opinionFillable, opinionSlotId: g.opinionSlot?.id ?? null })), ruleNotes: a.ruleNotes }; } }
fold.kin.specs = specs; fold.kin.unbound = unbound; fold.kin.facts = facts; fold.kin.refused = base.refused; fold.derivation.byReferent = byReferent;
fold.kin.rerun = { mode: mode === "none" ? "control (nothing added)" : mode === "drop" ? "kin binder tier 2 candidates added; only fully tied statements leave the unbound list" : "kin binder tier 2 candidates added; half-tied statements relabelled", binder_facts: mode === "none" ? 0 : res.addedSpecs.length, unbound_after: unbound.length };
fs.mkdirSync(outDir, { recursive: true });
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
fs.writeFileSync(path.join(outDir, "fold.json"), JSON.stringify(sortKeys(fold), null, 2) + "\n");
console.log(JSON.stringify({ mode: mode ?? "patched", facts: facts.length, unbound: unbound.length, binder_specs: mode === "none" ? 0 : res.addedSpecs.length }));
