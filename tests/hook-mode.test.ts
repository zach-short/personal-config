import { describe, expect, test } from 'bun:test';
import { chmod, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { writeText } from '../src/lib/disk.ts';
import { isOurs } from '../src/lib/stamp.ts';
import { previewTree, renderDiff } from '../src/lib/ui.ts';
import { commitPlan, resolvePlan, willWrite } from '../src/lib/write-plan.ts';
import { planned } from '../src/render/context.ts';
import { renderHooks } from '../src/render/hooks.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testContext } from './helpers.ts';

/**
 * The two bugs these pin, both of which had to be fixed before an installed hook could run.
 *
 * **The bit.** `settings.json` registers each hook as a `command` entry holding a bare path, and
 * `writeText` created those scripts 0644. Measured 2026-09-18 — a 0644 file run as a command
 * exits 126 with "Permission denied" under a shell, and throws `EACCES` from `posix_spawn` when
 * executed directly.
 *
 * **The shebang.** `withStamp` prepended the stamp above `#!/usr/bin/env bash`, and a `#!` is
 * only a shebang on line 1, so the fixed-up 0755 script still threw `ENOEXEC`. Found by writing
 * the first test below and watching it fail for the wrong reason.
 *
 * Either one alone was enough for the commit guard and the session banner to have never fired
 * for anyone who installed them.
 *
 * Everything here works in a throwaway directory and touches no `$HOME` path. The end-to-end
 * case — the real templates, written where a run would write them, then spawned — is in
 * `tests/hooks.test.ts`, so only one file in the suite writes into the sandbox home.
 */
const EXECUTABLE = 0o755;

async function modeOf(path: string): Promise<number> {
  return (await stat(path)).mode & 0o777;
}

function scriptPlan(dir: string, contents = '#!/usr/bin/env bash\necho hi\n') {
  const ctx = testContext(DEFAULT_ANSWERS);
  return planned(ctx, join(dir, 'hook.sh'), 'a hook script', contents, { extension: 'sh' });
}

describe('a planned shell script carries the bit it needs to run', () => {
  test('violates the old behaviour: a newly written .sh is executable, not 0644', async () => {
    const dir = await tempDir();
    try {
      const file = scriptPlan(dir);
      await commitPlan(await resolvePlan([file]));
      expect(await modeOf(file.path)).toBe(EXECUTABLE);
    } finally {
      await cleanup(dir);
    }
  });

  /**
   * The upgrade path: a script an older version installed, so it is stamped and 0644, being
   * replaced by one whose body has changed. Seeding it with unstamped bytes would test nothing —
   * the stamp guard refuses those, correctly, and the write never happens.
   */
  test('violates the old behaviour: an overwrite of a 0644 script sets the bit too', async () => {
    const dir = await tempDir();
    try {
      const installed = scriptPlan(dir, '#!/usr/bin/env bash\necho first\n');
      await writeText(installed.path, installed.contents);
      await chmod(installed.path, 0o644);

      const upgraded = scriptPlan(dir, '#!/usr/bin/env bash\necho second\n');
      const changes = await resolvePlan([upgraded]);
      expect(changes[0]?.guard).toBe('none');

      await commitPlan(changes);
      expect(await modeOf(upgraded.path)).toBe(EXECUTABLE);
    } finally {
      await cleanup(dir);
    }
  });

  /**
   * The case a contents comparison cannot see, and the one every existing install is in: the
   * bytes already match, so the plan has nothing to write and the old code called the file
   * current. `writeFile`'s own `mode` option would not have covered it either — it is honoured
   * only when the call creates the file (verified 2026-09-18 against an existing 0644 file,
   * which stayed 0644).
   */
  test('violates the old behaviour: a re-run repairs the bit with no contents change', async () => {
    const dir = await tempDir();
    try {
      const file = scriptPlan(dir);
      await commitPlan(await resolvePlan([file]));
      await chmod(file.path, 0o644);

      const changes = await resolvePlan([file]);
      const change = changes[0];
      expect(change?.before).toBe(change?.after ?? '');
      expect(change && willWrite(change)).toBe(true);

      const result = await commitPlan(changes);
      expect(result.written).toEqual([file.path]);
      expect(result.skipped).toEqual([]);
      expect(await modeOf(file.path)).toBe(EXECUTABLE);
    } finally {
      await cleanup(dir);
    }
  });

  /**
   * A mode-only repair is a write, so the preview has to say so. It used to read `unchanged`
   * and then change the file, which is the one thing a preview may not do.
   */
  test('violates the old behaviour: the preview names a mode-only repair', async () => {
    const dir = await tempDir();
    try {
      const file = scriptPlan(dir);
      await commitPlan(await resolvePlan([file]));
      await chmod(file.path, 0o644);

      const changes = await resolvePlan([file]);
      expect(previewTree(changes)).toContain('mode → 755');
      expect(previewTree(changes)).not.toContain('[unchanged]');
      expect(renderDiff(changes[0] as (typeof changes)[number])).toContain(
        'contents unchanged; mode → 755',
      );
    } finally {
      await cleanup(dir);
    }
  });

  test('passes: a script already executable is reported as current, not rewritten', async () => {
    const dir = await tempDir();
    try {
      const file = scriptPlan(dir);
      await commitPlan(await resolvePlan([file]));

      const changes = await resolvePlan([file]);
      const change = changes[0];
      expect(change && willWrite(change)).toBe(false);
      expect((await commitPlan(changes)).written).toEqual([]);
      expect(previewTree(changes)).toContain('unchanged');
      expect(await modeOf(file.path)).toBe(EXECUTABLE);
    } finally {
      await cleanup(dir);
    }
  });

  /** The other ~44 callers of `writeText` must be untouched by this: no bit, no repair, no churn. */
  test('passes: a rendered document is left alone — the bit is for scripts only', async () => {
    const dir = await tempDir();
    try {
      const ctx = testContext(DEFAULT_ANSWERS);
      const doc = planned(ctx, join(dir, 'NOTES.md'), 'a document', '# hi\n');
      expect(doc.mode).toBeUndefined();

      const changes = await resolvePlan([doc]);
      expect(changes[0]?.chmod).toBeUndefined();
      await commitPlan(changes);
      expect((await modeOf(doc.path)) & 0o111).toBe(0);

      // And a second pass over it is still current, rather than a perpetual mode repair.
      expect(willWrite((await resolvePlan([doc]))[0] as (typeof changes)[number])).toBe(false);
    } finally {
      await cleanup(dir);
    }
  });

  /**
   * A file the stamp guard refused is a file this tool has refused to touch, and its bits are
   * part of that. Repairing the mode of somebody else's script would be exactly the write the
   * guard declined.
   */
  test('passes: a stamp-guarded script keeps its own permissions', async () => {
    const dir = await tempDir();
    try {
      const file = scriptPlan(dir);
      await writeText(file.path, '#!/usr/bin/env bash\n# theirs, no stamp\n');
      await chmod(file.path, 0o600);

      const changes = await resolvePlan([file]);
      expect(changes[0]?.guard).toBe('no-stamp');
      expect(changes[0]?.chmod).toBeUndefined();

      await commitPlan(changes);
      expect(await modeOf(file.path)).toBe(0o600);
    } finally {
      await cleanup(dir);
    }
  });
});

/**
 * The second half of "has never fired", and a separate bug from the missing bit: the stamp was
 * prepended *above* `#!/usr/bin/env bash`, and a `#!` is only a shebang on line 1. A stamped
 * script was therefore unrunnable even at 0755 — `ENOEXEC`, not `EACCES` — which is why fixing
 * the mode alone left the hooks exactly as dead as it found them.
 */
describe('a stamp never displaces a shebang', () => {
  test('violates the old behaviour: the shebang stays on line 1, the stamp goes to line 2', () => {
    const ctx = testContext(DEFAULT_ANSWERS);
    const file = planned(
      ctx,
      '/tmp/x/hook.sh',
      'a hook script',
      '#!/usr/bin/env bash\necho hi\n',
      {
        extension: 'sh',
      },
    );
    const [first, second] = file.contents.split('\n');

    expect(first).toBe('#!/usr/bin/env bash');
    expect(second).toContain('personal-config v');
    expect(isOurs(file.contents)).toBe(true);
  });

  test('passes: a file with no shebang is stamped on line 1, as it always was', () => {
    const ctx = testContext(DEFAULT_ANSWERS);
    const doc = planned(ctx, '/tmp/x/NOTES.md', 'a document', '# Heading\n');

    expect(doc.contents.split('\n')[0]).toContain('personal-config v');
    expect(doc.contents).toEndWith('# Heading\n');
  });

  test('passes: every hook script a run plans still execs — shebang first, stamp second', async () => {
    const files = await renderHooks(testContext({ ...DEFAULT_ANSWERS, hooks: 'both' }));
    for (const script of files.filter((f) => f.path.endsWith('.sh'))) {
      expect(script.contents.split('\n')[0]).toBe('#!/usr/bin/env bash');
      expect(isOurs(script.contents)).toBe(true);
    }
  });
});

describe('the hooks a run plans are the ones that carry the bit', () => {
  test('passes: every script renderHooks plans is executable; settings.json is not', async () => {
    const files = await renderHooks(testContext({ ...DEFAULT_ANSWERS, hooks: 'both' }));
    const scripts = files.filter((f) => f.path.endsWith('.sh'));

    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) expect(script.mode).toBe(EXECUTABLE);
    for (const other of files.filter((f) => !f.path.endsWith('.sh'))) {
      expect(other.mode).toBeUndefined();
    }
  });
});
