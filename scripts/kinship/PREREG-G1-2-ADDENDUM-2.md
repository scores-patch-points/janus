# PREREG G1-2 — Addendum 2 (filed BEFORE any fresh text was read by the measurement)

Parents: PREREG-G1-2.md sha256 0ceb5af9bfe0272eb403e365ea6f289a4f0eaffb2cc76e0ffa636c87fb9b193f; Amendment 1 sha256 04cbd7113911d6b161155e64fb053ea156154882bea87ab4136780cd9adbc406.

Frozen before the fresh run (sha256):
- scripts/kinship/measure-kin.mjs  02441a4d650397ec6afa2f33544afecca7207652b8e31e9a6c5caf9fa2fd29ac   (rehearsed on the SPENT dev regions only: Russian [0,43427), English [0,36680); the rehearsal found one defect, a transient door failure in G0, fixed by retries; nothing else changed)
- native/organs/kinship.js (the engine and the opinion seam) 6f4b5131d9d267fb537b0104062f0acdb17f5bb9026b148c2894fce7156eb4ba
- native/organs/kinship.test.mjs 4144568833a8c372df3c8135a88733f52c5241988a311e515b00c01b052fe1fe   (15 of 15 pass; S3 first failed on 73 questions, the engine was corrected, the bar was not)
- extract-kin.mjs, kin-lexicon.mjs, kin-lexicon.json, name-parts-ru.json: unchanged from the PREREG (a4f776bb…, e6230339…, 4f00c968…, 96aae932…).

Command (fresh): node scripts/kinship/measure-kin.mjs --region fresh --ru <full Russian> --en <Maude> --lex out/kin-lexicon.json --np priors/name-parts-ru.json --out <dir>.
Dev rehearsal numbers (spent, not evidence): Russian dev, K3: 13 facts, 12 persons, 0 of 12 uncle questions answered; English dev, K3: 3 facts, 3 persons, 0 answered.
Nothing registered is tuned after the fresh run; a bar that cannot be assessed is reported as such.
