import { dirname, join } from 'node:path';
import { exists, readText } from '../lib/disk.ts';
import { claudeHooksDir, claudeSettingsFile, contractHome } from '../lib/paths.ts';
import { template } from '../lib/template.ts';
import type { GlobalFile, PlannedFile, Prune } from '../lib/types.ts';
import { sameJson } from '../lib/write-plan.ts';
import { answer, planned, type RenderContext, trackOf } from './context.ts';
import { wantsWriteDocHook, writeDocCheckFile, writeDocCheckScript } from './write-doc.ts';

/**
 * Which of the four hook scripts a run installs. `guard` is the *commit* guard, keyed on git;
 * `deleteGuard` is its analogue for work that is not in a repository, keyed on work kind (D25).
 * They are separate booleans and not one three-valued key because a person can want both.
 */
type HookSet = { guard: boolean; deleteGuard: boolean; banner: boolean; gate: boolean };

/**
 * This module owns `~/.claude/settings.json`: the hook entries and the output style both land
 * there, and they go through one merge rather than two so nothing can write the file twice in
 * a single plan and have the second write win.
 *
 * Hooks reach `settings.json` by JSON merge, never a blind overwrite — the file usually holds
 * the user's own hooks, and losing them is a far worse outcome than not installing ours. The
 * merge is previewed and confirmed like every other write, and backed up before it lands.
 */
export async function renderHooks(ctx: RenderContext): Promise<PlannedFile[]> {
  const want = wantedHooks(ctx);
  const style = outputStyleFor(ctx);
  // Its script lives in the `/write-doc` folder, not in the hooks folder, so it is not one of the
  // four in `HookSet`; it is planned by `renderWriteDoc` and only its entry is merged here.
  const docCheck = wantsWriteDocHook(ctx);
  const nothing = !want.guard && !want.deleteGuard && !want.banner && !want.gate;
  if (nothing && style === null && !docCheck) return [];

  const files: PlannedFile[] = [];
  if (want.guard) {
    files.push(await scriptFile(ctx, 'commit-guard.sh'));
    files.push(commitPolicyFile(ctx));
  }
  if (want.deleteGuard) files.push(await scriptFile(ctx, 'delete-guard.sh'));
  if (want.banner) files.push(await scriptFile(ctx, 'session-banner.sh'));
  if (want.gate) files.push(await scriptFile(ctx, 'completion-gate.sh'));
  files.push(settingsMerge(ctx, want, style, docCheck));
  return files;
}

/** The preview label of each script in the hooks folder, one place for the render and the removal. */
const SCRIPT_LABELS: Record<string, string> = {
  'commit-guard.sh': 'hook — blocks git commit/push',
  'delete-guard.sh': 'hook — blocks rm/rmdir/unlink',
  'session-banner.sh': 'hook — session start banner',
  'completion-gate.sh': 'hook — completion gate on Stop',
};

const COMMIT_POLICY_LABEL = 'hook — commit policy';

/**
 * The completion gate is written on **every track** (setup-tracks `DESIGN.md` D16), which
 * partially supersedes D6: light writes no *commit-guard* hook — that one is git-specific and
 * D4 made git a question — but it does write this one. D6's cut was justified by context
 * budget, and a `command` hook is a shell script that spends zero tokens, so the argument that
 * carried the cut does not reach it.
 *
 * **D16's reason for cutting the guard from light is git, not weight, so it governs `usesGit`
 * too** (board row 55, reproduced 2026-09-22). This gate used to read weight alone, so a person
 * who answered "I keep no work in git" and then took the `hooks` question's *recommended*
 * answer — because it is the recommendation — had a `PreToolUse` hook installed over a tool they
 * do not use. That was the one place a track answer was contradicted by what the run wrote
 * rather than merely ignored.
 *
 * Read as `!== 'no'` through `trackOf`, not `=== 'yes'`: a profile stored before the git
 * question existed has no answer and must keep rendering what it rendered at 0.2.5 (DIAL-7),
 * and row 58's coming third `usesGit` answer must read as "not no" rather than silently
 * suppressing the guard. It is the person's answer and not `targetUsesGit()` because these
 * scripts land in `~/.claude/`, where there is no target whose `kind` could be consulted.
 *
 * **What goes in the guard's place is the delete guard** (D25, ratified 2026-09-22), which the
 * comment here used to leave open for row 58. A repo's irreversible step is a commit; a folder's
 * is a delete, and it has no checkout to be taken back out of.
 *
 * It is keyed on **work kind, not on git**, and that asymmetry with the line above is the whole
 * decision. This file writes the *global* `settings.json` (see the module header), so the set of
 * guards has to be right for every session the person runs, not for one target: a non-coder who
 * also keeps repos needs the delete guard in the folder and the commit guard in the repo, and
 * both are theirs. Keyed on `usesGit: no` it would be taken away from exactly that person.
 *
 * It is written on **both weights**, which is the partial supersession of D16. D16's reason for
 * cutting the *commit* guard from light is that it is git-specific, and that reason does not
 * reach a guard that is not; D16's own argument for the completion gate — a `command` hook is a
 * shell script that spends zero tokens — carries this one unchanged. D16's commit-guard half is
 * untouched: light still writes no commit guard.
 *
 * `hooks: none` is still none, on every track. The option's own text promises that nothing is
 * added to `settings.json`, and a gate installed over that promise would make the question a
 * lie and its long form's undo instructions wrong.
 */
function wantedHooks(ctx: RenderContext): HookSet {
  const choice = answer(ctx, 'hooks', 'none');
  if (choice === 'none')
    return { guard: false, deleteGuard: false, banner: false, gate: false };
  const wantsGuard = choice === 'commit-guard' || choice === 'both';
  const deleteGuard = wantsGuard && trackOf(ctx).workKind === 'non-code';
  if (answer(ctx, 'configWeight', 'full') === 'light')
    return { guard: false, deleteGuard, banner: false, gate: true };
  return {
    guard: wantsGuard && trackOf(ctx).usesGit && !agentPushes(ctx),
    deleteGuard,
    banner: choice === 'banner' || choice === 'both',
    gate: true,
  };
}

/**
 * `agent-pushes` writes no commit guard, whatever the `hooks` answer (the owner's answer of
 * 2026-10-16). The guard also blocks `git stash`, `git restore` and `git reset --hard` under every
 * policy, and keeping it for those alone was the recommendation; the owner chose no guard at all.
 * A re-run then prunes an installed guard, its `commit-policy` file and its `settings.json` entry
 * (`hookLeftovers`), so the answer takes effect on machines that already have one. The delete
 * guard is not a commit guard and is not touched.
 */
function agentPushes(ctx: RenderContext): boolean {
  return answer(ctx, 'commitPolicy', 'print-blocks') === 'agent-pushes';
}

/**
 * `check-first` writes **nothing** rather than a second style name (D17/D19). An absent
 * `outputStyle` is the documented default, so writing one for the recommended answer would
 * change behaviour for everyone who re-runs the wizard and answers the way they already had —
 * and there is no documented style name that means "ask first" to invent for it.
 */
function outputStyleFor(ctx: RenderContext): string | null {
  return answer(ctx, 'outputStyle', 'check-first') === 'proactive' ? 'Proactive' : null;
}

async function scriptFile(ctx: RenderContext, name: string): Promise<PlannedFile> {
  // `template()` rather than a bare read: a missing file names itself, where `readText` would
  // surface a raw ENOENT and a long absolute path through the CLI's error line.
  const source = await template(join('hooks', name));
  const label = SCRIPT_LABELS[name] ?? `hook — ${name}`;
  return planned(ctx, join(claudeHooksDir(), name), label, source, { extension: 'sh' });
}

/**
 * The three answers the guard knows. Anything else is written as the safest of them. The fourth
 * answer, `agent-pushes`, never reaches here: it writes no guard (`agentPushes`).
 */
const COMMIT_POLICIES = ['print-blocks', 'agent-commits', 'no-rule'];

/**
 * The commit policy, one word, in a file beside the commit guard (board row 78, option A, the owner's
 * answer of 2026-10-04). The guard reads it on every call, so the guard and `~/.claude/rules/commits.md`
 * say the same thing: under `agent-commits` a commit that names its files passes.
 *
 * A file and not an argument in the `settings.json` command, because the merge never replaces an
 * entry (`gateCommand` below): a changed command string would sit beside the old one, and every
 * existing install would run the guard twice. A re-run rewrites this file and the script, and
 * leaves the settings entry as it was.
 *
 * It carries a stamp like every planned file, as a `#` comment on line 1, so a re-run may
 * overwrite it and `undo` can restore it. The guard skips every line that starts with `#`, and
 * reads a missing file, an unreadable one or an unknown word as `print-blocks`.
 */
function commitPolicyFile(ctx: RenderContext): PlannedFile {
  const answered = answer(ctx, 'commitPolicy', 'print-blocks');
  const policy = COMMIT_POLICIES.includes(answered) ? answered : 'print-blocks';
  const body = [
    '# Read by commit-guard.sh, beside this file. One word: print-blocks, agent-commits or no-rule.',
    '# A missing file, or any other word, is read as print-blocks.',
    policy,
    '',
  ].join('\n');
  return planned(ctx, commitPolicyPath(), COMMIT_POLICY_LABEL, body, { extension: 'conf' });
}

function commitPolicyPath(): string {
  return join(claudeHooksDir(), 'commit-policy');
}

/**
 * `bash <path>`, quoted, rather than the bare path the other two entries use.
 *
 * It was written this way to dodge a real bug — `writeText` created every file 0644, so a hook
 * invoked by path alone was a permission error the harness reported as a failed hook rather
 * than a block. **That bug is fixed at the source**: a planned `.sh` carries `0o755` and a
 * re-run repairs the bit on scripts installed before it did (`planned()` in `render/context.ts`,
 * `pendingMode` in `lib/write-plan.ts`). So this form is no longer load-bearing.
 *
 * It stays anyway, and normalising it would be the worse change. `settings.json` is merged, and
 * `mergeArrays` de-duplicates by exact JSON: a changed command string is a *new* entry beside
 * the old one, not a replacement. Measured 2026-09-18 — merging a bare-path `Stop` entry into a
 * settings file holding this one leaves **two**, and the gate then runs twice on every Stop for
 * everyone who already ran `setup`. The cost of keeping it is one inconsistent-looking line;
 * the cost of fixing it is a duplicated hook in installs nobody can reach to clean up.
 *
 * The one thing that must not change is the string itself. Whatever this returns has to keep
 * matching what previous versions wrote, byte for byte, or a re-run doubles the entry —
 * `tests/hooks.test.ts` pins that a re-merge adds nothing.
 */
function gateCommand(): string {
  return `bash "${join(claudeHooksDir(), 'completion-gate.sh')}"`;
}

/**
 * One entry per guard, both matching `Bash`, rather than one entry carrying two commands.
 * `mergeArrays` de-duplicates by exact JSON, so entries that stand beside each other are matched
 * and skipped one at a time: a person who already has the commit guard installed and gains the
 * delete guard on a re-run acquires the new entry alone. Folded into a single entry's `hooks`
 * array, the pair would be one value that differs from the installed one, and the merge would
 * leave both — the commit guard firing twice on every Bash call.
 */
function bashGuardEntry(script: string): Record<string, unknown> {
  return {
    matcher: 'Bash',
    hooks: [{ type: 'command', command: `${join(claudeHooksDir(), script)}` }],
  };
}

/**
 * The entry `write-doc-check: every` adds (write-doc-ste D7): `check.sh hook` on every `Write` and
 * `Edit`. The command is the script's absolute path and the word `hook`, unquoted, the form the
 * guards' entries take (`PLAN.md` BD-6). Like every string in this file, it is fixed once a
 * release carries it: the merge de-duplicates by exact JSON, so a changed spelling would sit
 * beside the old entry and check every save twice (see `gateCommand`). No timeout, as the guards
 * have none: the script reads one payload and one file.
 */
function writeDocCheckEntry(): Record<string, unknown> {
  return {
    matcher: 'Write|Edit',
    hooks: [{ type: 'command', command: `${writeDocCheckScript()} hook` }],
  };
}

/** The five entries, by the name `settingsMerge` and the prune both use. */
type HookName =
  | 'commit-guard'
  | 'delete-guard'
  | 'write-doc-check'
  | 'session-banner'
  | 'completion-gate';

/**
 * One entry this tool can merge into `settings.json`, with the scripts its command runs.
 * `companions` are the files that go when the script goes: the commit policy beside the guard.
 */
export type HookEntry = {
  name: HookName;
  event: string;
  entry: Record<string, unknown>;
  scripts: HookScript[];
};

export type HookScript = GlobalFile & { companions: GlobalFile[] };

/**
 * Every entry this tool writes, in the order `settingsMerge` has always emitted them
 * (setup-hook-leftovers BD-2). The merge filters this list and the prune matches against it, so
 * the string one writes and the string the other looks for are the same value: two lists would
 * drift the first time an entry changed, and the prune would stop finding the entry it must take
 * out. `tests/hooks.test.ts` pins that the merge's bytes did not move.
 */
export function hookEntries(): HookEntry[] {
  return [
    {
      name: 'commit-guard',
      event: 'PreToolUse',
      entry: bashGuardEntry('commit-guard.sh'),
      scripts: [
        hookScript('commit-guard.sh', [
          { path: commitPolicyPath(), label: COMMIT_POLICY_LABEL },
        ]),
      ],
    },
    {
      name: 'delete-guard',
      event: 'PreToolUse',
      entry: bashGuardEntry('delete-guard.sh'),
      scripts: [hookScript('delete-guard.sh')],
    },
    {
      name: 'write-doc-check',
      event: 'PostToolUse',
      entry: writeDocCheckEntry(),
      scripts: [{ ...writeDocCheckFile(), companions: [] }],
    },
    {
      name: 'session-banner',
      event: 'SessionStart',
      entry: {
        matcher: 'startup|resume',
        hooks: [
          {
            type: 'command',
            command: `${join(claudeHooksDir(), 'session-banner.sh')}`,
            timeout: 5,
          },
        ],
      },
      scripts: [hookScript('session-banner.sh')],
    },
    {
      // No matcher: `Stop` has no tool or source to match on. The timeout is generous because the
      // entry runs the repo's own gate command, and a hook killed at the timeout does not block —
      // a suite slower than this is a gate that quietly never fires.
      name: 'completion-gate',
      event: 'Stop',
      entry: { hooks: [{ type: 'command', command: gateCommand(), timeout: 120 }] },
      scripts: [hookScript('completion-gate.sh')],
    },
  ];
}

function hookScript(name: string, companions: GlobalFile[] = []): HookScript {
  return { path: join(claudeHooksDir(), name), label: SCRIPT_LABELS[name] ?? name, companions };
}

/** Every script an entry runs, each once: the candidates a run may remove (BD-6). */
export function hookScriptFiles(): HookScript[] {
  return hookEntries().flatMap((entry) => entry.scripts);
}

function settingsMerge(
  ctx: RenderContext,
  want: HookSet,
  style: string | null,
  docCheck: boolean,
): PlannedFile {
  const wanted: Record<HookName, boolean> = {
    'commit-guard': want.guard,
    'delete-guard': want.deleteGuard,
    'write-doc-check': docCheck,
    'session-banner': want.banner,
    'completion-gate': want.gate,
  };
  const hooks: Record<string, unknown[]> = {};
  for (const { name, event, entry } of hookEntries()) {
    if (!wanted[name]) continue;
    hooks[event] = [...(hooks[event] ?? []), entry];
  }

  const body: Record<string, unknown> = {};
  if (Object.keys(hooks).length > 0) body.hooks = hooks;
  if (style !== null) body.outputStyle = style;

  return planned(
    ctx,
    claudeSettingsFile(),
    settingsLabel(Object.keys(hooks).length > 0, style !== null),
    `${JSON.stringify(body, null, 2)}\n`,
    {
      strategy: 'merge-json',
      stamp: false,
    },
  );
}

function settingsLabel(hasHooks: boolean, hasStyle: boolean): string {
  if (hasHooks && hasStyle) return 'settings.json — hook entries and output style merged in';
  if (hasStyle) return 'settings.json — output style merged in';
  return 'settings.json — hook entries merged in';
}

/**
 * The label of a `settings.json` write that prunes (BD-9, GATE 2 Q3, the plain form): the count
 * goes at the end, so a person who reads only labels sees the removal. Where the run merges no
 * entry, the count names what it counts.
 */
function pruningLabel(contents: string, removed: number): string {
  const body: unknown = JSON.parse(contents);
  const hasHooks = isRecord(body) && isRecord(body.hooks) && Object.keys(body.hooks).length > 0;
  const hasStyle = isRecord(body) && body.outputStyle !== undefined;
  const entries = `${removed} hook ${removed === 1 ? 'entry' : 'entries'} removed`;
  if (hasHooks) return `${settingsLabel(true, hasStyle)}, ${removed} removed`;
  if (hasStyle) return `${settingsLabel(false, true)}, ${entries}`;
  return `settings.json — ${entries}`;
}

/**
 * The entries of this tool's catalog that are in `~/.claude/settings.json` and that no planned
 * merge in `wanted` holds (setup-hook-leftovers BD-1, BD-4). Matched by `sameJson` under the
 * entry's own event key, so an entry a person edited by one byte is theirs and stays. A missing
 * file, or one that does not parse, gives nothing to prune: the merge then reports its own parse
 * error as it always has.
 */
export async function hookLeftovers(wanted: PlannedFile[]): Promise<Prune[]> {
  const onDisk = await settingsOnDisk();
  if (onDisk === null) return [];
  const installed = isRecord(onDisk.hooks) ? onDisk.hooks : {};
  const kept = wanted.flatMap((file) => {
    const hooks = plannedHooks([file]);
    return hooks === null
      ? []
      : Object.entries(hooks).flatMap(([event, entries]) =>
          (Array.isArray(entries) ? entries : []).map((entry: unknown) => ({ event, entry })),
        );
  });
  return hookEntries()
    .filter(
      ({ event, entry }) => !kept.some((k) => k.event === event && sameJson(k.entry, entry)),
    )
    .filter(({ event, entry }) => {
      const list = installed[event];
      return Array.isArray(list) && list.some((item) => sameJson(item, entry));
    })
    .map(({ event, entry }) => ({ at: ['hooks', event], item: entry }));
}

async function settingsOnDisk(): Promise<Record<string, unknown> | null> {
  if (!(await exists(claudeSettingsFile()))) return null;
  try {
    const body: unknown = JSON.parse(await readText(claudeSettingsFile()));
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

/**
 * The `settings.json` file the plan writes once it carries `prune` (BD-3). Where a target
 * rendered the file, the prune rides on it; where none did (under "No hooks" with no output
 * style), a merge of `{}` carries it, so the plan still holds one file for the path (H13).
 */
export function withPrune(file: PlannedFile | undefined, prune: Prune[]): PlannedFile {
  const base: PlannedFile = file ?? {
    path: claudeSettingsFile(),
    contents: '{}\n',
    label: '',
    strategy: 'merge-json',
  };
  return { ...base, prune, label: pruningLabel(base.contents, prune.length) };
}

/**
 * Whether a command in this parsed `settings.json` runs `path`, in any of the spellings a person
 * might give it: absolute, under `~`, or under `$HOME`. A script that any entry still runs is
 * never removed (BD-6), so a false "runs it" keeps a file and a false "does not" breaks a hook.
 */
export function settingsRuns(settings: unknown, path: string): boolean {
  const hooks = isRecord(settings) && isRecord(settings.hooks) ? settings.hooks : {};
  const tilde = contractHome(path);
  const rest = tilde.slice(1);
  const spellings = tilde.startsWith('~')
    ? [path, tilde, `$HOME${rest}`, `\${HOME}${rest}`]
    : [path];
  return commandsIn(hooks).some((command) => spellings.some((s) => command.includes(s)));
}

/**
 * What a declined run prints when hooks were in the plan. `docs/choices/hooks.md` offers exactly
 * this as the answer to the risk it names — that the merge edits a `settings.json` you already
 * have hooks in — so declining has to hand over what it would have added rather than only
 * stopping. The confirm is for the whole batch, so the scripts are unwritten too: the snippet is
 * therefore shown as what a run *would* merge, never as something already live.
 *
 * It reads the planned merge itself, not the plan's paths (board row 76). It used to infer the
 * entries from which hook scripts were planned, and the `PostToolUse` entry `write-doc-check:
 * every` adds runs a script the plan holds under either answer, so the paths could not show it
 * and the snippet left it out. Read from the merge, an entry `settingsMerge` gains later is
 * handed over without a change here.
 *
 * The output style is not in here. The merge holds it beside `hooks`, but this hands over only
 * the `hooks` object: it is the answer to the hooks risk above, and a style-only merge prints
 * nothing, as it did when this read paths. A declined run leaves the style unwritten like
 * everything else.
 */
export function declinedHookHelp(plan: PlannedFile[]): string | null {
  const hooks = plannedHooks(plan);
  if (hooks === null) return null;
  const dirs = scriptDirs(plan, hooks);
  return [
    `\nHooks were in that plan, so ${contractHome(claudeSettingsFile())} is untouched. This is what`,
    'a run would merge into it, if you would rather add it by hand:',
    '',
    hookSnippet(hooks),
    ...(dirs.length > 0
      ? ['', `Its scripts are written to ${dirs.join(' and ')} when you accept a run.`]
      : []),
  ].join('\n');
}

/** The `hooks` object of the planned `settings.json` merge, or null where it has none. */
function plannedHooks(plan: PlannedFile[]): Record<string, unknown> | null {
  const merge = plan.find(
    (f) => f.path === claudeSettingsFile() && f.strategy === 'merge-json',
  );
  if (merge === undefined) return null;
  const body: unknown = JSON.parse(merge.contents);
  const hooks = isRecord(body) ? body.hooks : undefined;
  return isRecord(hooks) && Object.keys(hooks).length > 0 ? hooks : null;
}

/**
 * Where the scripts the entries run are written: the folder of each planned file a command names,
 * in the order the entries print. The write-doc check lives in its skill folder and not in the
 * hooks folder, so naming only the hooks folder would send a person looking in the wrong place.
 */
function scriptDirs(plan: PlannedFile[], hooks: Record<string, unknown>): string[] {
  const dirs = commandsIn(hooks).flatMap((command) =>
    plan.filter((f) => command.includes(f.path)).map((f) => contractHome(dirname(f.path))),
  );
  return [...new Set(dirs)];
}

function commandsIn(hooks: Record<string, unknown>): string[] {
  return Object.values(hooks)
    .flatMap((entries) => (Array.isArray(entries) ? entries : []))
    .flatMap((entry) => (isRecord(entry) && Array.isArray(entry.hooks) ? entry.hooks : []))
    .flatMap((hook) =>
      isRecord(hook) && typeof hook.command === 'string' ? [hook.command] : [],
    );
}

/**
 * One line per entry, under its event, in the order the merge holds them. Each entry is printed
 * by `inline` in the spacing the snippet has always had, so the four entries it printed before it
 * read the merge come out byte for byte as they did (`tests/decline-every-event.test.ts` pins it).
 */
function hookSnippet(hooks: Record<string, unknown>): string {
  const parts = Object.entries(hooks).map(([event, entries]) => {
    const lines = (Array.isArray(entries) ? entries : [entries]).map((e) => `    ${inline(e)}`);
    return `  ${JSON.stringify(event)}: [\n${lines.join(',\n')}\n  ]`;
  });
  return `"hooks": {\n${parts.join(',\n')}\n}`;
}

/**
 * `{ "key": value }` with spaces inside braces and `[…]` without. Strings go through
 * `JSON.stringify`, so a path is escaped as JSON requires. The guard lines used to interpolate it
 * raw, which is the same bytes for any path without a quote, a backslash or a control character.
 */
function inline(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (isRecord(value)) {
    const fields = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`);
    return `{ ${fields.join(', ')} }`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
