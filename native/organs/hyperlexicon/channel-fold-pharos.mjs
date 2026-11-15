// channel-fold-pharos.mjs — Janus weaves a word fold into the shared log as EVIDENCE (2026-11-15).
// One entry per (a, b, channel): the shared counts and the null's counts at each radius. No comparison, no
// "same word": whoever judges reads this entry from the log and writes its own verdict entry `of` it.
//
//   word-fold   CON·Figure   addr word-fold:<channel>:<a>|<b>   body ChannelFold@1 (counts only)
//
// The cell is a nomination (CON: the incidence of two words' balls), not earned from data. The pair is
// ordered as asked: the null is drawn against `a`, so (a, b) and (b, a) are two readings.
export const WORD_FOLD_KIND = 'word-fold';
export const WORD_FOLD_CELL = 'CON·Figure';

/** weaveWordFold(door, reading, basis?) -> the entry, or null when the door is off or refuses. Never throws. */
export function weaveWordFold(door, reading, basis = {}) {
  if (!door?.on || !reading?.per) return null;
  door.declare(WORD_FOLD_KIND, WORD_FOLD_CELL, 'how many nodes two words\' folds share along one channel of the hyperlexicon, with the counts of a null matched on ball size');
  return door.weave({
    cell: WORD_FOLD_CELL, kind: WORD_FOLD_KIND, addr: `word-fold:${reading.channel}:${reading.a}|${reading.b}`,
    body: { schema: reading.schema, channel: reading.channel, a: reading.a, b: reading.b, per: reading.per },
    basis: { organ: 'janus native/organs/hyperlexicon/channel-fold.mjs', ...basis },
  });
}
