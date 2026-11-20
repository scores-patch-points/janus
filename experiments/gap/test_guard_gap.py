"""guards for PREREG-GAP-PRONOUN-EOT: python test_guard_gap.py (venv python)"""
import os, sys, json, ast
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
import eot_law_gap as L, gapscore as S
L.check(S.ARMS)
for bad in ({"MYSTERY": "EOT"}, {"EOT_P": "SURFACE"}):
    try: L.check(bad); raise SystemExit(f"FAIL: {bad} was accepted")
    except ValueError: pass
run = open(os.path.join(here, "gaprun.mjs")).read(); score = open(os.path.join(here, "gapscore.py")).read(); conv = open(os.path.join(here, "gap2json.py")).read()
for name, src in (("gaprun.mjs", run), ("gapscore.py", score), ("gap2json.py", conv)):
    assert "import re" not in src and "re.compile" not in src and "RegExp" not in src and ".match(" not in src and "/\\p" not in src, f"{name} uses a regex"
assert "nl-eot.mjs" in run and "loadGrammar" in run and "if (G.gap) throw" in run, "rule 11: the EOT arms must go through the codec door and refuse a language with no codec"
assert run.count("row.gold") == 1 and run.count(".gold") == 1, "no arm may read the gold: row.gold may only be copied to the output once"
assert "writeReading" not in run and "pharos.mjs" not in run and "appendFileSync" not in run, "the harness must write no log: only its own output file"
tree = ast.parse(score); names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
assert not ({"judge", "convict"} & names), "a verdict API appeared"
rows = [{"gold": "A", "aOff": 0, "bOff": 10, "pOff": 12, "url": "u", "EOT_P": "A", "EOT_J": "HELD", "ROWS_P": "HELD", "SHUF": "B"}, {"gold": "B", "aOff": 0, "bOff": 10, "pOff": 2, "url": "v", "EOT_P": "HELD", "EOT_J": "HELD", "ROWS_P": "B", "SHUF": "A"}]
S.baselines(rows); assert rows[0]["NEAR"] == "B" and rows[1]["NEAR"] == "A" and rows[0]["FIRST"] == "A", "NEAR is the candidate nearest the pronoun, FIRST the first-mentioned"
s = S.stats(rows, "EOT_P"); assert s["commits"] == 1 and s["precision"] == 1.0 and s["net"] == 0.5 and s["coverage"] == 0.5, s
rp = os.path.join(os.environ.get("GAP_RAW", "/Users/mlacy/Documents/janus-experiments/gap-raw"), "run-validation.json")
if os.path.exists(rp): assert json.load(open(rp))["swapViolations"] == 0, "an arm prefers an order: swapping A and B changed a decision"
print("test_guard_gap: OK")
