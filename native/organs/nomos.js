// organs/nomos.js — THE NOMOS: the ledger of the rules of reading.
//
// janus Relates; the nomos is what it keeps. The perceiver reads BY rules —
// the priors that turn bytes into meanings (pos, frame, morph-cues, the
// language laws of a grammar or engine) — and those rules are the content of
// this ledger. They live in khora (`native/priors`, `ethos/derived-priors`);
// janus does not move them — a rule with one home (THE-SPINE) stays where the
// reader stands on it — instead it folds them into nomos rows, each carrying
// the prior's own ADDRESS, so every rule re-expands into its source (the
// holograph property: every part points at the whole).
//
// THE LAW, this file's standing, carried from the hyperlexicon: a rule is
// GIVEN (a named giver bound to a received ground — the treebank, the engine,
// the standard) or EXTRACTED (derived by a builder from observed material,
// admissible as a candidate with witnesses) — NEVER REVEALED. A prior whose
// provenance names no giver and no builder is from no-where: it enters as a
// candidate at most, and `licenseRows` refuses anything that claims more. The
// priors already carry `provenance.giver` almost everywhere (the richer ones
// carry a source sha256); this organ reads that, it never invents it.
//
// Pure. The reader of prior files is INJECTED (this module never touches disk
// and never imports the reader — the closure's one control). The weft stays
// khora's; the nomos is janus's.
import { createHyperlexicon, licenseStanding } from "../../../khora/native/kernel/hyperlexicon.js";

export const NOMOS_SCHEMA = "Nomos@1";

const freeze = Object.freeze;

/** The language a prior is about, read off its own object where it declares one, else the file's. */
export function languageOf(prior, fallback = null) {
  const l = prior?.language;
  if (typeof l === "string") return l;
  if (l && typeof l === "object") return l.iso ?? l.name ?? null;
  return fallback?.language ?? fallback?.stem ?? null;
}

/** The giver a prior names, in whichever shape it declares it ({value,basis} or a bare string). */
export function giverOf(prior) {
  const g = prior?.provenance?.giver;
  if (g == null) return null;
  return typeof g === "string" ? g : g.value ?? g?.id ?? null;
}

export const DECLARED_STANDING = Object.freeze({
  GIVEN: "given",
  CANDIDATE: "candidate",
  UNGROUNDED: "ungrounded",
});

/**
 * The declared standing rule for a prior, read off the prior's OWN provenance:
 *   given      — a named giver (a treebank's human annotation, an engine, a
 *                standard). "A prior is a gift and must name its giver."
 *   candidate  — no giver named but a builder and a source are: derived
 *                observation, admissible as a nomination with its witnesses.
 *   ungrounded — nothing named: from no-where.
 * Falsifying control: a prior the standing classifier reads `given` whose
 * `provenance.giver` names only a builder string and no received ground makes
 * this league discriminate wrong — the giver must be a THING that speaks, not
 * a pipeline that measured.
 */
export function standingOf(prior) {
  if (giverOf(prior)) return DECLARED_STANDING.GIVEN;
  if (prior?.provenance?.builder || prior?.provenance?.source) return DECLARED_STANDING.CANDIDATE;
  return DECLARED_STANDING.UNGROUNDED;
}

/**
 * The nomos, folded from the priors. PURE.
 * @param manifest entries `[{ address, stem?, schema?, language? }]` — the address is the prior's
 *        re-expandable location (a path, `<prior.json>` — `reopen` expands it)
 * @param read(address) -> the prior object | null — INJECTED, never imported
 * @param opts.standingOf a caller's standing rule (default: this file's)
 * @returns { ledger, stats } — one Nomos@1 row per prior: the rule's language,
 *          schema, standing, giver, witnesses (the address + the prior's own
 *          source pin, if any), basis; stats count the fold by standing and schema
 */
export function nomosFromPriors(manifest = [], { read = null, standingOf: judge = standingOf } = {}) {
  if (typeof read !== "function") throw new TypeError("nomos: a reader must be injected (the prior files' reader is the caller's)");
  const rows = [];
  const byStanding = {};
  const bySchema = {};
  const byLanguage = {};
  const byHome = {};

  for (const entry of manifest) {
    const address = entry?.address;
    const raw = address ? read(address) : null;
    if (!raw) continue;
    const schema = raw.schema ?? entry.schema ?? "Unknown";
    const language = languageOf(raw, entry);
    const giver = giverOf(raw);
    const sourcePin = raw.provenance?.source ?? null;
    const standing = judge(raw);
    const witnesses = sourcePin ? [address, String(sourcePin)] : [address];
    // the binding: when a prior pins its received ground as a sha256 (32-64 hex — the
    // morph-cues shape), that hash is the row's binding, so the wall can verify the giver
    // is a real ground and not a reputation string ("no generation from no-where").
    const binding = typeof sourcePin === "string"
      ? sourcePin.trim().split(/\s+/).map((t) => t.split(":").pop()).filter((t) => /^[0-9a-f]{32,64}$/i.test(t)).pop()
      : null;

    byStanding[standing] = (byStanding[standing] ?? 0) + 1;
    bySchema[schema] = (bySchema[schema] ?? 0) + 1;

    rows.push(freeze({
      schema: "NomosRule@1",
      rule: `${schema}${language ? `:${language}` : ""}:${entry.stem ?? address}`,
      stem: entry.stem ?? String(address).split("/").pop(),
      language,
      address,
      standing,
      giver,
      binding,
      witnesses,
      basis: raw.provenance?.basis
        ?? (standing === DECLARED_STANDING.GIVEN && giver
          ? `received — the rule's giver is a named ground (${String(giver).slice(0, 48)})`
          : standing === DECLARED_STANDING.CANDIDATE
            ? "extracted — derived by a builder from observed material; a nomination, not yet licensed"
            : "no giver, no builder, no source — from no-where"),
    }));
  }

  for (const row of rows) {
    const l = row.language ?? "?";
    byLanguage[l] = (byLanguage[l] ?? 0) + 1;
    const home = String(row.address ?? "").split("/").slice(0, -1).pop() ?? "?";
    byHome[home] = (byHome[home] ?? 0) + 1;
  }

  const ledger = freeze({
    schema: NOMOS_SCHEMA,
    version: "Nomos@1",
    rows: freeze(rows),
    stats: freeze({
      schema: "NomosStats@1",
      priors: rows.length,
      byStanding: freeze(byStanding),
      bySchema: freeze(Object.fromEntries(Object.entries(bySchema).sort((a, b) => b[1] - a[1]))),
      byLanguage: freeze(Object.fromEntries(Object.entries(byLanguage).sort((a, b) => b[1] - a[1]))),
      byHome: freeze(Object.fromEntries(Object.entries(byHome).sort((a, b) => b[1] - a[1]))),
    }),
  });

  return freeze({ ledger, stats: ledger.stats });
}

/** The license wall over the nomos: every row's license standing against a charter. */
export function licenseNomos(field, charter = null) {
  const hl = field?.hyperlexicon ?? createHyperlexicon();
  const rows = field?.ledger?.rows ?? field?.rows ?? [];
  return rows.map((row) => ({ ...row, license: licenseStanding({ ...row, standing: row.standing }, charter) }));
}