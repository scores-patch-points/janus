"""REFERENT-FIRST rule 11 for the GAP experiment: every arm declares its level; none may be called EOT unless it reads the passage through nl-eot.mjs (gaprun.mjs does for EOT_J, EOT_P, SHUF; ROWS_P is the reader's surface rows, GRAMMAR; NEAR, FIRST and RAND are SURFACE)."""
LEVELS = {"EOT_J": "EOT", "EOT_P": "EOT", "SHUF": "EOT", "ROWS_P": "GRAMMAR", "NEAR": "SURFACE", "FIRST": "SURFACE", "RAND": "SURFACE"}
def check(arms):
    for a, lvl in arms.items():
        if a not in LEVELS: raise ValueError(f"rule 11: arm {a} declares no level")
        if LEVELS[a] != lvl: raise ValueError(f"rule 11: arm {a} is declared {LEVELS[a]} but scored as {lvl}")
