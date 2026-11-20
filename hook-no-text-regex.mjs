#!/usr/bin/env node
// gym/hook-no-text-regex.mjs — a Claude Code PreToolUse hook (Edit | Write | MultiEdit): it BLOCKS a write that would add a regex applied to language.
// Wired in .claude/settings.json. Reads the tool call as JSON on stdin; exit 2 blocks the call and the message on stderr goes to Claude; exit 0 allows. It fails OPEN (exit 0, with a note) on anything it cannot parse: a broken hook must not stop the work, the CI step and `npm test` are the backstop.
// The rule (GL-TP-06, nexus rule 8): language is read through the reader's rows to EOT marks, never by a pattern. Allowed: a line the baseline already carries, or a line declaring `// regex-ok: <why it is not language>` (a path, hash, id or file format). The detector is text-regex-ratchet.mjs, the same one the gate and CI use: one definition.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { addedHits, readBaseline, carried } from "./text-regex-ratchet.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.basename(HERE) === "gym" ? path.resolve(HERE, "..") : HERE;
let raw = ""; try { raw = fs.readFileSync(0, "utf8"); } catch { process.exit(0); }
let call; try { call = JSON.parse(raw); } catch { console.error("hook-no-text-regex: could not read the tool call; allowing"); process.exit(0); }
const input = call.tool_input ?? {}, file = input.file_path ? path.resolve(call.cwd ?? ROOT, input.file_path) : null;
if (!file || !file.startsWith(ROOT + path.sep)) process.exit(0);                                  // only files inside this repo
const rel = path.relative(ROOT, file), baseline = path.join(ROOT, fs.existsSync(path.join(ROOT, "gym")) ? "gym" : ".", "text-regex-baseline.jsonl");
const ids = carried(readBaseline(baseline)), pieces = call.tool_name === "Write" ? [{ text: input.content ?? "", old: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "" }] : call.tool_name === "MultiEdit" ? (input.edits ?? []).map((e) => ({ text: e.new_string ?? "", old: e.old_string ?? "" })) : call.tool_name === "Edit" ? [{ text: input.new_string ?? "", old: input.old_string ?? "" }] : [];
const bad = pieces.flatMap((p) => addedHits(rel, p.text, p.old, ids));
if (!bad.length) process.exit(0);
console.error(`BLOCKED by the text-regex rule (GL-TP-06, nexus rule 8): this write adds a regex applied to a value in ${rel}:\n${bad.map((b) => `  ${b.text}`).join("\n")}\nLanguage (a sentence, a question, a name, a relation) is read through the reader's rows (upos, deprel, feats, offsets) and written to the log as marks; it is never matched by a pattern or a word list. Read it through the reader, or, if this is NOT language (a path, hash, id, file format), keep the regex and add on that line or the one before:  // regex-ok: <why it is not language>`);
process.exit(2);
