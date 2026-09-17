import { describe, expect, test } from 'bun:test';
import { confirmBatch } from '../src/commands/setup.ts';
import { parseCli } from '../src/lib/args.ts';
import type { PlannedChange } from '../src/lib/write-plan.ts';
import { recordingPrompter, withTty } from './helpers.ts';

/** Nothing here reaches the disk: the gate reads the count and the paths, never the files. */
function change(path: string): PlannedChange {
  return {
    file: { path, contents: 'after\n', label: 'a planned file', strategy: 'overwrite' },
    before: 'before\n',
    after: 'after\n',
    summary: '+1 -1',
    guard: 'none',
  };
}

const ONE = [change('/tmp/pc-confirm-gate/example.md')];

/**
 * Both halves of the 2026-09-17 finding, driven through the real gate with real argv. The flags
 * are parsed by `parseCli` rather than hand-built so the path from the flag a person types to the
 * question they are or are not asked is unbroken.
 *
 * The gap these cannot see, because every case calls the gate directly: `finish` calling
 * `confirmBatch` unconditionally is asserted by nothing here, and re-introducing an
 * `interactive &&` in front of that call would leave every test below passing. That is closed
 * in `tests/decline-seam.test.ts`, which drives `finish` itself — not here, because a case that
 * went through `finish` would no longer be a test of this gate.
 */
describe('the write confirm reads --force, and does not read --yes', () => {
  test('--force skips it: nothing is asked and the write is allowed through', async () => {
    const { prompter, asked } = recordingPrompter([]);
    const allowed = await withTty(true, () =>
      confirmBatch(parseCli(['setup', '--force']), ONE, prompter),
    );
    expect(allowed).toBe(true);
    expect(asked).toEqual([]);
  });

  test('--yes alone still confirms, which is what its own help text promises', async () => {
    const { prompter, asked } = recordingPrompter([false, true]);
    const allowed = await withTty(true, () =>
      confirmBatch(parseCli(['setup', '--yes']), ONE, prompter),
    );
    expect(allowed).toBe(true);
    expect(asked.map((a) => a.message)).toEqual([
      'Show the per-file diff first?',
      'Write these 1 file(s)?',
    ]);
  });

  test('--yes and a no at the confirm refuses the write, so the decline path is reachable', async () => {
    const { prompter, asked } = recordingPrompter([false, false]);
    const allowed = await withTty(true, () =>
      confirmBatch(parseCli(['setup', '--yes']), ONE, prompter),
    );
    expect(allowed).toBe(false);
    expect(asked).toHaveLength(2);
  });

  test('--yes --force skips it: --force is the flag that settles this, not --yes', async () => {
    const { prompter, asked } = recordingPrompter([]);
    const allowed = await withTty(true, () =>
      confirmBatch(parseCli(['setup', '--yes', '--force']), ONE, prompter),
    );
    expect(allowed).toBe(true);
    expect(asked).toEqual([]);
  });

  test('a plain terminal run asks both questions — the behaviour neither fix may change', async () => {
    const { prompter, asked } = recordingPrompter([false, true]);
    const allowed = await withTty(true, () => confirmBatch(parseCli(['setup']), ONE, prompter));
    expect(allowed).toBe(true);
    expect(asked).toHaveLength(2);
  });

  test('yes to the diff question is honoured, and the write question still follows it', async () => {
    const { prompter, asked } = recordingPrompter([true, true]);
    const allowed = await withTty(true, () => confirmBatch(parseCli(['setup']), ONE, prompter));
    expect(allowed).toBe(true);
    expect(asked.map((a) => a.message)).toEqual([
      'Show the per-file diff first?',
      'Write these 1 file(s)?',
    ]);
  });

  test('no TTY and no --force: nobody to ask, so the preview above is the whole contract', async () => {
    const { prompter, asked } = recordingPrompter([false]);
    const allowed = await withTty(false, () =>
      confirmBatch(parseCli(['setup']), ONE, prompter),
    );
    expect(allowed).toBe(true);
    expect(asked).toEqual([]);
  });
});
