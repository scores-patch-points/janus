import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNodes, titleIndex } from './read-nodes.mjs';

const idx = titleIndex({ titles: ['Edinburgh', 'Royal College of Surgeons of Edinburgh', 'Dentistry', 'Scotland'], resolved: { 'dental surgery': 'Dentistry' } });

test('longest span wins: one node, not four', () => {
  const r = readNodes('He joined the Royal College of Surgeons of Edinburgh in 1850.', idx);
  assert.deepEqual(r.nodes, ['Royal College of Surgeons of Edinburgh']);
});

test('redirect surface forms resolve to their referent', () => {
  assert.deepEqual(readNodes('He practised dental surgery in Scotland.', idx).nodes.sort(), ['Dentistry', 'Scotland']);
});

test('a sentence-initial capital is tried lowered; unknown spans are not invented into nodes', () => {
  const r = readNodes('Dentistry fascinated Quixotic Zebras.', idx);
  assert.deepEqual(r.nodes, ['Dentistry']);
  assert.ok(!r.spans.some((s) => /Zebras/.test(s.surface)));
});

test('empty and unmatched text read to no nodes (a gap for the caller, never a guess)', () => {
  assert.deepEqual(readNodes('', idx).nodes, []);
  assert.deepEqual(readNodes('nothing here is known', idx).nodes, []);
});

test('deterministic', () => {
  const a = readNodes('Edinburgh and Scotland.', idx), b = readNodes('Edinburgh and Scotland.', idx);
  assert.deepEqual(a, b);
});

test('punctuation-bearing titles match however the text spells them (U.S., Washington, D.C.)', () => {
  const i2 = titleIndex({ titles: ['U.S.', 'Washington, D.C.', "O'Brien's"] });
  assert.deepEqual(readNodes('Born in the U.S. near Washington D.C. and met O\'Brien\'s kin.', i2).nodes.sort(), ["O'Brien's", 'U.S.', 'Washington, D.C.'].sort());
});

test('combining marks stay inside tokens; NFC and NFD spellings agree', () => {
  const i3 = titleIndex({ titles: ['Café', 'भारत'] });
  assert.deepEqual(readNodes('We met at the Café in भारत.', i3).nodes.sort(), ['Café', 'भारत'].sort());
  assert.deepEqual(readNodes('the Cafe only', i3).nodes, [], 'an unaccented spelling is a different title, not a match');
});

test('there is no cap on title length: a twelve-token title is reachable', () => {
  const long = 'one two three four five six seven eight nine ten eleven twelve';
  const i4 = titleIndex({ titles: [long] });
  assert.deepEqual(readNodes(`Before ${long} after.`, i4).nodes, [long]);
});

test('a title that opens a later sentence is tried lowered, not only the first sentence', () => {
  const i5 = titleIndex({ titles: ['paris'] });
  assert.deepEqual(readNodes('He left. Paris was calm.', i5).nodes, ['paris']);
});

test('a very long text with a huge maxSpan stays fast (no cubic blow-up)', () => {
  const i6 = titleIndex({ titles: ['Edinburgh'] });
  const text = Array.from({ length: 1000 }, (_, k) => `word${k}`).join(' ');
  const t0 = Date.now();
  readNodes(text, i6, { maxSpan: 1000 });
  assert.ok(Date.now() - t0 < 1000);
});
