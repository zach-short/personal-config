import { join } from 'node:path';
import { claudeHooksDir, claudeSettingsFile, contractHome } from '../lib/paths.ts';
import { template } from '../lib/template.ts';
import type { PlannedFile } from '../lib/types.ts';
import { answer, planned, type RenderContext, trackOf } from './context.ts';

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
  if (!want.guard && !want.deleteGuard && !want.banner && !want.gate && style === null)
    return [];

  const files: PlannedFile[] = [];
  if (want.guard)
    files.push(await scriptFile(ctx, 'commit-guard.sh', 'hook — blocks git commit/push'));
  if (want.deleteGuard)
    files.push(await scriptFile(ctx, 'delete-guard.sh', 'hook — blocks rm/rmdir/unlink'));
  if (want.banner)
    files.push(await scriptFile(ctx, 'session-banner.sh', 'hook — session start banner'));
  if (want.gate)
    files.push(await scriptFile(ctx, 'completion-gate.sh', 'hook — completion gate on Stop'));
  files.push(settingsMerge(ctx, want, style));
  return files;
}

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
    guard: wantsGuard && trackOf(ctx).usesGit,
    deleteGuard,
    banner: choice === 'banner' || choice === 'both',
    gate: true,
  };
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

async function scriptFile(
  ctx: RenderContext,
  name: string,
  label: string,
): Promise<PlannedFile> {
  // `template()` rather than a bare read: a missing file names itself, where `readText` would
  // surface a raw ENOENT and a long absolute path through the CLI's error line.
  const source = await template(join('hooks', name));
  return planned(ctx, join(claudeHooksDir(), name), label, source, { extension: 'sh' });
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

function settingsMerge(ctx: RenderContext, want: HookSet, style: string | null): PlannedFile {
  const hooks: Record<string, unknown[]> = {};
  const guards: Record<string, unknown>[] = [];
  if (want.guard) guards.push(bashGuardEntry('commit-guard.sh'));
  if (want.deleteGuard) guards.push(bashGuardEntry('delete-guard.sh'));
  if (guards.length > 0) hooks.PreToolUse = guards;
  if (want.banner) {
    hooks.SessionStart = [
      {
        matcher: 'startup|resume',
        hooks: [
          {
            type: 'command',
            command: `${join(claudeHooksDir(), 'session-banner.sh')}`,
            timeout: 5,
          },
        ],
      },
    ];
  }
  if (want.gate) {
    // No matcher: `Stop` has no tool or source to match on. The timeout is generous because the
    // entry runs the repo's own gate command, and a hook killed at the timeout does not block —
    // a suite slower than this is a gate that quietly never fires.
    hooks.Stop = [{ hooks: [{ type: 'command', command: gateCommand(), timeout: 120 }] }];
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
 * What a declined run prints when hooks were in the plan. `docs/choices/hooks.md` offers exactly
 * this as the answer to the risk it names — that the merge edits a `settings.json` you already
 * have hooks in — so declining has to hand over what it would have added rather than only
 * stopping. The confirm is for the whole batch, so the scripts are unwritten too: the snippet is
 * therefore shown as what a run *would* merge, never as something already live.
 *
 * The output style is not in here, and cannot be: this reads the plan's *paths*, and a style is
 * a key with no file of its own. A declined run leaves it unwritten like everything else.
 */
export function declinedHookHelp(plannedPaths: string[]): string | null {
  const want = {
    guard: plannedPaths.includes(join(claudeHooksDir(), 'commit-guard.sh')),
    deleteGuard: plannedPaths.includes(join(claudeHooksDir(), 'delete-guard.sh')),
    banner: plannedPaths.includes(join(claudeHooksDir(), 'session-banner.sh')),
    gate: plannedPaths.includes(join(claudeHooksDir(), 'completion-gate.sh')),
  };
  if (!want.guard && !want.deleteGuard && !want.banner && !want.gate) return null;
  return [
    `\nHooks were in that plan, so ${contractHome(claudeSettingsFile())} is untouched. This is what`,
    'a run would merge into it, if you would rather add it by hand:',
    '',
    hookSnippet(want),
    '',
    `Its scripts are written to ${contractHome(claudeHooksDir())} when you accept a run.`,
  ].join('\n');
}

/** One `PreToolUse` line per guard, in the shape `settingsMerge` writes them. */
function guardLine(script: string): string {
  return `    { "matcher": "Bash", "hooks": [{ "type": "command", "command": "${join(claudeHooksDir(), script)}" }] }`;
}

function hookSnippet(want: HookSet): string {
  const parts: string[] = [];
  const guards: string[] = [];
  if (want.guard) guards.push(guardLine('commit-guard.sh'));
  if (want.deleteGuard) guards.push(guardLine('delete-guard.sh'));
  if (guards.length > 0) parts.push(`  "PreToolUse": [\n${guards.join(',\n')}\n  ]`);
  if (want.banner) {
    parts.push(
      `  "SessionStart": [\n    { "matcher": "startup|resume", "hooks": [{ "type": "command", "command": "${join(claudeHooksDir(), 'session-banner.sh')}", "timeout": 5 }] }\n  ]`,
    );
  }
  if (want.gate) {
    parts.push(
      `  "Stop": [\n    { "hooks": [{ "type": "command", "command": ${JSON.stringify(gateCommand())}, "timeout": 120 }] }\n  ]`,
    );
  }
  return `"hooks": {\n${parts.join(',\n')}\n}`;
}
