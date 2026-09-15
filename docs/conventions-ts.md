# TypeScript conventions — personal-config

The standard for every `.ts` file in this repo. **Self-contained** — apply it without reading
anything else. It is the first dogfooded output of the practices catalog: these are the rules
the wizard would write for this repo, written by hand first.

Every rule has an ID, and **IDs are never renumbered** — they are how commit messages, other
docs and lint suppressions cite a rule. Every rule carries an enforcement tag: *lint* (Biome
catches it) · *gate* (`bun run typecheck` catches it) · *CI* (a job catches it) · *review*
(nothing catches it — it rots without discipline).

Provenance labels mark which rules are choices: *[STANDARD]* canonical for the ecosystem ·
*[COMMON]* widespread, alternatives exist · *[OURS]* a house preference, justified on its own
terms.

**Where Biome settles something, the config is the rule and this file says nothing.** Quotes,
semicolons, trailing commas, import order, line width and indentation are all in `biome.json`.
This file being short is not it missing rules; it is correctly scoped.

---

## F1 — Files are kebab-case, named for what they contain

*lint* · **[COMMON]**

One concept per file. A file named for a layer (`utils.ts`, `helpers.ts`) becomes a drawer, and
a drawer is where code goes to stop being found.

```
// right: src/lib/write-plan.ts        — the write plan lives here and nothing else does
// wrong: src/lib/utils.ts             — a drawer
```

## E1 — Named exports, as `export function` declarations

*lint* · **[COMMON]**

No default exports anywhere: nothing here is a framework entry point that needs one. Anything
exported is a `function` declaration rather than a `const` arrow, so it hoists, names itself in
a stack trace, and is greppable by one spelling.

```ts
// right: export function expandHome(input: string): string { … }
// wrong: export default (input: string) => { … }
```

## E2 — Types are imported with `import type`

*lint, autofixable* · **[STANDARD]** — it is what `verbatimModuleSyntax` requires.

```ts
// right: import type { PlannedFile } from '../lib/types.ts';
// wrong: import { PlannedFile } from '../lib/types.ts';
```

## I1 — No parent-relative imports beyond one level

*review* · **[OURS]**

`./sibling` and `../lib/x` are fine; a second `../` is not. This tree is four directories deep
at most, so anything needing two is reaching across a boundary that should be a function call.

```ts
// right: import { stampLine } from '../lib/stamp.ts';
// wrong: import { stampLine } from '../../src/lib/stamp.ts';
```

## T1 — No `any`, and no escape hatch at a boundary

*gate* · **[OURS]**

`strict` plus `noUncheckedIndexedAccess` in `tsconfig.json`, and `noExplicitAny` as an error in
Biome. Where a value genuinely is unknown — parsed JSON, a merge — type it `unknown` and narrow
it with a predicate.

```ts
// right: function isRecord(value: unknown): value is Record<string, unknown> { … }
// wrong: function mergeValues(base: any, next: any): any { … }
```

## T2 — String-literal unions, never `enum`

*review* · **[OURS]**

An `enum` is a runtime value pretending to be a type, with different semantics from every other
type-level construct here. No `enum` declaration exists in `src/` as of 2026-09-15 —
`grep -rnE '^\s*(export )?enum ' src/` returns nothing. Keep it that way.

```ts
// right: export type Phase = 'you' | 'discover' | 'practices' | 'render';
// wrong: export enum Phase { You, Discover, Practices, Render }
```

## L1 — Functions are roughly 6–15 lines; extract for a concept

*review* · **[OURS]**

A function that fits on a screen is reviewed at a glance and tested alone. Extract because the
extracted thing has a name — `mergeArrays`, `appendMissingLines`, `stampAfterFrontmatter` — not
to move lines somewhere else. Biome's `noExcessiveCognitiveComplexity` is the backstop at 12,
not the target.

```ts
// right: applyStrategy() dispatches; mergeJson(), appendMissingLines() each do one thing
// wrong: one resolveOne() with three inlined strategy branches
```

## L2 — Pure logic in `src/lib`, prompts in `src/questions`, writers in `src/render`

*review* · **[OURS]**

The part worth testing must not be the part that talks to a terminal or a disk. This is why
`renderAll()` returns `PlannedFile[]` and writes nothing: every renderer is testable by calling
it and reading the return value.

```ts
// right: export function renderGlobalRules(ctx): PlannedFile[]   // returns, never writes
// wrong: export async function renderGlobalRules(ctx) { await Bun.write(…) }
```

## L3 — Console output lives only in `src/lib/ui.ts`, `src/cli.ts` and `src/doctor/index.ts`

*lint* · **[OURS]**

`noConsole` is an error everywhere else, with those three in a Biome override. A module that
prints cannot be tested without capturing stdout, and a module that returns a string can.

```ts
// right: return previewTree(changes);          // caller decides whether to print
// wrong: console.log(previewTree(changes));    // inside a renderer
```

## C1 — Comments say why, never what

*review* · **[OURS]**

A comment restating the line below it is banned — rename or extract instead. A comment recording
*why* is **required** where the reason is not derivable from the code, and most of this repo's
reasons are not: they are properties of Bun, of git, or of the harness.

**Never bulk-delete comments**, and never strip one in a protected category: a decision's
rationale, a lint-suppression justification, or an external-constraint workaround.

```ts
// right: // `--only` silently drops untracked paths, and the commit still typechecks.
// wrong: // split the string on newlines
```

## X1 — Every doctor rule has a fixture that violates it and one that passes

*CI* · **[OURS]**

A rule with only a passing fixture is a rule that has never been observed to fire. Tests go in a
new file named for the area rather than appended to an existing suite, so two sessions do not
collide in one file.

```ts
// right: test('flags a duplicate step number', …) and test('passes on a contiguous log', …)
// wrong: one test asserting the clean case only
```

## X2 — A test never writes outside a temp directory

*CI* · **[OURS]**

`src/lib/paths.ts` reads `$HOME` itself rather than `os.homedir()`, which Bun snapshots at
startup; `tests/preload.ts` redirects it. A test that reaches the real `~/.claude` has already
done the damage by the time it fails — this was a live bug on 2026-09-15, caught only by
checking the real directory afterwards.

```ts
// right: const dir = await tempDir(); try { … } finally { await cleanup(dir); }
// wrong: await commitPlan(plan);   // with no HOME redirection in scope
```

## S1 — No personal strings in `src/`, `templates/` or `standard/`

*CI* · **[OURS]**

A name, a home-directory path, or a machine-specific tool in the engine makes the tool one
person's rather than anyone's. Those belong in `profiles/*.json`, or in `docs/choices/*.md`
labelled as a worked example. A test greps for it.

```ts
// right: archiveHome: '~/Projects/archive/<repo>'   // in profiles/zach.json
// wrong: const ARCHIVE = '~/Projects/archive';      // in src/lib/paths.ts
```
