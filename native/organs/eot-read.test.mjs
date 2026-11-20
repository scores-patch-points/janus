import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { loadGrammar } from "./nl-eot.mjs"; import { readLayered, readFromLog, applyDerivations, reconstruct, verifyVerbatim } from "./eot-read.mjs";
import { cliticRulesFrom, derivationsFrom } from "./rule-entries.mjs";
const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/rule-entries.fixture.json", import.meta.url), "utf8")).entries;   // a TEST DOUBLE of the entries Penelope writes
const G = loadGrammar("eng"), clitics = cliticRulesFrom(fx, { language: "eng" }), derivations = derivationsFrom(fx), node = (rec, lemma) => rec.meaning.nodes.find((n) => n.lemma === lemma), feat = (n, k) => n?.feats.find((f) => f.name === k);
test("end to end from ENTRIES: Oscar's current residence -> Oscar + 's, Oscar gets Case=Gen at CON·Pattern as a DERIVED feature that names its rule and its giver; a possessive pronoun's genitive is not re-derived", () => {
  const r = readLayered(G, "The question asks for Oscar's current residence. Felix's work location is not declared single-valued. His work is done.", { clitics, derivations });
  assert.equal(r.records.length, 3); const os = node(r.records[0], "Oscar"), rec0 = r.records[0]; assert.ok(os, "the possessor is its own node");
  assert.equal(feat(os, "Case")?.value, "Gen"); assert.equal(feat(os, "Case")?.cell, "CON·Pattern", "the English possessor sits where the Greek genitive sits"); assert.ok(rec0.derivations.some((d) => d.rule === "possessive-clitic-genitive" && d.applied && d.add === "Case=Gen" && d.giver.kind === "asker"), "the derivation names its rule and giver");
  assert.ok(!rec0.meaning.nodes.some((n) => n.lemma === "Oscar's"), "no glued possessive being"); assert.equal(r.records[2].derivations.length, 0, "his is Case=Gen from the parser: nothing derived");
  assert.equal(r.rows[0].rows.find((x) => x.form === "Oscar").deprel, "nmod:poss", "the rows carry nmod:poss for Penelope's claim layer");
  const felix = r.rows[1]; if (felix.rows.find((x) => x.form === "Felix")?.deprel !== "nmod:poss") assert.equal(felix.derivations.length, 0, "a measured miss of the shipped EWT parser: no nmod:poss, so no derived genitive: it does not guess");
});
test("no surviving rule, no split: with no clitic rules the possessive stays glued and the reader SAYS so; unproven rules touch nothing; a creole gets none of the English rules", () => {
  const bare = readLayered(G, "Oscar's current residence is Bath.", { clitics: { gap: "no_clitic_rules", why: "x" }, derivations: null }); assert.ok(bare.gaps.some((g) => g.gap === "no_clitic_rules") && bare.gaps.some((g) => g.gap === "no_derivations")); assert.equal(bare.records[0].derivations.length, 0);
  const unproven = cliticRulesFrom(fx.filter((e) => e.kind !== "rule-verdict"), { language: "eng" }); assert.equal(readLayered(G, "Oscar's knot isn't tied.", { clitics: unproven, derivations }).rows[0].forms.includes("'s"), false, "no verdict, no split");
  const knot = readLayered(G, "The knot is tied.", { clitics, derivations }); assert.ok(!knot.rows[0].forms.includes("not"));
});
test("readFromLog: the rules are read from the log through the door; a door that is off splits nothing and says why", () => {
  const door = { on: true, ask: (kinds) => fx.filter((e) => kinds.includes(e.kind)) }; assert.ok(readFromLog(door, G, "Oscar's current residence is Bath.").rows[0].forms.includes("'s"));
  const off = readFromLog({ on: false, why: "no pointer" }, G, "Oscar's current residence is Bath."); assert.ok(!off.rows[0].forms.includes("'s")); assert.ok(off.gaps.some((g) => g.gap === "no_door"));
});
test("derivation scope and conflicts: a rule scoped to eng never fires for another code; a parser feature is never overwritten; a derivation entry with no giver is refused", () => {
  const rows = [{ id: 1, form: "Oscar", upos: "PROPN", feats: "Number=Sing", head: 3, deprel: "nmod:poss" }, { id: 2, form: "'s", upos: "PART", feats: "_", head: 1, deprel: "case" }, { id: 3, form: "residence", upos: "NOUN", feats: "_", head: 0, deprel: "root" }];
  assert.equal(applyDerivations(rows, derivations, "pcm").applied.length, 0, "scoped to eng only"); assert.equal(applyDerivations(rows, derivations, "eng").rows[0].feats, "Case=Gen|Number=Sing");
  const conflict = applyDerivations(rows.map((r) => (r.id === 1 ? { ...r, feats: "Case=Nom|Number=Sing" } : r)), derivations, "eng"); assert.equal(conflict.rows[0].feats, "Case=Nom|Number=Sing"); assert.equal(conflict.applied[0].applied, false); assert.match(conflict.applied[0].conflict, /Case=Nom/);
  assert.equal(derivationsFrom([{ ...fx.find((e) => e.kind === "derivation-rule"), body: { ...fx.find((e) => e.kind === "derivation-rule").body, giver: {} } }]).rules.length, 0);
});
test("the derivation rule entry tests no string, and the clitic splitter holds no word list", () => {
  const d = JSON.stringify(fx.find((e) => e.kind === "derivation-rule").body); assert.equal(d.includes("'s"), false, "a derivation must be structural: no clitic string in a rule"); const c = fs.readFileSync(new URL("./clitic-split.mjs", import.meta.url), "utf8"); assert.equal(/"'s"|'n't'/.test(c), false, "clitic-split.mjs must not hard-code a clitic");
});

test("NOTHING IS LOST: the records rebuild the source text VERBATIM (irregular spacing, newlines, tabs, unicode, leading and trailing whitespace, a clitic split), every sentence span slices back to its text, every token span to its token", () => {
  const texts = ["Oscar's residence is Bath.  Felix's work isn't done.\n\nA new paragraph, with   odd   spacing!\tTab here. Caf\u00e9 na\u00efve \u2014 100% \u201cquoted\u201d text.", "  leading and trailing  \n", "Short.", "", "   ", "Emoji \u{1F600} and \u0645\u0631\u062d\u0628\u0627 here. Done."];
  for (const t of texts) for (const c of [null, clitics]) { const r = readLayered(G, t, { clitics: c, derivations: c ? derivations : null }); assert.equal(reconstruct(r), t, JSON.stringify(t).slice(0, 40)); const v = verifyVerbatim(t, r); assert.ok(v.ok, `${JSON.stringify(t).slice(0, 40)}: ${v.why}`); }
  const r = readLayered(G, "The question asks for Oscar's current residence.", { clitics, derivations }), sp = r.records[0].surface.tokenSpans, text = "The question asks for Oscar's current residence."; assert.equal(text.slice(...sp[5]), "Oscar"); assert.equal(text.slice(...sp[6]), "'s", "the split clitic is addressed into the original bytes"); assert.equal(r.records[0].surface.unit, "utf16");
});
test("a record set that cannot reproduce its source is REFUSED by verifyVerbatim, so a lossy reader cannot pass", () => {
  const t = "One sentence.   Another one.", r = readLayered(G, t, {}); assert.ok(verifyVerbatim(t, r).ok);
  const dropped = { ...r, records: r.records.map((x, i) => (i === 1 ? { ...x, surface: { ...x.surface, before: "" } } : x)) }; assert.equal(verifyVerbatim(t, dropped).ok, false, "a dropped gap is caught");
  const wrong = { ...r, records: r.records.map((x, i) => (i === 0 ? { ...x, surface: { ...x.surface, span: [1, 5] } } : x)) }; assert.equal(verifyVerbatim(t, wrong).ok, false, "a wrong span is caught");
});
