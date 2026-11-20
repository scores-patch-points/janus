"""REFERENT-FIRST rule 11: all language passes through its codec to EOT; matching and reasoning happen in EOT, never on the surface.
LEVEL of every arm of the claim-graph experiment, declared honestly (2026-11-20, the night the owner said "all languages must pass through a codec to EOT"):
  SURFACE  ranks or matches raw strings: an embedding of surface sentences or anchor strings
  GRAMMAR  reads the language's UD codec rows (tokens, lemmas, relations) but keeps STRING handles (the anchor string, the lemma key) and embeds surface sentences
  EOT      nodes, relations and handles are EOT content nodes and cube-addressed relations (khora eot-rich.js); NONE of the arms below is EOT yet
Every extractor must take a language code and go through a codec; today they call the reader's English rows directly, so the extractors are GRAMMAR-level, English only, and no arm may claim EOT."""
LEVELS = {
  # ctxalias.py
  "A0": "SURFACE", "CG": "GRAMMAR", "CGB": "GRAMMAR", "ADJ": "SURFACE", "FLAT": "GRAMMAR", "T_CG": "SURFACE", "PROX": "SURFACE",
  # ctxfull.py
  "FG": "GRAMMAR", "FGB": "GRAMMAR", "FG_NOLEM": "GRAMMAR", "ADJF": "SURFACE", "FLATF": "GRAMMAR", "T_FG": "SURFACE",
  # ctxvoid.py
  "VG": "GRAMMAR", "VGB": "GRAMMAR", "VGR": "GRAMMAR", "NG": "GRAMMAR", "VG_RAND": "GRAMMAR", "VGB_RAND": "GRAMMAR", "T_VG": "SURFACE",
  # ctxadmit.py
  "A0A": "SURFACE", "A0A_SHUF": "SURFACE", "VGA": "GRAMMAR", "VGA_SHUF": "GRAMMAR",
}
EXTRACTORS = ("claimgraph.mjs", "fullgraph.mjs", "kinds.mjs")
def check(registries):
    for name, specs in registries.items():
        for arm in specs:
            if arm not in LEVELS: raise ValueError(f"REFERENT-FIRST rule 11: arm {arm} of {name} declares no level (SURFACE, GRAMMAR or EOT)")
    return {a: l for a, l in LEVELS.items()}
def report_line():
    by = {}
    for a, l in LEVELS.items(): by.setdefault(l, []).append(a)
    return "LEVELS (rule 11, all language through its codec to EOT): " + "; ".join(f"{k}: {', '.join(v)}" for k, v in sorted(by.items())) + " | NONE is EOT: matching still rests on surface strings and the English reader's rows"

# Scripts that read raw text WITHOUT going through nl-eot.mjs, each declared with its level and why it still exists (rule 11 test in native/organs/janus-rules.test.mjs refuses any other).
# A new entry needs the owner's word. The default extractor for a text experiment is eotgraph.mjs (EOT).
GRAMMAR_EXTRACTORS = {
  "claimgraph.mjs": "GRAMMAR (frozen, ADDENDUM-1 parent run; superseded for new work by eotgraph.mjs)",
  "fullgraph.mjs": "GRAMMAR (frozen, ADDENDUM-1 to 3 runs; superseded for new work by eotgraph.mjs)",
  "claimreach.mjs": "GRAMMAR (DEV diagnostic written before the law; reads the reader's rows directly; not an arm)",
  "ctxnom.py": "SURFACE (the context-nomination harness of the Penelope row 30 task; frozen)",
}
GRAMMAR_EXTRACTORS["../gap/gaprun.mjs"] = "MIXED (GAP: EOT_J, EOT_P and SHUF go through nl-eot.mjs; ROWS_P is Penelope's organ over the reader's rows, GRAMMAR; levels in experiments/gap/eot_law_gap.py)"
GRAMMAR_EXTRACTORS["../parse/parselib.mjs"] = "CODEC EVALUATION (PREREG-PARSE-ENGLISH-LAYERS: gold-tokenized treebank sentences through the UD parser and its blends; it measures the codec itself, no matching or reasoning on text)"
GRAMMAR_EXTRACTORS["../parse/parseeval.mjs"] = "CODEC EVALUATION (loads the trained UD parser models by path and scores them on gold-tokenized treebank sentences)"
GRAMMAR_EXTRACTORS["../parse/test_parse.mjs"] = "CODEC EVALUATION guard test (loads a trained UD parser model by path)"
GRAMMAR_EXTRACTORS["../parse/parseerrors.mjs"] = "CODEC EVALUATION (DEV error analysis: gold-tokenized treebank sentences through the pooled UD parser; structural profiles of wrong tokens, never their words)"
GRAMMAR_EXTRACTORS["../parse/cliticeffect.mjs"] = "CODEC EVALUATION (DEV: the downstream effect of a clitic split on the parse of gold-tokenized treebank sentences, against random-cut nulls; no text matching or reasoning)"
GRAMMAR_EXTRACTORS["../parse/surprisegain.mjs"] = "SURFACE (DEV: code-length measurement over the raw sentence text a treebank carries; uses the generic tokenizer, no parser, no gold)"
GRAMMAR_EXTRACTORS["../ants/colony.mjs"] = "SURFACE (DEV: the ant colony over raw token streams, scored by retroactive code length and by a tagger's confidence; reads treebank raw text and, for the gold-agreement report only, gold tokens)"
GRAMMAR_EXTRACTORS["../ants/antlib.mjs"] = "SURFACE (the colony's moves, guard and gold-agreement report; gold tokens are read only by goldF1)"
GRAMMAR_EXTRACTORS["../ants/test_ants.mjs"] = "SURFACE (guard tests of the colony)"
GRAMMAR_EXTRACTORS["../parse/deltatokens.mjs"] = "CODEC EVALUATION (DEV: the teacher-versus-ours disagreement per token with structural profiles, on gold-tokenized treebank sentences)"
GRAMMAR_EXTRACTORS["../parse/deltakinds.mjs"] = "CODEC EVALUATION (DEV: kind induction over the disagreement tokens' structural profiles)"
GRAMMAR_EXTRACTORS["../parse/teacher_silver.py"] = "TEACHER (the library annotates raw text through its own codec to UD rows: silver, a nomination, local only)"
GRAMMAR_EXTRACTORS["../ants/confcheck.mjs"] = "SURFACE (DEV calibration of the colony's tagger-confidence score on real text and on character-shuffled noise)"
GRAMMAR_EXTRACTORS["../ants/competency.mjs"] = "SURFACE (DEV: parse-based self-supervised competency signals for the colony, calibrated on real versus shuffled text; gold is read only to validate)"
GRAMMAR_EXTRACTORS["../parse/priorcollapse.mjs"] = "CODEC EVALUATION (DEV/REUSED: structural attachment priors mined from gold train and the held spectrum of the teacher's and our arcs on gold-tokenized sentences)"
GRAMMAR_EXTRACTORS["../parse/priorlib.mjs"] = "CODEC EVALUATION (the prior tables and the spectrum)"
GRAMMAR_EXTRACTORS["../parse/test_prior.mjs"] = "CODEC EVALUATION guard tests of the prior library"
