// janus/native/kernel/hyperlexicon.js — SHIM (no implementation lives here).
//
// The hyperlexicon organ has ONE home: khora's `native/kernel/hyperlexicon.js` (khora is the base; janus
// imports it, never copies it — no duplicate organs, khora/native/docs/THE-SPINE.md, check-spine.mjs). This
// file exists only so janus's own relative imports ("./hyperlexicon.js") keep resolving. Re-export only.
export * from "../../../khora/native/kernel/hyperlexicon.js";
