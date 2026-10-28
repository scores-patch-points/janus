# The brief AS SENT to the labeller context (scene gold), 2026-10-28

The registered brief (`LABELLING-PROMPT-SCENE.md`, sha256 1f0e2b29f68ce313c78332cabbfbf2232c820262b3b1001cae4be8e89fcf298f) with its three placeholders filled ({PACK} = `/private/tmp/claude-501/scene/pack-window3`, {OUT} = that directory's `gold-raw.json`, {LENS} = a53cfdeb553061e2d130d6a29559b6ec7068d724c6498e9e88dcf2999e7efed1) and four clarifying sentences added (declared here: `window.txt` may be read for substring checks; the only program allowed is a check of the labeller's own output; `term` and `termSpan` are copied from the statements; the instruction to leave `quoteAt` out). The text sent:

---

You are the labeller for a pre-registered gold, a model giving an OPINION that will be filed and hashed and scored against by someone else's code. You have not seen that code and must not look for it.

Read, in this order, ONLY these four files in the directory `/private/tmp/claude-501/scene/pack-window3` and nothing else on this computer:
1. `LABELLING-PROTOCOL-SCENE.md` — your lens; follow it exactly (scenes first, then every statement, then the output format).
2. `window-numbered.txt` — the text of the window, each narrative paragraph prefixed `[P<n>]`; a chapter heading is shown as `=== chapter heading ... ===`.
3. `statements.json` — the kin statements, in order (`i`, `term`, `text`, `termSpan`, `paragraph`, `snippet`).
4. `beings.json` — the reader's beings (`id`, `face`, `forms`, `mentions` with the paragraph of each): the ONLY ids a `ref` may take.

(You may also read `window.txt` in the same directory: it is the same window without the paragraph prefixes, for checking that a quote is an exact substring.)

Do not read any file outside `/private/tmp/claude-501/scene/pack-window3`; do not run any program other than what you need to write your output file (writing files and, if you wish, a one-off `node -e`/`python3 -c` that only parses YOUR OWN output JSON to check it is valid and that your quotes are substrings of `window.txt`); do not search the file system or the web; do not use anything you remember about the novel (it is a text to you: where the text does not say who someone is, the end is null). Make no call to any other model or agent.

Write ONE file, `/private/tmp/claude-501/scene/pack-window3/gold-raw.json`, a JSON object `KinSceneGold@1`: `{"schema":"KinSceneGold@1","window":"<a name>","opinion":true,"holder":"self:model:<your model id>","lens":"a53cfdeb553061e2d130d6a29559b6ec7068d724c6498e9e88dcf2999e7efed1","scene_breaks":[...],"statements":[...]}` with one record per statement in the order given (all of them), as the protocol's Output section says. Each statement record is `{i, term, termSpan, scene, holder, possessor}` where `term` and `termSpan` are copied from `statements.json` (`term` as `term`, `termSpan` as `termSpan`).
Work in pieces if the file is large (decide and write the scene breaks first, then label the statements in groups, saving as you go), but the final file must be one valid JSON document. Quote pieces must be exact substrings of the window text (not including the `[P<n>] ` prefix); where several pieces are needed, join them with " … ". Leave `quoteAt` out.
When finished, reply with COUNTS ONLY: the number of scenes, of statements, of ends bound and null by `why`. Do not describe the text or your reasoning.
