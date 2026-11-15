// run-arms-pharos.mjs — Janus reads reasoning runs FROM the shared log and
// writes its geometry back TO it (2026-11-14). No other repo is called, imported
// or named in code: the entries are the whole contract.
//
//   reads   reasoning-run, reasoning-claim   (whoever wove them; today khora)
//   writes  run-arm    SEG·Figure   addr arm:<sha16 of the arm's reading>   of [ its runs ]
//           run-arms   SEG·Pattern  addr arms:<log>                         of [ the arm entries ]
//
// A run-arm says: these runs read every ground they read identically. The
// run-arms entry is the cut as a whole: how many arms, how many arm pairs agree
// or conflict on a shared ground, how many reading changes return to an earlier
// reading, and the shapes of the readings. Counts over a cut, never a verdict:
// whether a ground has settled, or which arm stands, is Penelope's to write.
// Cells are nominations (SEG: a cut), not earned from data.
import crypto from 'node:crypto';
import { runArms } from './run-arms.js';

export const RUN_KIND = 'reasoning-run';
export const CLAIM_KIND = 'reasoning-claim';
export const ARM_KIND = 'run-arm';
export const ARMS_KIND = 'run-arms';
const sha16 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

/** log entries (in log order) -> the records run-arms.js reads. Pure. */
export function recordsFromEntries(entries) {
  const out = [];
  for (const e of entries ?? []) {
    if (e?.kind === RUN_KIND) out.push({ kind: RUN_KIND, id: e.id, title: e.addr });
    else if (e?.kind === CLAIM_KIND) {
      const b = e.body ?? {};
      out.push({ kind: CLAIM_KIND, id: e.id, runId: b.run ?? null, unit: b.unit ?? null, ground: b.ground, rel: b.rel, roles: b.roles ?? {}, polarity: b.polarity ?? null, ref: b.ref ?? null });
    }
  }
  return out;
}

/** weaveArms(door) -> { on, why, report, woven, refused }. door = openDoor() of this repo. Never throws. */
export function weaveArms(door) {
  if (!door?.on) return { on: false, why: door?.why ?? 'no door', report: null, woven: 0, refused: 0 };
  const runs = door.fold({ kind: RUN_KIND }) ?? [];
  const claims = door.fold({ kind: CLAIM_KIND }) ?? [];
  // runs first, then claims: each claim names its run, so order between the two kinds does not matter
  const report = runArms(recordsFromEntries([...runs, ...claims]));
  const before = { ...door.counts };
  door.declare(ARM_KIND, 'SEG·Figure', 'runs that read every ground they read identically: one class of the cut of the run line');
  door.declare(ARMS_KIND, 'SEG·Pattern', 'the cut of the run line into arms, with the arm graph, the returns and the reading shapes as counts');
  const armIds = [];
  for (const a of report.arms) {
    const e = door.weave({ cell: 'SEG·Figure', kind: ARM_KIND, addr: `arm:${sha16(a.sig)}`, of: a.runs, body: { runs: a.runs.length, grounds: a.grounds.length } });
    if (e) armIds.push(e.id);
  }
  door.weave({
    cell: 'SEG·Pattern', kind: ARMS_KIND, addr: `arms:${door.log}`, of: armIds,
    body: { schema: report.schema, runs: report.runs, arms: report.arms.length, edges: { compatible: report.edges.compatible, conflict: report.edges.conflict }, totals: report.totals, readings: report.readings },
  });
  return { on: true, why: door.why, report, woven: door.counts.woven - before.woven, refused: door.counts.refused - before.refused, lastReason: door.counts.lastReason };
}
