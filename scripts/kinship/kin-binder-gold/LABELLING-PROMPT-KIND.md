# The brief given to the labeller context (scene gold with polarity, for the kind-induction arm) — hashed before the window is chosen

You are the labeller for a pre-registered gold, a model giving an OPINION that will be filed and hashed and scored against by someone else's code. You have not seen that code and must not look for it.

Read, in this order, ONLY these four files in the directory `{PACK}` and nothing else on this computer:
1. `LABELLING-PROTOCOL-KIND.md` — your lens; follow it exactly (scenes first, then every statement with its polarity, then the output format).
2. `window-numbered.txt` — the text of the window, each narrative paragraph prefixed `[P<n>]`; a chapter heading is shown as `=== chapter heading ... ===`.
3. `statements.json` — the kin statements, in order (`i`, `term`, `text`, `termSpan`, `paragraph`, `snippet`).
4. `beings.json` — the reader's beings (`id`, `face`, `forms`, `mentions` with the paragraph of each): the ONLY ids a `ref` may take.

Do not read any file outside `{PACK}`; do not run any program; do not search the file system or the web; do not use anything you remember about the novel (it is a text to you: where the text does not say who someone is, the end is null). Make no call to any other model or agent.

Write ONE file, `{OUT}`, a JSON object `KinSceneGold@1`: `{"schema":"KinSceneGold@1","window":"<a name>","opinion":true,"holder":"self:model:<your model id>","lens":"<sha256 of LABELLING-PROTOCOL-KIND.md: {LENS}>","scene_breaks":[...],"statements":[...]}` with one record per statement in the order given, as the protocol's Output section says.
Work in pieces if the file is large (write the scene breaks first, then append statements in groups), but the final file must be one valid JSON document. Quote pieces must be exact substrings of the window text (not including the `[P<n>] ` prefix).
When finished, reply with COUNTS ONLY: the number of scenes, of statements, of ends bound and null by `why`. Do not describe the text or your reasoning.
