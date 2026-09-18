# tools/

Workflow scripts and their test harness. **Tracked and linted**, unlike the scratch they grew
out of — they sat untracked in `docs/incomplete/` until 2026-09-17, which put them inside
`package.json`'s `files: ["docs"]` and so inside the published npm tarball, and outside Biome's
`includes` and therefore outside the `lint` gate.

They are development tooling for running this repo's own board. **Nothing under `src/` imports
them, and they do not ship** — `files` now names `docs/choices`, the one docs subtree the CLI
reads at runtime (`readMore()`, `src/lib/ask.ts`).

| File | What it is |
|---|---|
| `board-sweep.js` | A Workflow script: triages open board items, then builds and audits what is not blocked. |
| `harness2.mjs` | Runs `board-sweep.js`'s real body against stubbed agents, so the lane and dependency logic under test is the shipped code rather than a paraphrase. |
| `items.json` | The board rows `harness2.mjs` drives, as data. |

```bash
node tools/harness2.mjs
```

## Why `board-sweep.js` is excluded from Biome

It is a Workflow script **body**, not an ES module: it ends in a top-level `return`, which the
Workflow runtime makes legal by wrapping the source in a function — exactly what `harness2.mjs`
does with `new Function(…)` to test it. Biome parses it as a module and stops at
`Illegal return statement outside of a function`, which is a true statement about a module and
a false one about this file.

So `biome.json` excludes that one path (`"!tools/board-sweep.js"`) and lints everything else
here. The exclusion is the file's shape, not a waiver on its contents: if it ever stops being a
Workflow body, delete the exclusion rather than working around it.
