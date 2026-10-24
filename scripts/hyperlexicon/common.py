"""Shared helpers for the hyperlexicon v1 build (HYPERLEXICON-V1-JANUS-PLAN.md, HYPERLEXICON-V1-PREREG.md).
Zenodotus is read, never written. The log (L0) is append-only, content-addressed gzip JSONL shards plus exact postings.
Env: HL_ZEN (Zenodotus root), HL_OUT (log root, outside git), HL_WORKERS, HL_SMOKE (n documents), HL_ZIDX, HL_DATES."""
import os, json, gzip, hashlib, re, unicodedata
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
WS = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ZEN = os.path.abspath(os.environ.get("HL_ZEN", os.path.join(WS, "Zenodotus")))
OUT = os.path.abspath(os.environ.get("HL_OUT", os.path.expanduser("~/.cache/janus-hyperlexicon/v1")))
ZIDX = os.environ.get("HL_ZIDX", os.path.join(WS, "wiktionary-watch", "exp-out", "zen-index.json"))
DATES = os.environ.get("HL_DATES", os.path.join(WS, "wiktionary-watch", "dates-out", "dates.json"))
SMOKE = int(os.environ.get("HL_SMOKE", "0"))
WORKERS = int(os.environ.get("HL_WORKERS", "4"))

def corpus_dirs():
    """Every collection Zenodotus has: the top folders named NN-<atmosphere>. Nothing is hand-listed."""
    return sorted(d for d in os.listdir(ZEN) if re.match(r"^\d\d-", d) and os.path.isdir(os.path.join(ZEN, d)))

# One token rule for every script: a CJK character, or a run of word characters with internal apostrophes.
CJK = "぀-ヿ㐀-䶿一-鿿豈-﫿"
TOKEN = re.compile(rf"[{CJK}]|(?:(?![{CJK}])\w)+(?:['’](?:(?![{CJK}])\w)+)*")
STRIP_LANGS = {"ru", "uk", "be", "bg", "sr", "mk", "ar", "fa", "ur", "he", "yi", "grc", "el", "la", "sa"}
ALIAS = {"zh": ["zh", "cmn", "lzh", "yue"], "el": ["el", "grc"], "ar": ["ar", "arz", "apc"], "no": ["no", "nb", "nn"]}

def aliases(lang): return ALIAS.get(lang, [lang])

def mkey(s, lang):
    s = s.lower()
    if lang in STRIP_LANGS:
        s = unicodedata.normalize("NFC", "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn"))
    return s

def sha256_hex(b): return hashlib.sha256(b).hexdigest()

def eid(obj): return sha256_hex(json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf8"))[:16]

def event(obj):
    return json.dumps({"id": eid(obj), **obj}, ensure_ascii=False, separators=(",", ":"))

class Shards:
    """Deterministic gzip JSONL shards: <dir>/<prefix>-NNNNN.jsonl.gz, `per` lines each (mtime 0, so a rebuild is byte-identical)."""
    def __init__(self, d, prefix, per=200000):
        os.makedirs(d, exist_ok=True); self.d, self.prefix, self.per, self.n, self.k, self.f, self.total = d, prefix, per, 0, 0, None, 0
    def _open(self):
        self.raw = open(os.path.join(self.d, f"{self.prefix}-{self.k:05d}.jsonl.gz"), "wb")
        self.f = gzip.GzipFile(filename="", mode="wb", fileobj=self.raw, mtime=0); self.k += 1; self.n = 0
    def write(self, line):
        if self.f is None or self.n >= self.per: self.close(); self._open()
        self.f.write(line.encode("utf8") + b"\n"); self.n += 1; self.total += 1
    def close(self):
        if self.f is not None: self.f.close(); self.raw.close(); self.f = None

def read_events(prefix):
    import glob
    for fn in sorted(glob.glob(os.path.join(OUT, "events", f"{prefix}-*.jsonl.gz"))):
        with gzip.open(fn, "rt", encoding="utf8") as f:
            for line in f: yield json.loads(line)

def read_vocab():
    with gzip.open(os.path.join(OUT, "vocab.tsv.gz"), "rt", encoding="utf8") as f:
        types, counts = [], []
        for line in f:
            t, c = line.rstrip("\n").rsplit("\t", 1); types.append(t); counts.append(int(c))
    return types, np.array(counts, dtype=np.int64)

def read_docs(): return json.load(open(os.path.join(OUT, "docs.json"), encoding="utf8"))

def postings(doc):
    """(type id, start, length) per token; start/length are UTF-8 byte offsets when doc['offsets'] == 'byte', else code points."""
    return np.load(os.path.join(OUT, "postings", doc["id"] + ".npy"))

def front(text):
    """The YAML-like frontmatter a Zenodotus fetcher writes: `key: value` lines between --- fences; JSON-quoted values unquoted."""
    if not text.startswith("---"): return {}, 0
    end = text.find("\n---", 3)
    if end < 0 or end > 20000: return {}, 0
    d = {}
    for line in text[3:end].splitlines():
        if ":" not in line: continue
        k, v = line.split(":", 1); k = k.strip(); v = v.strip()
        if not k or " " in k: continue
        if v.startswith('"') and v.endswith('"'):
            try: v = json.loads(v)
            except Exception: pass
        d[k] = v
    return d, end + 4
