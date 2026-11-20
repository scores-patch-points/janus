"""the REFERENT-FIRST registry guard of ctxnom.py: a context arm with no referent, evidence, twin or declared cut cannot be reported; an unregistered twin is refused; arbitrary cuts are listed. Run: python -m unittest test_guard (in this directory, with the embedder venv)."""
import sys, os, unittest, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.argv = ["x"]
import ctxnom as C
class Guard(unittest.TestCase):
    def test_the_real_registry_passes_and_lists_its_arbitrary_cuts(self):
        arb = C.check_registry(C.ARM_SPECS); self.assertIn("N1", arb); self.assertIn("N3", arb); self.assertNotIn("N6", arb); self.assertNotIn("N6F", arb)
    def test_a_context_arm_without_a_twin_is_refused(self):
        s = copy.deepcopy(C.ARM_SPECS); s["N6"]["twin"] = None
        with self.assertRaises(ValueError): C.check_registry(s)
    def test_a_twin_that_is_not_an_arm_is_refused(self):
        s = copy.deepcopy(C.ARM_SPECS); s["N6"]["twin"] = "NOPE"
        with self.assertRaises(ValueError): C.check_registry(s)
    def test_each_missing_field_is_refused(self):
        for k in ("referent", "evidence", "cut"):
            s = copy.deepcopy(C.ARM_SPECS); s["N6"][k] = ""
            with self.assertRaises(ValueError, msg=k): C.check_registry(s)
    def test_every_arm_the_harness_ranks_is_registered_or_a_known_variant(self):
        known = {"N0_raw", "N2w5", "N3w5", "N6_t06", "N6_t10"}
        src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ctxnom.py")).read(); line = [l for l in src.split("\n") if l.strip().startswith("ARMS = [")][0]
        arms = [a.strip().strip('"') for a in line.split("[", 1)[1].split("]", 1)[0].split(",")]
        for a in arms: self.assertTrue(a in C.ARM_SPECS or a in known, f"{a} is ranked but not registered")
if __name__ == "__main__": unittest.main()
