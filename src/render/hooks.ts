import { join } from 'node:path';
import { claudeHooksDir, claudeSettingsFile, contractHome } from '../lib/paths.ts';
import { template } from '../lib/template.ts';
import type { PlannedFile } from '../lib/types.ts';
import { answer, planned, type RenderContext } from './context.ts';

/** Which of the three hook scripts a run installs. */
type HookSet = { guard: boolean; banner: boolean; gate: boolean };

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
  if (!want.guard && !want.banner && !want.gate && style === null) return [];

  const files: PlannedFile[] = [];
  if (want.guard)
    files.push(await scriptFile(ctx, 'commit-guard.sh', 'hook — blocks git commit/push'));
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
 * `hooks: none` is still none, on both tracks. The option's own text promises that nothing is
 * added to `settings.json`, and a gate installed over that promise would make the question a
 * lie and its long form's undo instructions wrong.
 */
function wantedHooks(ctx: RenderContext): HookSet {
  const choice = answer(ctx, 'hooks', 'none');
  if (choice === 'none') return { guard: false, banner: false, gate: false };
  if (answer(ctx, 'configWeight', 'full') === 'light')
    return { guard: false, banner: false, gate: true };
  return {
    guard: choice === 'commit-guard' || choice === 'both',
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
 * `bash <path>`, quoted, rather than the bare path the other two entries use. Nothing here
 * chmods what it writes — `writeText` creates a 0644 file — so a hook invoked by path alone is
 * a permission error the harness reports as a failed hook rather than a block. The other two
 * entries are left exactly as they are: changing them is a behaviour change to an installed
 * setup, and it belongs to whoever fixes the missing executable bit at the source.
 */
function gateCommand(): string {
  return `bash "${join(claudeHooksDir(), 'completion-gate.sh')}"`;
}

function settingsMerge(ctx: RenderContext, want: HookSet, style: string | null): PlannedFile {
  const hooks: Record<string, unknown[]> = {};
  if (want.guard) {
    hooks.PreToolUse = [
      {
        matcher: 'Bash',
        hooks: [{ type: 'command', command: `${join(claudeHooksDir(), 'commit-guard.sh')}` }],
      },
    ];
  }
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
    banner: plannedPaths.includes(join(claudeHooksDir(), 'session-banner.sh')),
    gate: plannedPaths.includes(join(claudeHooksDir(), 'completion-gate.sh')),
  };
  if (!want.guard && !want.banner && !want.gate) return null;
  return [
    `\nHooks were in that plan, so ${contractHome(claudeSettingsFile())} is untouched. This is what`,
    'a run would merge into it, if you would rather add it by hand:',
    '',
    hookSnippet(want),
    '',
    `Its scripts are written to ${contractHome(claudeHooksDir())} when you accept a run.`,
  ].join('\n');
}

function hookSnippet(want: HookSet): string {
  const parts: string[] = [];
  if (want.guard) {
    parts.push(
      `  "PreToolUse": [\n    { "matcher": "Bash", "hooks": [{ "type": "command", "command": "${join(claudeHooksDir(), 'commit-guard.sh')}" }] }\n  ]`,
    );
  }
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
