import { describe, expect, test } from 'bun:test';
import { chmod, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { exists, readText, writeText } from '../src/lib/disk.ts';
import { claudeHooksDir, claudeSettingsFile } from '../src/lib/paths.ts';
import { commitPlan, resolvePlan, willWrite } from '../src/lib/write-plan.ts';
import { renderHooks } from '../src/render/hooks.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testContext } from './helpers.ts';

const HOOKS = join(import.meta.dir, '..', 'templates', 'hooks');

/** Exit 2 is what Claude Code reads as "blocked"; 0 lets the tool call through. */
async function guard(toolInput: Record<string, unknown>): Promise<number> {
  const proc = Bun.spawn(['bash', join(HOOKS, 'commit-guard.sh')], {
    stdin: new TextEncoder().encode(
      JSON.stringify({ tool_name: 'Bash', tool_input: toolInput }),
    ),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return proc.exited;
}

const BLOCKED = 2;
const ALLOWED = 0;

describe('the commit guard blocks what it claims to', () => {
  const blocked: Array<[string, string]> = [
    ['a bare commit', 'git commit -m x'],
    ['a push', 'git push origin main'],
    ['a commit behind a global option that takes an argument', 'git -C . commit -m x'],
    ['a commit behind -c', 'git -c user.name=x commit -m y'],
    ['staging everything', 'git add -A'],
    ['staging everything, in a flag cluster', 'git add -Av'],
    ['staging everything by long flag', 'git add --all'],
    ['staging the whole directory', 'git add .'],
    ['a commit after another command', 'ls && git commit -m x'],
    ['a commit on a second line', 'echo hi\ngit push'],
    ['a commit inside a shell wrapper', 'sh -c "git commit -m x"'],
    ['a commit with the binary spelled out', '/usr/bin/git commit -m x'],
  ];

  for (const [what, command] of blocked) {
    test(`violates: ${what}`, async () => {
      expect(await guard({ command })).toBe(BLOCKED);
    });
  }
});

describe('the commit guard lets through what writes nothing', () => {
  const allowed: Array<[string, Record<string, unknown>]> = [
    // The payload carries the description too, and matching it blocked plain `ls`.
    [
      'a command whose description mentions a commit',
      { command: 'ls -la', description: 'look before we git commit' },
    ],
    ['a search for the phrase', { command: 'grep "git commit" PASSOFF.md' }],
    ['printing the phrase', { command: 'echo "git commit"' }],
    ['the status call the ritual starts with', { command: 'git status --short' }],
    ['staging named files', { command: 'git add src/x.ts tests/x.test.ts' }],
    ['reading the log', { command: 'git log --oneline -5' }],
    ['a tool call with no command at all', { file_path: '/tmp/x' }],
  ];

  for (const [what, toolInput] of allowed) {
    test(`passes: ${what}`, async () => {
      expect(await guard(toolInput)).toBe(ALLOWED);
    });
  }
});

/** The banner reads the repo's own `.personal-config.json`, so every case needs a repo. */
async function banner(board: string | null): Promise<string> {
  const dir = await tempDir();
  try {
    await Bun.write(
      join(dir, '.personal-config.json'),
      `${JSON.stringify({ ledgerFile: 'HANDOFF.md', boardFile: 'PASSOFF.md' })}\n`,
    );
    await Bun.write(join(dir, 'HANDOFF.md'), '# H\n');
    if (board !== null) await Bun.write(join(dir, 'PASSOFF.md'), board);

    const proc = Bun.spawn(['bash', join(HOOKS, 'session-banner.sh')], {
      cwd: dir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return out;
  } finally {
    await cleanup(dir);
  }
}

const HEADER = [
  '| # | Task | Status | Model | Lane | Waits on | Files it owns |',
  '|---|------|--------|-------|------|----------|---------------|',
].join('\n');

const VOCABULARY =
  'Status vocabulary, and no other words: `OPEN` · `IN FLIGHT` · `DONE — HANDOFF n` · `HELD`.';

describe('the session banner announces a board row', () => {
  test('violates the old behaviour: the vocabulary sentence is never the open item', async () => {
    const out = await banner(
      `${VOCABULARY}\n\n${HEADER}\n| 1 | Ship it | \`OPEN\` | D | A | — | — |\n`,
    );
    expect(out).not.toContain('Status vocabulary');
    expect(out).toContain('| 1 | Ship it |');
  });

  test('passes: a board whose first row is DONE announces the first OPEN one', async () => {
    const rows = [
      '| 1 | Done thing | `DONE — HANDOFF 2` | D | A | — | — |',
      '| 2 | Open thing | `OPEN` | D | A | — | — |',
    ].join('\n');
    const out = await banner(`${VOCABULARY}\n\n${HEADER}\n${rows}\n`);
    expect(out).toContain('| 2 | Open thing |');
    expect(out).not.toContain('Done thing');
  });

  test('passes: a board with no open rows says so', async () => {
    const out = await banner(
      `${VOCABULARY}\n\n${HEADER}\n| 1 | Done thing | \`DONE — HANDOFF 2\` | D | A | — | — |\n`,
    );
    expect(out).toContain('no OPEN rows');
  });

  test('passes: a repo with no board file at all prints only the ledger line', async () => {
    const out = await banner(null);
    expect(out).toContain('Ledger: HANDOFF.md');
    expect(out).not.toContain('Board:');
  });
});

/**
 * Everything above spawns `['bash', <template>]`, which is why the suite was green for a year
 * while no installed hook had ever fired: `bash <path>` never reads the executable bit, and
 * `settings.json` invokes two of the three by **bare path**, which does. These drive the real
 * pipeline — `renderHooks` → `resolvePlan` → `commitPlan` — and then run what it wrote the way
 * the harness runs it.
 *
 * This is the one file in the suite that writes into the sandbox `$HOME`, and it puts back what
 * it found: `tests/decline-seam.test.ts` asserts these exact paths are absent after a decline,
 * and would fail on leftovers from here whenever the runner ordered it second.
 */
const INSTALLED = join(claudeHooksDir(), 'commit-guard.sh');

async function modeOf(path: string): Promise<number> {
  return (await stat(path)).mode & 0o777;
}

/** The real plan a `hooks: both` run produces, minus the `settings.json` merge. */
async function installScripts(): Promise<string[]> {
  const files = await renderHooks(testContext({ ...DEFAULT_ANSWERS, hooks: 'both' }));
  const scripts = files.filter((f) => f.path.endsWith('.sh'));
  await commitPlan(await resolvePlan(scripts));
  return scripts.map((f) => f.path);
}

/** Run an installed hook the way a `command` entry does: the path itself, nothing in front. */
async function runByBarePath(path: string, payload: unknown): Promise<number> {
  const proc = Bun.spawn([path], {
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return proc.exited;
}

async function clearInstalled(): Promise<void> {
  await rm(claudeHooksDir(), { recursive: true, force: true });
}

describe('a hook a run installs actually runs', () => {
  /**
   * The test that would have caught the bug. Before the fix the scripts landed 0644 and this
   * threw `EACCES` from `posix_spawn` rather than returning an exit code at all — measured
   * 2026-09-18, alongside exit 126 for the same file run through a shell.
   */
  test('violates the old behaviour: the written commit guard blocks by bare path', async () => {
    try {
      const paths = await installScripts();
      expect(paths).toContain(INSTALLED);
      for (const path of paths) expect(await modeOf(path)).toBe(0o755);

      const blocked = await runByBarePath(INSTALLED, {
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m x' },
      });
      expect(blocked).toBe(BLOCKED);

      const allowed = await runByBarePath(INSTALLED, {
        tool_name: 'Bash',
        tool_input: { command: 'git status --short' },
      });
      expect(allowed).toBe(ALLOWED);
    } finally {
      await clearInstalled();
    }
  });

  /**
   * The install everybody already has: right bytes, wrong bits. Nothing about the contents
   * changes, so a plan that compared only contents called it current and left it unrunnable —
   * which is why "has never fired" was true for existing installs and not only for new ones.
   */
  test('violates the old behaviour: a re-run repairs a hook installed 0644', async () => {
    try {
      await installScripts();
      await chmod(INSTALLED, 0o644);
      await expect(
        runByBarePath(INSTALLED, { tool_name: 'Bash', tool_input: { command: 'git push' } }),
      ).rejects.toThrow();

      const files = await renderHooks(testContext({ ...DEFAULT_ANSWERS, hooks: 'both' }));
      const changes = await resolvePlan(files.filter((f) => f.path.endsWith('.sh')));
      const guard = changes.find((c) => c.file.path === INSTALLED);
      expect(guard?.before).toBe(guard?.after ?? '');
      expect(guard && willWrite(guard)).toBe(true);

      expect((await commitPlan(changes)).written).toContain(INSTALLED);
      expect(await modeOf(INSTALLED)).toBe(0o755);
      expect(
        await runByBarePath(INSTALLED, {
          tool_name: 'Bash',
          tool_input: { command: 'git push' },
        }),
      ).toBe(BLOCKED);
    } finally {
      await clearInstalled();
    }
  });

  test('passes: a second run over a good install writes nothing at all', async () => {
    try {
      await installScripts();
      const files = await renderHooks(testContext({ ...DEFAULT_ANSWERS, hooks: 'both' }));
      const changes = await resolvePlan(files.filter((f) => f.path.endsWith('.sh')));

      expect(changes.filter(willWrite)).toEqual([]);
      expect((await commitPlan(changes)).written).toEqual([]);
    } finally {
      await clearInstalled();
    }
  });
});

/**
 * Why `gateCommand()` still returns `bash "<path>"` now that the bit is guaranteed. The entry
 * is merged into `settings.json`, and `mergeArrays` de-duplicates by exact JSON — so changing
 * the command string would not replace the installed entry, it would sit beside it and the gate
 * would fire twice for everyone who already ran `setup`. What this pins is the property, not
 * the spelling: whatever the renderer emits has to re-merge into itself as a no-op.
 */
describe('the settings merge is idempotent against what a previous run wrote', () => {
  test('passes: re-merging the planned hooks adds no second entry', async () => {
    const previous = (await exists(claudeSettingsFile()))
      ? await readText(claudeSettingsFile())
      : null;
    try {
      const [merge] = (
        await renderHooks(testContext({ ...DEFAULT_ANSWERS, hooks: 'both' }))
      ).filter((f) => f.strategy === 'merge-json');
      expect(merge).toBeDefined();

      // What an install already holds, written by a previous run of this same renderer.
      await writeText(claudeSettingsFile(), (merge as NonNullable<typeof merge>).contents);
      const [change] = await resolvePlan([merge as NonNullable<typeof merge>]);
      const after = JSON.parse(change?.after ?? '{}') as {
        hooks: Record<string, unknown[]>;
      };

      for (const [event, entries] of Object.entries(after.hooks)) {
        expect([event, entries.length]).toEqual([event, 1]);
      }
      expect(change?.before).toBe(change?.after ?? '');
    } finally {
      if (previous === null) await rm(claudeSettingsFile(), { force: true });
      else await writeText(claudeSettingsFile(), previous);
    }
  });
});
