# The brief AS SENT to the labeller context (scene gold with polarity), 2026-10-28

The registered brief (`LABELLING-PROMPT-KIND.md`, sha256 9e705928e14335d83a9bd4a20a71eae44a0bab40a10740af3c8e410c067bd5d6) with its placeholders filled ({PACK} = `/private/tmp/claude-501/scene/pack-window4`, {OUT} = that directory's `gold-raw.json`, {LENS} = 8a230f184c20732e940f85b90edae6a09d062fffc9b4cfde948092460640ded0) and the same clarifying sentences scene-model-5's brief added (`window.txt` may be read for substring checks; the only program allowed is a check of the labeller's own output; `term` and `termSpan` are copied from the statements; `quoteAt` is left out), plus one: every statement record carries `polarity`. The text sent:

---

You are the labeller for a pre-registered gold, a model giving an OPINION that will be filed and hashed and scored against by someone else's code. You have not seen that code and must not look for it.

Read, in this order, ONLY these four files in the directory `/private/tmp/claude-501/scene/pack-window4` and nothing else on this computer:
1. `LABELLING-PROTOCOL-KIND.md` — your lens; follow it exactly (scenes first, then every statement with its polarity, then the output format).
2. `window-numbered.txt` — the text of the window, each narrative paragraph prefixed `[P<n>]`; a chapter heading is shown as `=== chapter heading ... ===`.
3. `statements.json` — the kin statements, in order (`i`, `term`, `text`, `termSpan`, `paragraph`, `snippet`).
4. `beings.json` — the reader's beings (`id`, `face`, `forms`, `mentions` with the paragraph of each): the ONLY ids a `ref` may take.

(You may also read `window.txt` in the same directory: it is the same window without the paragraph prefixes, for checking that a quote is an exact substring.)

Do not read any file outside `/private/tmp/claude-501/scene/pack-window4`; do not run any program other than what you need to write your output file (writing files and, if you wish, a one-off `node -e`/`python3 -c` that only parses YOUR OWN output JSON to check it is valid and that your quotes are substrings of `window.txt`); do not search the file system or the web; do not use anything you remember about the novel (it is a text to you: where the text does not say who someone is, the end is null). Make no call to any other model or agent.

Write ONE file, `/private/tmp/claude-501/scene/pack-window4/gold-raw.json`, a JSON object `KinSceneGold@1`: `{"schema":"KinSceneGold@1","window":"<a name>","opinion":true,"holder":"self:model:<your model id>","lens":"8a230f184c20732e940f85b90edae6a09d062fffc9b4cfde948092460640ded0","scene_breaks":[...],"statements":[...]}` with one record per statement in the order given (all of them), as the protocol's Output section says. Each statement record is `{i, term, termSpan, scene, polarity, holder, possessor}` where `term` and `termSpan` are copied from `statements.json` (`term` as `term`, `termSpan` as `termSpan`) and `polarity` is one of `affirmed`, `negated`, `former`, `other` as the protocol's Polarity section says.
Work in pieces if the file is large (decide and write the scene breaks first, then label the statements in groups, saving as you go), but the final file must be one valid JSON document. Quote pieces must be exact substrings of the window text (not including the `[P<n>] ` prefix); where several pieces are needed, join them with " … ". Leave `quoteAt` out.
When finished, reply with COUNTS ONLY: the number of scenes, of statements, of ends bound and null by `why`, and of statements by polarity. Do not describe the text or your reasoning.
