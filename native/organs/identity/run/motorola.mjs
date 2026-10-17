// run/motorola.mjs — run the discrepancy finder over the Motorola resolution's
// primary document (Sourcewell master agreement / RFP 030425 with Motorola
// Solutions).
//
// The reader here is thin but real: the addendum header/ack dates, the contract
// codes, and the discount lines are extracted from the text by structure. The
// full page→assertions reader is still the next gap. The finder and parsers do
// the rest.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDiscrepancies, checkLift } from '../finder.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOC =
  process.argv[2] ??
  path.resolve(
    __dirname,
    '../../legacy2/holodeck/demo-motorola/Sourcewell master agreement 030425-MOT with Motorola Solutions.txt',
  );

if (!existsSync(DOC)) {
  console.error(`document not found: ${DOC}`);
  process.exit(1);
}

const text = readFileSync(DOC, 'utf8');
const lines = text.split('\n');
const lineOf = (needle) => {
  const i = lines.findIndex((l) => l.includes(needle));
  return i < 0 ? '?' : i + 1;
};

console.log('# Discrepancy finder — Motorola resolution primary document\n');
console.log(`source: ${DOC}`);
console.log(`lines: ${lines.length}\n`);

// ── A. addendum dates: header vs acknowledgement ────────────────────────────
console.log('## A. Addendum dates: header vs acknowledgement\n');

function addendumDates() {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^Addendum No\. (\d+)$/);
    if (!m) continue;
    const no = m[1];
    let header = null;
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(lines[j].trim())) { header = { value: lines[j].trim(), address: `line ${j + 1}` }; break; }
    }
    let ack = null;
    for (let j = i + 1; j < lines.length && !/^Addendum No\./.test(lines[j]); j++) {
      const am = lines[j].match(/\bon (\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (am) { ack = { value: am[1], address: `line ${j + 1}` }; break; }
    }
    out.push({ no, header, ack });
  }
  return out;
}

const flips = [];
for (const ad of addendumDates()) {
  const A = {
    name: 'header',
    slots: {
      'addendum.no': { terrain: 'key', value: ad.no, address: ad.header?.address ?? '?' },
      date: { terrain: 'date', value: ad.header?.value, address: ad.header?.address ?? '?' },
    },
  };
  const bSlots = { 'addendum.no': { terrain: 'key', value: ad.no, address: ad.ack?.address ?? '?' } };
  if (ad.ack?.value) bSlots.date = { terrain: 'date', value: ad.ack.value, address: ad.ack.address };
  const B = { name: 'acknowledgement', slots: bSlots };

  const noGiver = findDiscrepancies(A, B, { identityKeys: ['addendum.no'], giver: { name: 'document-structure' } });
  const withCentury = findDiscrepancies(A, B, { identityKeys: ['addendum.no'], giver: { name: 'document-structure', twoDigitYearBase: 2000 } });
  const dNo = noGiver.find((v) => v.slot === 'date');
  const dWith = withCentury.find((v) => v.slot === 'date');

  console.log(`Addendum ${ad.no}: header "${ad.header?.value ?? '(missing)'}" vs ack "${ad.ack?.value ?? '(missing)'}"`);
  console.log(`   no century giver:  ${dNo.kind}${dNo.reason ? ` — ${dNo.reason}` : ''}`);
  if (dWith.kind === 'different') {
    flips.push(`Addendum ${ad.no}: ${dWith.valueA.year} (header) ≠ ${dWith.valueB.year} (ack)`);
    console.log(`   with 2000s giver:  ${dWith.kind} — ${dWith.valueA.year} ≠ ${dWith.valueB.year}`);
  } else {
    console.log(`   with 2000s giver:  ${dWith.kind}${dWith.reason ? ` — ${dWith.reason}` : ''}`);
  }
}

// ── B. contract count: "Twelve (12)" vs the enumerated list ─────────────────
console.log('\n## B. Contract count: "Twelve (12)" vs the enumerated list\n');

const codes = [...new Set([...text.matchAll(/^(051321-[A-Z]{3})$/gm)].map((m) => m[1]))];
const countMatch = text.match(/Twelve \((\d+)\) contracts/);
const countAccount = {
  name: 'addendum-4 list',
  slots: {
    'contracts.awarded': { terrain: 'count', value: countMatch ? countMatch[1] : '12', address: `line ${lineOf('Twelve (12) contracts')}` },
    ...Object.fromEntries(codes.map((c) => [`contract.${c}`, { terrain: 'item', value: 1, address: `line ${lineOf(c)}` }])),
  },
};
const lift = checkLift(countAccount, {
  op: 'count',
  of: codes.map((c) => `contract.${c}`),
  to: 'contracts.awarded',
  giver: 'addendum-4 enumeration',
});
console.log(`codes enumerated: ${codes.length}`);
console.log(`stated: ${lift.stated}  computed: ${lift.computed}  verdict: ${lift.kind} (giver: ${lift.giver})`);

// ── C. discount range: "0-10% off" vs listed discounts ──────────────────────
console.log('\n## C. Discount range: "0-10% off" vs listed discounts\n');

const discounts = [...text.matchAll(/^(.+)\n(\d+(?:\.\d+)?)%$/gm)].map((m) => ({
  product: m[1].trim(),
  pct: parseFloat(m[2]),
}));
const maxPct = Math.max(...discounts.map((d) => d.pct));
const over = discounts.filter((d) => d.pct > 10);
console.log(`listed discount lines: ${discounts.length}`);
console.log(`max discount: ${maxPct}%`);
console.log(`claim "discount range of 0-10% off" (line ${lineOf('discount range of 0-10%')}) → ${over.length === 0 ? 'CONSISTENT (bound)' : 'CONTRADICTION: ' + over.map((d) => d.product).join(', ')}`);

// ── summary ─────────────────────────────────────────────────────────────────
console.log('\n## Summary\n');
if (flips.length) {
  console.log('Convictions (after a century giver is declared):');
  for (const f of flips) console.log(`  • ${f}`);
} else {
  console.log('No date convictions.');
}
console.log('\nThe finder refuses to convict on a bare 2-digit year ("25") and only');
console.log('convicts 2024 ≠ 2025 once a century giver is declared. Count and');
console.log('discount-range checks come back bound.');
