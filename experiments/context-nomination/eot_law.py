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
