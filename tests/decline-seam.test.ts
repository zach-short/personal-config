import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { finish } from '../src/commands/setup.ts';
import { parseCli } from '../src/lib/args.ts';
import { cancelMessage } from '../src/lib/ask.ts';
import { claudeDir } from '../src/lib/paths.ts';
import type { PlannedChange } from '../src/lib/write-plan.ts';
import { declinedHookHelp } from '../src/render/hooks.ts';
import { cleanup, recordingPrompter, tempDir, withTty } from './helpers.ts';

const HOOKS_DIR = join(claudeDir(), 'hooks', 'personal-config');
const GUARD = join(HOOKS_DIR, 'commit-guard.sh');

/** A new file, which is what a first run plans: nothing on disk, and something to write. */
function newFile(path: string, contents: string): PlannedChange {
  return {
    file: { path, contents, label: 'a planned file', strategy: 'overwrite' },
    before: '',
    after: contents,
    summary: '+1 -0',
    guard: 'none',
  };
}

/**
 * `finish` reports through `say`, which is `console.log`, so catching the lines is the only way
 * to read what a declined run told the person — and what it said is half the contract. The other
 * half is that no file appeared, which is the assertion that actually protects someone's repo.
 */
async function captured(run: () => Promise<number>): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    return { code: await run(), out: lines.join('\n') };
  } finally {
    console.log = original;
  }
}

/**
 * The real decline path, driven end to end through `finish` rather than stood in for. The plan
 * holds one file in a throwaway directory and one hook script, because the decline owes the
 * person two things: nothing written, and the hook snippet it did not merge.
 *
 * The hook path is the real `~/.claude` one — under `tests/preload.ts`'s sandbox `$HOME` — since
 * `declinedHookHelp` matches on exactly that spelling. Nothing else in the suite plans a hook
 * (`DEFAULT_ANSWERS` answers `hooks: 'none'`), so the `rm` in each `finally` clears up only what
 * these tests could have caused: on a green run there is nothing there to remove.
 */
describe('the decline path, through the seam that makes it drivable', () => {
  test('a no at the confirm writes nothing, and says what it did not write', async () => {
    const dir = await tempDir('pc-decline-seam-');
    const doc = join(dir, 'AGENTS.md');
    const plan = [newFile(doc, 'generated\n'), newFile(GUARD, '#!/bin/sh\n')];
    try {
      const { prompter, asked } = recordingPrompter([false, false]);
      const { code, out } = await captured(() =>
        withTty(true, () => finish(parseCli(['setup']), plan, prompter)),
      );
      const help = declinedHookHelp(plan.map((c) => c.file.path)) ?? '';

      expect(code).toBe(0);
      expect(asked.map((a) => a.message)).toEqual([
        'Show the per-file diff first?',
        'Write these 2 file(s)?',
      ]);
      expect(out).toContain('This run would write:');
      expect(out).toContain(cancelMessage());
      expect(help).not.toBe('');
      expect(out).toContain(help);
      // The guarantee. `commitPlan` is not reached, so neither path exists afterwards.
      expect(existsSync(doc)).toBe(false);
      expect(existsSync(GUARD)).toBe(false);
    } finally {
      await cleanup(dir);
      await rm(HOOKS_DIR, { recursive: true, force: true });
    }
  });

  /**
   * Without this the assertion above is satisfied by a plan that could never have written
   * anything, and "nothing was written" would be true of a decline and of a bug alike.
   */
  test('yes at the same confirm writes both — so the decline is a refusal, not an empty plan', async () => {
    const dir = await tempDir('pc-decline-seam-');
    const doc = join(dir, 'AGENTS.md');
    const plan = [newFile(doc, 'generated\n'), newFile(GUARD, '#!/bin/sh\n')];
    try {
      const { prompter } = recordingPrompter([false, true]);
      const { code, out } = await captured(() =>
        withTty(true, () => finish(parseCli(['setup']), plan, prompter)),
      );

      expect(code).toBe(0);
      expect(out).toContain('Wrote 2 file(s).');
      expect(out).not.toContain(cancelMessage());
      expect(existsSync(doc)).toBe(true);
      expect(existsSync(GUARD)).toBe(true);
    } finally {
      await cleanup(dir);
      await rm(HOOKS_DIR, { recursive: true, force: true });
    }
  });

  /**
   * The half of `confirmBatch`'s contract that calling it directly cannot pin: that `finish`
   * calls it *unconditionally*. `interactive` is `isTTY && !cli.yes`, so under `--yes` in a
   * terminal the old gate skipped the confirm and wrote — the 2026-09-17 finding. Put an
   * `interactive &&` back in front of that call and this is what fails: nothing is asked, the
   * batch is written, and the file appears. A `finish` that took `interactive` as a parameter
   * again would not compile against this call, which fails the same way for the same reason.
   */
  test('--yes reaches the confirm, so a no there still declines and still writes nothing', async () => {
    const dir = await tempDir('pc-decline-seam-');
    const doc = join(dir, 'AGENTS.md');
    const plan = [newFile(doc, 'generated\n')];
    try {
      const { prompter, asked } = recordingPrompter([false, false]);
      const { code, out } = await captured(() =>
        withTty(true, () => finish(parseCli(['setup', '--yes']), plan, prompter)),
      );

      expect(code).toBe(0);
      expect(asked).toHaveLength(2);
      expect(out).toContain(cancelMessage());
      expect(out).not.toContain('Wrote 1 file(s).');
      expect(existsSync(doc)).toBe(false);
    } finally {
      await cleanup(dir);
    }
  });
});
