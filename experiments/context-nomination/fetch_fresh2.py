"""FRESH-2 fetch, as declared in PREREG-CONTEXT-NOMINATION-ADDENDUM-1 (stamp bb100ba8bdd8d76d): Featured articles in API order (the Penelope session's cached member list, READ ONLY),
positions p mod 50 = 11, the first 60; any title already in her dev or fresh set is dropped and the next position of the rule is taken. Her fetch logic (same API, user agent, politeness), her lib.build_doc
READ ONLY; everything is written under ~/Documents/janus-experiments/ctxnom/data; nothing is written into her repo."""
import sys, os, json, time, glob, urllib.request, urllib.parse
REF = "/Users/mlacy/Documents/khora-cast/penelope/experiments/zero-overlap/referent"; sys.path.insert(0, REF)
from lib import build_doc
API = "https://en.wikipedia.org/w/api.php"; UA = "referent-retrieval-research/0.1 (research script)"
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "data", "fresh2"); RC = os.path.join(HERE, "data", "redirects2.json")
def get(params, tries=8):
    url = API + "?" + urllib.parse.urlencode(params)
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503): time.sleep(5 * (k + 1)); continue
            raise
        except Exception: time.sleep(3 * (k + 1))
    raise RuntimeError("fetch failed: " + url)
def resolve(titles):
    cache = json.load(open(RC)) if os.path.exists(RC) else {}; red = {}
    ts = sorted(t for t in set(titles) if t not in cache)
    for i in range(0, len(ts), 50):
        d = get({"action": "query", "titles": "|".join(ts[i:i + 50]), "redirects": 1, "format": "json", "formatversion": 2})
        for r in d.get("query", {}).get("redirects", []): red[r["from"]] = r["to"]
        for r in d.get("query", {}).get("normalized", []): red.setdefault(r["from"], r["to"])
        time.sleep(0.3)
    for t in ts: cache[t] = red.get(t, t)
    json.dump(cache, open(RC, "w")); return cache
used = {json.load(open(f))["title"] for s in ("dev", "fresh") for f in glob.glob(os.path.join(REF, "data", s, "*.json"))}
titles = json.load(open(os.path.join(REF, "data", "featured-members.json")))["titles"]
order, dropped = [], []
for p in range(11, len(titles), 50):
    if titles[p] in used: dropped.append((p, titles[p])); continue
    order.append((p, titles[p]))
    if len(order) == 60: break
json.dump({"rule": "Featured articles API order, p mod 50 = 11, first 60, titles in dev or fresh dropped", "positions": [p for p, _ in order], "dropped": dropped}, open(os.path.join(HERE, "data", "fresh2-selection.json"), "w"), indent=1)
print(f"selected {len(order)} (last position {order[-1][0]}), dropped {len(dropped)} already-used titles", flush=True)
for pos, title in order:
    path = os.path.join(OUT, f"{pos:05d}.json")
    if os.path.exists(path): continue
    d = get({"action": "query", "prop": "revisions", "rvprop": "ids|content", "rvslots": "main", "titles": title, "format": "json", "formatversion": 2})
    rev = d["query"]["pages"][0]["revisions"][0]; wt = rev["slots"]["main"]["content"]
    doc0 = build_doc(title, rev["revid"], wt, {}); red = resolve([l["target"] for l in doc0["links"]]); doc = build_doc(title, rev["revid"], wt, red); doc["pos"] = pos
    json.dump(doc, open(path, "w")); print(pos, title[:48], len(doc["sentences"]), "sent", len(doc["links"]), "links", flush=True); time.sleep(1)
print("done:", len(os.listdir(OUT)), "documents")
