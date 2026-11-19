// bind-sieve-struct: round 2 and later of the binder's sieve (CONTRACT C.3:
// 5a act, 5b role, 5c forced, 5d kind and role-frame, 6 bridge check) and the
// kind evidence of C.2 (K1-K5), as a read-only kind view.
//
// Pure: no I/O, no clock, no randomness, no model. Janus proposes; whether a
// link stands is declared elsewhere. Everything here reads the links that stand at the
// previous round (handed in) and the texts' acts (handed in).
//
// Choices made where the contract is silent:
//  - sha16, canonJson, mentionId, actId and linkId are private copies with the
//    API card's behaviour (the card places them in bind-sieve-r0.mjs); they are
//    not exported here.
//  - "alternatives are never forced": a mention that is an end of a link in a
//    held alternative group is not proposed by 5c, 5d or a role-frame link.
//  - the kind-candidates body of the contract lists kinds with members only;
//    the company of a member is read from `kind.company` or
//    `populations[pop].company` (item -> array of company keys, or object of
//    key -> count). Without it companyCount is 0 for every key.

import { createHash } from "node:crypto";

// ---- private id helpers (same behaviour as the card's r0 exports) ----------

function sha16(s) {
  return createHash("sha256").update(String(s)).digest("hex").slice(0, 16);
}

function canonJson(v) {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonJson).join(",") + "]";
  return (
    "{" +
    Object.keys(v)
      .sort()
      .filter((k) => v[k] !== undefined)
      .map((k) => JSON.stringify(k) + ":" + canonJson(v[k]))
      .join(",") +
    "}"
  );
}

const mentionId = (text, m) => `${text}#m${m}`;
const actId = (text, a) => `${text}#a${a}`;

function parseId(id) {
  const k = String(id).lastIndexOf("#");
  const tail = String(id).slice(k + 1);
  return { text: String(id).slice(0, k), kind: tail[0] === "a" ? "a" : "m", i: Number(tail.slice(1)) };
}

function linkId(pass, a, b, evidence) {
  const ends = [a, b].sort();
  return sha16(canonJson({ pass, ends, evidence }));
}

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

// ---- kind view (C.2) --------------------------------------------------------

export const NO_KINDS = Object.freeze({
  on: false,
  recordSha: "none",
  kindOf: () => null,
  slotCount: () => null,
  sameKind: () => null,
  companyCount: () => null,
});

function companySet(source, member) {
  const c = source && source[member];
  if (!c) return new Set();
  if (Array.isArray(c)) return new Set(c.map(String));
  if (typeof c === "object") return new Set(Object.keys(c).filter((k) => c[k]));
  return new Set();
}

// kindStandingBody: the kind-standing body (kinds with
// `stands`); kindCandidatesBody: the kind-candidates body (members per kind).
// opts.kinds must be "standing" for the view to be on.
export function makeKindView(kindStandingBody, kindCandidatesBody, opts = {}) {
  if (!opts || opts.kinds !== "standing" || !kindStandingBody || !kindCandidatesBody) return NO_KINDS;
  const standIds = new Set(
    (kindStandingBody.kinds || []).filter((k) => k && k.stands).map((k) => k.id),
  );
  const rec = kindStandingBody.record;
  const recordSha =
    typeof rec === "string" ? rec : rec && typeof rec.sha === "string" ? rec.sha : "none";
  const byKey = { entity: new Map(), predicate: new Map() };
  const kinds = new Map(); // kind id -> { population, members, company: Map member -> Set }
  for (const pop of ["entity", "predicate"]) {
    const P = (kindCandidatesBody.populations || {})[pop];
    const list = [...((P && P.kinds) || [])].sort((x, y) => cmp(String(x.id), String(y.id)));
    for (const k of list) {
      if (!standIds.has(k.id)) continue;
      const members = [...(k.members || [])].map(String).sort();
      const company = new Map();
      for (const mem of members) {
        const own = k.company ? companySet(k.company, mem) : companySet(P && P.company, mem);
        company.set(mem, own);
      }
      kinds.set(k.id, { population: pop, members, company });
      for (const mem of members) if (!byKey[pop].has(mem)) byKey[pop].set(mem, k.id); // disjoint partitions
    }
  }
  const kindOf = (key, population) => {
    const m = byKey[population];
    return m && m.has(String(key)) ? m.get(String(key)) : null;
  };
  const companyCount = (kindId, companyKey) => {
    const k = kinds.get(kindId);
    if (!k) return null;
    let n = 0;
    for (const set of k.company.values()) if (set.has(companyKey)) n++;
    return n;
  };
  return {
    on: true,
    recordSha,
    kindOf,
    // K4: members of the key's standing kind whose company holds <pred>/<role>
    slotCount: (key, pred, role) => {
      const id = kindOf(key, "entity");
      return id === null ? null : companyCount(id, `${pred}/${role}`);
    },
    // one standing kind holding both keys: its id, else null
    sameKind: (population, keyA, keyB) => {
      const a = kindOf(keyA, population);
      return a !== null && a === kindOf(keyB, population) ? a : null;
    },
    companyCount,
  };
}

// ---- indexing ---------------------------------------------------------------

function indexGroup(group) {
  const members = [...(group.members || Object.keys(group.texts || {}))].sort();
  const mentions = new Map();
  const acts = new Map();
  const actsByText = new Map();
  const add = (addr, body, isMember) => {
    if (!body) return;
    const list = [];
    for (const m of body.mentions || []) {
      mentions.set(mentionId(addr, m.m), { id: mentionId(addr, m.m), text: addr, rec: m });
    }
    for (const a of body.acts || []) {
      const e = { id: actId(addr, a.a), text: addr, rec: a };
      acts.set(e.id, e);
      list.push(e);
    }
    if (isMember) actsByText.set(addr, list);
  };
  const docs = new Map();
  for (const addr of members) {
    const t = (group.texts || {})[addr];
    if (!t) continue;
    add(addr, t.acts, true);
    if (t.doc && t.doc.acts) docs.set(t.doc.address || `doc-of:${addr}`, t.doc.acts);
  }
  for (const addr of [...docs.keys()].sort()) add(addr, docs.get(addr), false);
  return { members, mentions, acts, actsByText };
}

function flattenLinks(links) {
  const out = [];
  const seen = new Set();
  const push = (l) => {
    if (l && l.id !== undefined && !seen.has(l.id)) {
      seen.add(l.id);
      out.push(l);
    }
  };
  for (const x of links || []) {
    if (x && (Array.isArray(x.links) || Array.isArray(x.acts))) {
      for (const l of x.links || []) push(l);
      for (const l of x.acts || []) push(l);
    } else push(x);
  }
  return out;
}

function unionFind(ids) {
  const parent = new Map();
  for (const id of ids) parent.set(id, id);
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c);
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (ra < rb) parent.set(rb, ra);
    else parent.set(ra, rb);
  };
  return { find, union };
}

function stateOf(group, standing, links) {
  const idx = indexGroup(group);
  const flat = flattenLinks(links);
  const byId = new Map(flat.map((l) => [l.id, l]));
  const stands = new Set((standing && standing.stands) || []);
  const standLinks = flat.filter((l) => stands.has(l.id));
  const mentionLinks = standLinks.filter((l) => l.pass !== "act");
  const actLinks = standLinks.filter((l) => l.pass === "act");

  const mUF = unionFind(idx.mentions.keys());
  for (const l of mentionLinks) mUF.union(l.a, l.b);
  const aUF = unionFind(idx.acts.keys());
  for (const l of actLinks) aUF.union(l.a, l.b);

  const comps = new Map();
  const nodeIds = new Set(idx.mentions.keys());
  for (const l of mentionLinks) {
    nodeIds.add(l.a);
    nodeIds.add(l.b);
  }
  for (const id of [...nodeIds].sort()) {
    const r = mUF.find(id);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push(id);
  }
  return { idx, flat, byId, stands, standLinks, mentionLinks, actLinks, mUF, aUF, comps };
}

const kindIdOf = (kv, key) => {
  const k = kv.kindOf(key, "entity");
  return k && typeof k === "object" ? k.id ?? null : k ?? null;
};

function pointsFrom(st, kv) {
  const points = [];
  for (const ids of st.comps.values()) {
    const texts = new Set();
    const keys = new Set();
    const kinds = new Set();
    for (const id of ids) {
      texts.add(parseId(id).text);
      const m = st.idx.mentions.get(id);
      if (!m) continue;
      const ik = Array.isArray(m.rec.ikey) ? m.rec.ikey.join(" ") : m.rec.ikey ?? m.rec.key;
      if (ik !== undefined && ik !== null) keys.add(String(ik));
      const k = kindIdOf(kv, m.rec.key);
      if (k !== null && k !== undefined) kinds.add(k);
    }
    points.push({
      id: "pt:" + sha16(canonJson(ids)),
      mentions: ids,
      texts: [...texts].sort(),
      keys: [...keys].sort(),
      kinds: [...kinds].sort(),
    });
  }
  return points.sort((x, y) => cmp(x.mentions[0], y.mentions[0]));
}

// points: components of the links standing at the previous round (held
// excluded); every mention of the group and its documents is in one, singletons
// included. `links` holds the link objects of the rounds so far (act links too).
export function pointsOf(group, standing, links, kv = NO_KINDS) {
  return pointsFrom(stateOf(group, standing, links), kv || NO_KINDS);
}

// ---- round 2 and later ------------------------------------------------------

function fillersOf(act, wanted) {
  // distinct fillers of kind wanted ("m" | "a") with their role labels in order
  const out = new Map();
  for (const r of act.rec.roles || []) {
    const f = r.filler || {};
    let id = null;
    if (wanted === "m" && typeof f.m === "number") id = mentionId(act.text, f.m);
    if (wanted === "a" && typeof f.a === "number") id = actId(act.text, f.a);
    if (id === null) continue;
    if (!out.has(id)) out.set(id, { id, roles: [] });
    const e = out.get(id);
    if (!e.roles.includes(r.role)) e.roles.push(r.role);
  }
  return [...out.values()];
}

const uniqSorted = (pairs) => {
  const seen = new Map();
  for (const p of pairs) seen.set(JSON.stringify(p), p);
  return [...seen.keys()].sort().map((k) => seen.get(k));
};

function findPaths(adj, from, to, cap) {
  const paths = [];
  let truncated = false;
  const visited = new Set([from]);
  const walk = (node, trail) => {
    if (truncated) return;
    if (node === to) {
      if (paths.length >= cap) {
        truncated = true;
        return;
      }
      paths.push([...trail]);
      return;
    }
    for (const { to: nx, id } of adj.get(node) || []) {
      if (visited.has(nx)) continue;
      visited.add(nx);
      trail.push(id);
      walk(nx, trail);
      trail.pop();
      visited.delete(nx);
    }
  };
  walk(from, []);
  return { paths, truncated };
}

const PASS_ORDER = { act: 0, role: 1, forced: 2, kind: 3, "role-frame": 4 };

export function round2(group, kv, opts, standing, links, predEvidence) {
  const K = opts && opts.kinds === "standing" && kv && kv.on ? kv : NO_KINDS;
  const st = stateOf(group, standing, links);
  const { idx } = st;
  const round = standing && Number.isInteger(standing.round) ? standing.round + 1 : 2;

  const pointOf = (mid) => (st.idx.mentions.has(mid) ? st.mUF.find(mid) : null);
  const known = new Set(st.flat.map((l) => l.id));
  const emitted = [];
  const emitIds = new Set();

  const heldEnds = new Set();
  for (const h of (standing && standing.held) || []) {
    for (const alt of h.alternatives || []) {
      for (const lid of alt) {
        const l = st.byId.get(lid);
        if (l) {
          heldEnds.add(l.a);
          heldEnds.add(l.b);
        }
      }
    }
  }

  const kindsOfEnds = (a, b) => {
    if (!K.on) return null;
    const ma = idx.mentions.get(a);
    const mb = idx.mentions.get(b);
    return {
      a: ma ? kindIdOf(K, ma.rec.key) : null,
      b: mb ? kindIdOf(K, mb.rec.key) : null,
    };
  };

  const emit = (pass, a, b, evidence, kinds) => {
    const id = linkId(pass, a, b, evidence);
    if (known.has(id) || emitIds.has(id)) return null;
    emitIds.add(id);
    const l = { id, pass, a, b, evidence, round, kinds: kinds ?? null };
    emitted.push(l);
    return l;
  };

  // predEvidence by unordered act pair
  const pe = new Map();
  for (const e of predEvidence || []) pe.set([e.a, e.b].sort().join("\u0000"), e);

  // ---- 5a act ----
  for (let i = 0; i < idx.members.length; i++) {
    for (let j = i + 1; j < idx.members.length; j++) {
      const xs = idx.actsByText.get(idx.members[i]) || [];
      const ys = idx.actsByText.get(idx.members[j]) || [];
      for (const x of xs) {
        const xm = fillersOf(x, "m");
        const xa = fillersOf(x, "a");
        for (const y of ys) {
          const ym = fillersOf(y, "m");
          const ya = fillersOf(y, "a");
          let L = 0;
          const rolePairs = [];
          const count = (fx, fy, same) => {
            for (const f of fx) {
              for (const g of fy) {
                if (!same(f.id, g.id)) continue;
                L++;
                for (const rf of f.roles) for (const rg of g.roles) rolePairs.push([rf, rg]);
              }
            }
          };
          count(xm, ym, (p, q) => pointOf(p) !== null && pointOf(p) === pointOf(q));
          count(xa, ya, (p, q) => idx.acts.has(p) && idx.acts.has(q) && st.aUF.find(p) === st.aUF.find(q));
          if (L < 1) continue;
          const p = pe.get([x.id, y.id].sort().join("\u0000")) || null;
          const equal = x.rec.pred === y.rec.pred;
          const kind = !equal && K.on ? K.sameKind("predicate", x.rec.pred, y.rec.pred) : null;
          const positive = !!(p && Number(p.score) > 0);
          if (!(equal || positive || kind || L >= 2)) continue;
          emit(
            "act",
            x.id,
            y.id,
            {
              L,
              rolePairs: uniqSorted(rolePairs),
              preds: [x.rec.pred, y.rec.pred],
              predEvidence: p ? { ab: p.ab, ba: p.ba, score: p.score, antonym: !!p.antonym } : null,
              kind: kind || null,
            },
            null,
          );
        }
      }
    }
  }

  // ---- 5b, 5c, 5d over the standing act links ----
  const actLinks = [...st.actLinks].sort((p, q) => cmp(p.a, q.a) || cmp(p.b, q.b) || cmp(p.id, q.id));
  for (const al of actLinks) {
    const x = idx.acts.get(al.a);
    const y = idx.acts.get(al.b);
    if (!x || !y) continue;
    const fx = fillersOf(x, "m").filter((f) => idx.mentions.has(f.id));
    const fy = fillersOf(y, "m").filter((f) => idx.mentions.has(f.id));
    const covered = new Set();
    const base = { actLink: al.id, acts: [x.id, y.id] };

    // 5b role
    const rolesY = new Set(fy.flatMap((g) => g.roles));
    const sharedRoles = [...new Set(fx.flatMap((f) => f.roles))].filter((r) => rolesY.has(r)).sort();
    for (const role of sharedRoles) {
      for (const f of fx.filter((e) => e.roles.includes(role))) {
        for (const g of fy.filter((e) => e.roles.includes(role))) {
          if (pointOf(f.id) === pointOf(g.id)) continue;
          const made = emit("role", f.id, g.id, { ...base, role }, kindsOfEnds(f.id, g.id));
          if (made) {
            covered.add(f.id);
            covered.add(g.id);
          }
        }
      }
    }

    const unlinked = () => {
      const pointsY = new Set(fy.map((g) => pointOf(g.id)));
      const pointsX = new Set(fx.map((f) => pointOf(f.id)));
      return {
        LX: fx.filter((f) => !pointsY.has(pointOf(f.id)) && !covered.has(f.id)),
        LY: fy.filter((g) => !pointsX.has(pointOf(g.id)) && !covered.has(g.id)),
      };
    };

    // 5c forced
    {
      const { LX, LY } = unlinked();
      if (LX.length === 1 && LY.length === 1 && !heldEnds.has(LX[0].id) && !heldEnds.has(LY[0].id)) {
        const f = LX[0];
        const g = LY[0];
        const made = emit(
          "forced",
          f.id,
          g.id,
          { ...base, roles: [f.roles[0], g.roles[0]] },
          kindsOfEnds(f.id, g.id),
        );
        if (made) {
          covered.add(f.id);
          covered.add(g.id);
        }
      }
    }

    // 5d kind (K2) and role-frame (K3)
    if (K.on) {
      const { LX, LY } = unlinked();
      for (const f of LX) {
        for (const g of LY) {
          if (heldEnds.has(f.id) || heldEnds.has(g.id)) continue;
          const kf = kindIdOf(K, idx.mentions.get(f.id).rec.key);
          const kg = kindIdOf(K, idx.mentions.get(g.id).rec.key);
          if (kf !== null && kg !== null) {
            if (kf === kg) {
              emit("kind", f.id, g.id, { ...base, kind: kf, roles: [f.roles[0], g.roles[0]] }, kindsOfEnds(f.id, g.id));
            }
            continue;
          }
          if (kf !== null && kg === null) {
            for (const rg of g.roles) {
              const company = `${y.rec.pred}/${rg}`;
              const count = K.companyCount(kf, company);
              if (count > 0) {
                emit(
                  "role-frame",
                  f.id,
                  g.id,
                  { ...base, kind: kf, company, count, roles: [f.roles[0], rg] },
                  kindsOfEnds(f.id, g.id),
                );
                break;
              }
            }
          } else if (kg !== null && kf === null) {
            for (const rf of f.roles) {
              const company = `${x.rec.pred}/${rf}`;
              const count = K.companyCount(kg, company);
              if (count > 0) {
                emit(
                  "role-frame",
                  f.id,
                  g.id,
                  { ...base, kind: kg, company, count, roles: [rf, g.roles[0]] },
                  kindsOfEnds(f.id, g.id),
                );
                break;
              }
            }
          }
        }
      }
    }
  }

  // ---- 6 bridge check ----
  const adj = new Map();
  for (const l of [...st.mentionLinks].sort((p, q) => cmp(p.id, q.id))) {
    if (!adj.has(l.a)) adj.set(l.a, []);
    if (!adj.has(l.b)) adj.set(l.b, []);
    adj.get(l.a).push({ to: l.b, id: l.id });
    adj.get(l.b).push({ to: l.a, id: l.id });
  }
  const bridges = [];
  for (const [rid, rule] of (standing && standing.refused) || []) {
    const l = st.byId.get(rid);
    if (!l || l.pass === "act" || l.a === l.b) continue;
    const pa = pointOf(l.a);
    if (pa === null || pa !== pointOf(l.b)) continue;
    const [a, b] = [l.a, l.b].sort();
    const { paths, truncated } = findPaths(adj, a, b, 1000);
    if (paths.length === 0) continue;
    paths.sort((p, q) => cmp(p.join(","), q.join(",")));
    const entry = { a, b, refused: { id: rid, rule }, paths };
    if (truncated) entry.truncated = true;
    bridges.push(entry);
  }
  bridges.sort((p, q) => cmp(p.a, q.a) || cmp(p.b, q.b) || cmp(p.refused.id, q.refused.id));

  const order = (l) => [PASS_ORDER[l.pass] ?? 9, l.a, l.b, l.id];
  const sorted = emitted.sort((p, q) => {
    const op = order(p);
    const oq = order(q);
    return op[0] - oq[0] || cmp(op[1], oq[1]) || cmp(op[2], oq[2]) || cmp(op[3], oq[3]);
  });
  return {
    links: sorted.filter((l) => l.pass !== "act"),
    acts: sorted.filter((l) => l.pass === "act"),
    bridges,
  };
}
