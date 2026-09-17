import { describe, expect, test } from 'bun:test';
import { confirmBatch } from '../src/commands/setup.ts';
import { parseCli } from '../src/lib/args.ts';
import type { Prompter } from '../src/lib/ask.ts';
import type { PlannedChange } from '../src/lib/write-plan.ts';

type Asked = { message: string; fallback: boolean };

/**
 * A real `Prompter` that records what it was asked and answers from a script, rather than a mock
 * of one: what the gate is driven through here is the same interface `clackPrompter` implements,
 * which is the whole reason the prompter is a parameter and not a `clackPrompter()` reached for
 * inside `confirmBatch`.
 */
function recordingPrompter(script: boolean[]): { prompter: Prompter; asked: Asked[] } {
  const asked: Asked[] = [];
  const queue = [...script];
  const prompter: Prompter = {
    async ask(_question, fallback) {
      return fallback;
    },
    async confirm(message, fallback) {
      asked.push({ message, fallback });
      return queue.shift() ?? fallback;
    },
  };
  return { prompter, asked };
}

/**
 * `process.stdout.isTTY` is the gate's only read of the world outside its arguments, and under
 * `bun test` stdout is a pipe. Without this every case below would take the no-TTY early return
 * and pin nothing — which is exactly how "`--force` skips the confirm" can be asserted outside a
 * terminal and still pass against code that never reads `--force` at all.
 *
 * The original descriptor is put back rather than assigned over, because on a pipe the property
 * is absent and `isTTY = undefined` is a different shape from absent.
 */
async function withTty<T>(isTty: boolean, run: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  Object.defineProperty(process.stdout, 'isTTY', { value: isTty, configurable: true });
  try {
    return await run();
  } finally {
    if (original) Object.defineProperty(process.stdout, 'isTTY', original);
    else Reflect.deleteProperty(process.stdout, 'isTTY');
  }
}

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
 * The gap these cannot see, and the reason it stays: `finish` calling `confirmBatch`
 * unconditionally is asserted by nothing here. Re-introducing an `interactive &&` in front of the
 * call would leave every test below passing. There is no way to close it — a terminal run cannot
 * be driven from a test, which is the same wall `tests/decline.test.ts` documents at its foot.
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
