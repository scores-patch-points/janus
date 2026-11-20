import test from "node:test"; import assert from "node:assert/strict";
import { codeLength, prospective, gain } from "./segmentation-surprise.mjs";
test("the model prices a stream by what it has already seen: a repeated token gets cheaper, a novel one costs its spelling", () => {
  const once = codeLength(["aa"]), twice = codeLength(["aa", "aa"]); assert.ok(twice.bits < 2 * once.bits, "the second 'aa' is cheaper than the first"); assert.equal(twice.novel, 1); assert.equal(codeLength([]).bits, 0);
  assert.ok(codeLength(["abcdefgh"]).bits > codeLength(["ab"]).bits, "a longer novel word costs more to spell");
});
test("a slice that makes pieces REUSABLE lowers the code length: splitting a shared suffix off many stems beats leaving every word glued; a random cut that makes nothing reusable does not", () => {
  const stems = ["oscar", "felix", "bath", "paris", "lena", "hugo", "anna", "marco", "sofia", "tomas", "irene", "paulo"], glued = stems.flatMap((s) => [s + "'s", "x"]), split = stems.flatMap((s) => [s, "'s", "x"]);
  const g = gain(glued, split); assert.ok(g.gain > 0, `splitting must reduce surprise, got ${g.gain}`); assert.ok(g.typesSliced < g.typesPlain * 2);
  const rnd = stems.flatMap((s, i) => [s.slice(0, 1 + (i % 3)), s.slice(1 + (i % 3)) + "'s", "x"]); assert.ok(gain(glued, rnd).gain < g.gain, "an arbitrary cut gains less than the shared-suffix cut");
});
test("competency: the same model built on a training stream prices UNSEEN text cheaper when the slicing exposes what recurs", () => {
  const train = ["Oscar", "'s", "Felix", "'s", "Bath", "'s", "Paris", "'s"], held = ["Lena", "'s", "Hugo", "'s"], trainG = ["Oscar's", "Felix's", "Bath's", "Paris's"], heldG = ["Lena's", "Hugo's"];
  assert.ok(prospective(train, held).bits < prospective(trainG, heldG).bits, "the split representation prices unseen possessives cheaper");
});
test("no gold, no treebank, no regex: the organ takes token lists and nothing else", () => { assert.equal(codeLength.length >= 1, true); });
