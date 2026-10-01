# tools

This folder holds the development tooling for running this repo's own board. It has one Workflow script that sweeps the open board items, and a harness that tests the script without starting a real agent. Nothing under `src/` or `tests/` imports these files, and they do not ship: the `files` list in `package.json` names `dist`, `src`, `catalog.json`, `standard`, `templates`, `profiles` and `docs/choices`, so this folder stays out of the npm tarball.

| File | What it is |
|---|---|
| `board-sweep.js` | A Workflow script. It triages open board items, then builds and audits the ones that are not blocked. |
| `harness2.mjs` | Runs the body of `board-sweep.js` against stubbed agents, so the lane and dependency logic under test is the shipped code and not a paraphrase of it. |
| `items.json` | Five sample board rows that the harness feeds to the script. |

## Running the harness

The harness needs Node 20 or newer and nothing else. Run it from the repo root:

```bash
node tools/harness2.mjs
```

It runs ten scenarios in order: a replay of an earlier sweep, a triage agent that throws, a triage agent that returns nothing, two transitive dependency chains, a dependency that crosses lanes, a build that reports red gates, a missing `args.items`, a dependency that is not in the sweep, and a sweep of one item. After each scenario it prints the blocked items, the deferred items with what each one waits on, the items that built, any duplicate builds, any agent started without a model or an isolation setting, and the model chosen for each triage agent. In the first scenario, for example, items 37 and 38 are blocked, so item 36 is deferred behind 37 and only items 35 and 39 run.

The harness has no assertions. It exits 0 once every scenario has finished, so a wrong result shows only in the printed lines, and you read them against the scenario name. `bun test` and CI do not run it.

To point the harness at a different copy of the script, set `SCRIPT` to a path. A relative path resolves against this folder, and the default is `./board-sweep.js`.

```bash
SCRIPT=/path/to/copy.js node tools/harness2.mjs
```

The stubbed agents ignore the prompt text. Only the `id`, `model`, `lane`, `waitsOn` and `kind` of a row change the result, so the `prompt` fields in `items.json` are placeholders, and the titles are fixtures from an early release (item 36 is titled "Cut `0.2.6`"). They do not track the live board.

## How `board-sweep.js` works

The script is a Workflow script body. It expects `args.items` to be a real JSON array of rows shaped `{id, title, model, lane, waitsOn, kind, prompt}` and throws at once if it gets anything else, including a stringified array. It returns `{ blocked, deferred, results }`.

1. Triage. One agent per item reads the item's prompt, checks its claims against the repo, and decides whether an open owner decision remains. An "Ask before building" section blocks the item only when the prompt does not already record the owner's answer. A triage agent that throws or returns nothing counts as blocked. Triage runs on Opus, or on Fable when the item itself is assigned `Fable 5.1`, because a wrong triage builds quietly and looks fine.
2. Deferral. Each build runs in its own worktree cut from committed `HEAD`, so a build cannot see a sibling's output. An item is therefore deferred whenever anything in its `waitsOn` appears in the same sweep, whether that dependency is ready, deferred or blocked. A dependency that is not in the sweep counts as already landed. To run a deferred item, land its dependency first and sweep again.
3. Lanes. The remaining items are grouped by `lane` (default `A`). Lanes run in parallel and the items inside one lane run one after another, which keeps items that touch the same area of the code from colliding.
4. Build and audit. An item with `kind` set to anything but `review` gets a builder in a worktree of its own, then an auditor in a second worktree that reruns the gates. The audit is skipped when the builder reports red gates or returns nothing. An item with `kind: "review"` gets one read-only reviewer and no build. The builder prompt forbids `git commit` and `git push`.

The script maps an item's `model` to an agent model by exact match: `Fable 5.1` runs as `fable`, `Sonnet 5` runs as `sonnet`, and every other value runs as `opus`. A renamed tier therefore falls through to `opus` without a warning.

## Linting

`bun run lint` runs Biome over `src`, `tests` and `tools`, and CI runs that command. Within `tools/` Biome checks `harness2.mjs` only. The `includes` list in `biome.json` names `tools/**/*.js` and `tools/**/*.mjs`, so `items.json` is not checked, and it excludes `tools/board-sweep.js`. An override in the same file turns off the `noConsole` rule for `tools/**`, because the harness reports by printing.

`board-sweep.js` is excluded because it is a Workflow script body and not an ES module. It ends in a top-level `return`, which the Workflow runtime makes legal by wrapping the source in a function. The harness does the same with `new Function(...)`. Biome parses the file as a module and stops at `Illegal return statement outside of a function`, which is true of a module and false of this file.

The exclusion describes the shape of the file and waives nothing in its contents. If the file ever stops being a Workflow body, delete the `!tools/board-sweep.js` line from `biome.json`. Do not work around it.
