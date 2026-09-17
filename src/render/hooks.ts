import { join } from 'node:path';
import { readText } from '../lib/disk.ts';
import { claudeDir, claudeSettingsFile, repoRoot } from '../lib/paths.ts';
import { template } from '../lib/template.ts';
import type { PlannedFile } from '../lib/types.ts';
import { answer, planned, type RenderContext } from './context.ts';

const HOOKS_DIR = join(claudeDir(), 'hooks', 'personal-config');

/**
 * Hooks reach `settings.json` by JSON merge, never a blind overwrite — the file usually holds
 * the user's own hooks, and losing them is a far worse outcome than not installing ours. The
 * merge is previewed and confirmed like every other write, and backed up before it lands.
 */
export async function renderHooks(ctx: RenderContext): Promise<PlannedFile[]> {
  const choice = answer(ctx, 'hooks', 'none');
  if (choice === 'none') return [];

  const wantsGuard = choice === 'commit-guard' || choice === 'both';
  const wantsBanner = choice === 'banner' || choice === 'both';

  const files: PlannedFile[] = [];
  if (wantsGuard)
    files.push(await scriptFile(ctx, 'commit-guard.sh', 'hook — blocks git commit/push'));
  if (wantsBanner)
    files.push(await scriptFile(ctx, 'session-banner.sh', 'hook — session start banner'));
  files.push(settingsMerge(ctx, { guard: wantsGuard, banner: wantsBanner }));
  return files;
}

async function scriptFile(
  ctx: RenderContext,
  name: string,
  label: string,
): Promise<PlannedFile> {
  const source = await readText(join(repoRoot(), 'templates', 'hooks', name));
  return planned(ctx, join(HOOKS_DIR, name), label, source, { extension: 'sh' });
}

function settingsMerge(
  ctx: RenderContext,
  want: { guard: boolean; banner: boolean },
): PlannedFile {
  const hooks: Record<string, unknown[]> = {};
  if (want.guard) {
    hooks.PreToolUse = [
      {
        matcher: 'Bash',
        hooks: [{ type: 'command', command: `${join(HOOKS_DIR, 'commit-guard.sh')}` }],
      },
    ];
  }
  if (want.banner) {
    hooks.SessionStart = [
      {
        matcher: 'startup|resume',
        hooks: [
          { type: 'command', command: `${join(HOOKS_DIR, 'session-banner.sh')}`, timeout: 5 },
        ],
      },
    ];
  }

  return planned(
    ctx,
    claudeSettingsFile(),
    'settings.json — hook entries merged in',
    `${JSON.stringify({ hooks }, null, 2)}\n`,
    {
      strategy: 'merge-json',
      stamp: false,
    },
  );
}

/** Printed instead of merged when the user declines the settings write. */
export function hookSnippet(want: { guard: boolean; banner: boolean }): string {
  const parts: string[] = [];
  if (want.guard) {
    parts.push(
      `  "PreToolUse": [\n    { "matcher": "Bash", "hooks": [{ "type": "command", "command": "${join(HOOKS_DIR, 'commit-guard.sh')}" }] }\n  ]`,
    );
  }
  if (want.banner) {
    parts.push(
      `  "SessionStart": [\n    { "matcher": "startup|resume", "hooks": [{ "type": "command", "command": "${join(HOOKS_DIR, 'session-banner.sh')}", "timeout": 5 }] }\n  ]`,
    );
  }
  return `"hooks": {\n${parts.join(',\n')}\n}`;
}

export async function hookScriptSource(name: string): Promise<string> {
  return template(join('hooks', name));
}
