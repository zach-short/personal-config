/**
 * `setup` prunes the `settings.json` entries no target wants and removes the scripts nothing still
 * runs (setup-hook-leftovers D1 to D3, PLAN.md Phase 1). A non-code run used to leave the delete
 * guard on `rm` in every later code session, with no message that pointed back at `setup`.
 *
 * Most cases are the real bin in a child process with `HOME` pointed at a temp directory this file
 * made. The cases that need a plan and no write call `planEverything`, with `$HOME` pointed at
 * their own temp directory for the duration. A case that reached the real home would edit the
 * developer's `settings.json`, so each home is checked to be under the temp directory first.
 */
import { describe, expect, test } from 'bun:test';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planEverything } from '../src/commands/setup.ts';
import { exists, readText } from '../src/lib/disk.ts';
import { claudeHooksDir, claudeSettingsFile, repoRoot } from '../src/lib/paths.ts';
import { markAdapted, stampLine } from '../src/lib/stamp.ts';
import type { Answers, PlannedFile } from '../src/lib/types.ts';
import { declinedHookHelp, hookEntries } from '../src/render/hooks.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  tempDir,
  testConfig,
  testRepoPlan,
  testScan,
} from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');
const GONE = '(no longer installed)';

type Run = { code: number; stdout: string };
type Settings = { hooks?: Record<string, unknown[]>; [key: string]: unknown };

async function cli(args: string[], home: string): Promise<Run> {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd: repoRoot(),
    env: { ...process.env, HOME: home },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  await new Response(proc.stderr).text();
  return { code: await proc.exited, stdout };
}

/** A fresh home under the temp directory, refused if it is anywhere else. */
async function freshHome(): Promise<string> {
  const home = await tempDir('pc-hook-leftovers-');
  expect(home.startsWith(tmpdir())).toBe(true);
  expect(home).not.toBe(process.env.PERSONAL_CONFIG_TEST_HOME);
  return home;
}

/** The starter profile with every hook, every skill and the write-doc check on every save. */
async function profile(home: string, name: string, answers: Answers): Promise<string> {
  const starter = JSON.parse(await readText(join(repoRoot(), 'profiles', 'starter.json')));
  starter.answers = {
    ...starter.answers,
    configWeight: 'full',
    usesGit: 'yes',
    skills: 'all',
    hooks: 'both',
    outputStyle: 'check-first',
    writeDoc: 'yes',
    writeDocCheck: 'every',
    ...answers,
  };
  const path = join(home, `${name}.json`);
  await writeFile(path, JSON.stringify(starter, null, 2));
  return path;
}

/** One `setup --from` run into an empty projects directory of its own: global files only. */
async function setup(home: string, answers: Answers, extra: string[] = []): Promise<Run> {
  const name = `run-${Math.random().toString(36).slice(2)}`;
  const projects = join(home, name);
  await mkdir(projects);
  const from = await profile(home, name, answers);
  const run = await cli(
    ['setup', '--from', from, '--projects-dir', projects, '--yes', ...extra],
    home,
  );
  expect(run.code).toBe(0);
  return run;
}

/** `exists` answers for files only, so a folder needs its own check. */
async function isFolder(path: string): Promise<boolean> {
  return stat(path)
    .then((entry) => entry.isDirectory())
    .catch(() => false);
}

function settingsPath(home: string): string {
  return join(home, '.claude', 'settings.json');
}

function hooksDir(home: string): string {
  return join(home, '.claude', 'hooks', 'personal-config');
}

function hook(home: string, name: string): string {
  return join(hooksDir(home), name);
}

function writeDocDir(home: string): string {
  return join(home, '.claude', 'skills', 'write-doc');
}

async function settings(home: string): Promise<Settings> {
  return JSON.parse(await readText(settingsPath(home))) as Settings;
}

async function writeSettings(home: string, body: Settings): Promise<void> {
  await writeFile(settingsPath(home), `${JSON.stringify(body, null, 2)}\n`);
}

/** Every command under one event, in the order the file holds them. */
function commands(body: Settings, event: string): string[] {
  return (body.hooks?.[event] ?? []).flatMap((entry) =>
    ((entry as { hooks?: { command?: string }[] }).hooks ?? []).map((h) => h.command ?? ''),
  );
}

/** The catalog entry of one script, as `settingsMerge` writes it under a given home. */
function bashEntry(home: string, script: string): Record<string, unknown> {
  return { matcher: 'Bash', hooks: [{ type: 'command', command: hook(home, script) }] };
}

const CODE: Answers = { workKind: 'code' };
const NON_CODE: Answers = { workKind: 'non-code' };

describe('a later run prunes the entries it no longer wants (D1)', () => {
  test('non-code then code: the delete guard and the save check go, the commit guard stays once', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      expect(commands(await settings(home), 'PreToolUse')).toEqual([
        hook(home, 'commit-guard.sh'),
        hook(home, 'delete-guard.sh'),
      ]);

      const run = await setup(home, CODE);
      expect(run.stdout).toContain('settings.json — hook entries merged in, 2 removed');
      const after = await settings(home);
      expect(commands(after, 'PreToolUse')).toEqual([hook(home, 'commit-guard.sh')]);
      expect(after.hooks?.PostToolUse).toBeUndefined();
      expect(await exists(hook(home, 'delete-guard.sh'))).toBe(false);
      expect(await exists(hook(home, 'commit-guard.sh'))).toBe(true);
      expect(await exists(join(writeDocDir(home), 'check.sh'))).toBe(false);
      expect(await isFolder(writeDocDir(home))).toBe(false);
    } finally {
      await cleanup(home);
    }
  });

  test('code then non-code under usesGit no: the commit guard, its script and its policy go', async () => {
    const home = await freshHome();
    try {
      await setup(home, CODE);
      expect(await exists(hook(home, 'commit-policy'))).toBe(true);

      await setup(home, { ...NON_CODE, usesGit: 'no' });
      expect(commands(await settings(home), 'PreToolUse')).toEqual([
        hook(home, 'delete-guard.sh'),
      ]);
      expect(await exists(hook(home, 'commit-guard.sh'))).toBe(false);
      expect(await exists(hook(home, 'commit-policy'))).toBe(false);
    } finally {
      await cleanup(home);
    }
  });

  test('code then non-code under usesGit yes: nothing about the commit guard changes', async () => {
    const home = await freshHome();
    try {
      await setup(home, CODE);
      const run = await setup(home, NON_CODE);
      expect(run.stdout).not.toContain(`blocks git commit/push ${GONE}`);
      expect(commands(await settings(home), 'PreToolUse')).toContain(
        hook(home, 'commit-guard.sh'),
      );
      // Its bytes change with the stamp's config hash, so only its presence is pinned.
      expect(await exists(hook(home, 'commit-guard.sh'))).toBe(true);
      expect(await exists(hook(home, 'commit-policy'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });

  test('every hook then "No hooks": all five entries and the folder go, a key of yours stays', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      await writeSettings(home, { ...(await settings(home)), theme: 'dark' });

      const run = await setup(home, { ...NON_CODE, hooks: 'none' });
      expect(run.stdout).toContain('settings.json — 5 hook entries removed');
      const after = await settings(home);
      expect(after.hooks).toBeUndefined();
      expect(after.theme).toBe('dark');
      expect(await isFolder(hooksDir(home))).toBe(false);
      expect(await isFolder(join(home, '.claude', 'hooks'))).toBe(true);
      // `wantsWriteDoc` still holds, so the script is rendered and stays without its entry.
      expect(await exists(join(writeDocDir(home), 'check.sh'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });

  test('writeDocCheck every then skill: the entry goes and check.sh stays (F5)', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      const run = await setup(home, { ...NON_CODE, writeDocCheck: 'skill' });
      expect(run.stdout).toContain('1 removed');
      expect((await settings(home)).hooks?.PostToolUse).toBeUndefined();
      expect(await exists(join(writeDocDir(home), 'check.sh'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });
});

/**
 * An entry an earlier release wrote, and no release writes now (board row 127). The merge keys on
 * exact JSON, so the gate's new `timeout` would land beside the old one; Claude Code then keeps one
 * of the two commands, and which timeout it keeps is not documented.
 */
describe('a later run retires the entries an earlier release wrote', () => {
  function gateEntry(home: string, timeout: number): Record<string, unknown> {
    return {
      hooks: [
        { type: 'command', command: `bash "${hook(home, 'completion-gate.sh')}"`, timeout },
      ],
    };
  }

  test.each([120, 330])(
    'the completion gate at %i seconds goes, and the entry at 600 is the only Stop entry',
    async (old) => {
      const home = await freshHome();
      try {
        await setup(home, CODE);
        const body = await settings(home);
        body.hooks = { ...body.hooks, Stop: [gateEntry(home, old)] };
        await writeSettings(home, body);

        const run = await setup(home, CODE);
        expect(run.stdout).toContain('settings.json — hook entries merged in, 1 removed');
        expect((await settings(home)).hooks?.Stop).toEqual([gateEntry(home, 600)]);
        expect(await exists(hook(home, 'completion-gate.sh'))).toBe(true);
      } finally {
        await cleanup(home);
      }
    },
  );

  test('a timeout of your own is yours: it stays beside the one setup writes', async () => {
    const home = await freshHome();
    try {
      await setup(home, CODE);
      const body = await settings(home);
      body.hooks = { ...body.hooks, Stop: [gateEntry(home, 900)] };
      await writeSettings(home, body);

      await setup(home, CODE);
      expect((await settings(home)).hooks?.Stop).toEqual([
        gateEntry(home, 900),
        gateEntry(home, 600),
      ]);
    } finally {
      await cleanup(home);
    }
  });
});

describe('what the prune leaves alone', () => {
  test('an entry with one changed byte is yours: it stays, and so does its script', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      const body = await settings(home);
      const edited = {
        matcher: 'Bash',
        hooks: [{ type: 'command', command: `${hook(home, 'delete-guard.sh')} ` }],
      };
      body.hooks = {
        ...body.hooks,
        PreToolUse: [bashEntry(home, 'commit-guard.sh'), edited],
      };
      await writeSettings(home, body);

      await setup(home, CODE);
      expect((await settings(home)).hooks?.PreToolUse).toContainEqual(edited);
      expect(await exists(hook(home, 'delete-guard.sh'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });

  test('your own entry that runs delete-guard.sh by its ~ path keeps the script', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      const body = await settings(home);
      const mine = {
        matcher: 'Bash',
        hooks: [
          { type: 'command', command: '~/.claude/hooks/personal-config/delete-guard.sh' },
        ],
      };
      body.hooks = { ...body.hooks, PreToolUse: [...(body.hooks?.PreToolUse ?? []), mine] };
      await writeSettings(home, body);

      await setup(home, CODE);
      const pre = (await settings(home)).hooks?.PreToolUse ?? [];
      expect(pre).not.toContainEqual(bashEntry(home, 'delete-guard.sh'));
      expect(pre).toContainEqual(mine);
      expect(await exists(hook(home, 'delete-guard.sh'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });

  test('an identical entry with its keys in another order is pruned (D2)', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      const body = await settings(home);
      const reordered = {
        hooks: [{ command: hook(home, 'delete-guard.sh'), type: 'command' }],
        matcher: 'Bash',
      };
      body.hooks = {
        ...body.hooks,
        PreToolUse: [bashEntry(home, 'commit-guard.sh'), reordered],
      };
      await writeSettings(home, body);

      await setup(home, CODE);
      expect(commands(await settings(home), 'PreToolUse')).toEqual([
        hook(home, 'commit-guard.sh'),
      ]);
      expect(await exists(hook(home, 'delete-guard.sh'))).toBe(false);
    } finally {
      await cleanup(home);
    }
  });

  test('a script with no stamp, or one marked adapted, stays while its entry goes', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      await writeFile(hook(home, 'delete-guard.sh'), '#!/bin/bash\nexit 0\n');
      const check = join(writeDocDir(home), 'check.sh');
      await writeFile(check, markAdapted(await readText(check), ''));

      const run = await setup(home, CODE);
      expect(run.stdout).toContain('2 removed');
      expect(await readText(hook(home, 'delete-guard.sh'))).toBe('#!/bin/bash\nexit 0\n');
      expect(await exists(check)).toBe(true);
    } finally {
      await cleanup(home);
    }
  });

  test('your hooks under the same events are kept, in their order', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      const body = await settings(home);
      const first = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo first' }] };
      const last = { matcher: 'Read', hooks: [{ type: 'command', command: 'echo last' }] };
      const post = { matcher: 'Write', hooks: [{ type: 'command', command: 'echo post' }] };
      body.hooks = {
        ...body.hooks,
        PreToolUse: [
          first,
          bashEntry(home, 'commit-guard.sh'),
          bashEntry(home, 'delete-guard.sh'),
          last,
        ],
        PostToolUse: [...(body.hooks?.PostToolUse ?? []), post],
      };
      await writeSettings(home, body);

      await setup(home, CODE);
      const after = await settings(home);
      expect(after.hooks?.PreToolUse).toEqual([
        first,
        bashEntry(home, 'commit-guard.sh'),
        last,
      ]);
      expect(after.hooks?.PostToolUse).toEqual([post]);
    } finally {
      await cleanup(home);
    }
  });
});

describe('a run that prunes is previewed, repeatable and undone', () => {
  test('--dry-run lists every removal and changes nothing', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      const before = await readText(settingsPath(home));
      const run = await setup(home, CODE, ['--dry-run']);
      expect(run.stdout).toContain('2 removed');
      expect(run.stdout).toContain(`hook — blocks rm/rmdir/unlink ${GONE}`);
      expect(run.stdout).toContain(`skill — /write-doc check script ${GONE}`);
      expect(run.stdout).toContain('--dry-run: nothing was written.');
      expect(await readText(settingsPath(home))).toBe(before);
      expect(await exists(hook(home, 'delete-guard.sh'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });

  test('a second run after the prune is current: no prune and no removal', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      await setup(home, CODE);
      const settled = await readText(settingsPath(home));
      const run = await setup(home, CODE);
      expect(run.stdout).not.toContain(' removed');
      expect(run.stdout).not.toContain(GONE);
      expect(run.stdout).toContain('0 to remove');
      expect(await readText(settingsPath(home))).toBe(settled);
    } finally {
      await cleanup(home);
    }
  });

  test('undo after the prune restores settings.json and each script byte for byte', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      const paths = [
        settingsPath(home),
        hook(home, 'delete-guard.sh'),
        join(writeDocDir(home), 'check.sh'),
      ];
      const before = await Promise.all(paths.map((path) => readText(path)));

      await setup(home, CODE);
      const undone = await cli(['undo', '--yes'], home);
      expect(undone.code).toBe(0);
      expect(await Promise.all(paths.map((path) => readText(path)))).toEqual(before);
    } finally {
      await cleanup(home);
    }
  });

  test('init after a code run plans no prune and no global removal (insideOnly)', async () => {
    const home = await freshHome();
    try {
      await setup(home, CODE);
      const before = await readText(settingsPath(home));
      const folder = join(home, 'notes');
      await mkdir(folder);
      await writeFile(join(folder, 'draft.md'), '# Draft\n');
      await writeFile(
        join(folder, '.personal-config.json'),
        JSON.stringify({ answers: { workKind: 'non-code', hooks: 'none' } }),
      );

      const run = await cli(['init', folder, '--yes'], home);
      expect(run.code).toBe(0);
      expect(run.stdout).not.toContain('settings.json');
      expect(run.stdout).not.toContain(GONE);
      expect(await readText(settingsPath(home))).toBe(before);
      expect(await exists(hook(home, 'commit-guard.sh'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });
});

describe('the plan, read without a write', () => {
  const STAMP = {
    version: '0.0.0',
    date: '2026-10-16',
    configHash: '00000000',
    standardVersion: '2.0.0',
    adapted: false,
  };

  /** Seeds every entry and every stamped script, plans with `$HOME` there, then puts it back. */
  async function planIn<T>(
    home: string,
    answers: Answers,
    targets: number,
    read: (plan: Awaited<ReturnType<typeof planEverything>>) => T,
    settingsText?: string,
  ): Promise<T> {
    const saved = process.env.HOME;
    process.env.HOME = home;
    try {
      await mkdir(claudeHooksDir(), { recursive: true });
      for (const entry of hookEntries()) {
        for (const script of [
          ...entry.scripts,
          ...entry.scripts.flatMap((s) => s.companions),
        ]) {
          await mkdir(join(script.path, '..'), { recursive: true });
          await writeFile(script.path, `#!/bin/bash\n${stampLine(STAMP, 'sh')}\nexit 0\n`);
        }
      }
      const all: Record<string, unknown[]> = {};
      for (const { event, entry } of hookEntries()) all[event] = [...(all[event] ?? []), entry];
      await writeFile(
        claudeSettingsFile(),
        settingsText ?? `${JSON.stringify({ hooks: all }, null, 2)}\n`,
      );
      const full: Answers = { ...DEFAULT_ANSWERS, archiveHome: '', ...answers };
      const repos = Array.from({ length: targets }, (_, i) =>
        testRepoPlan({ scan: testScan({ name: `t${i}`, path: join(home, `t${i}`) }) }),
      );
      return read(await planEverything(testConfig({ answers: full }), full, repos));
    } finally {
      process.env.HOME = saved;
    }
  }

  test('two targets: the union decides, and an entry any context renders is kept (BD-1)', async () => {
    const home = await freshHome();
    try {
      const prune = await planIn(home, { workKind: 'code', hooks: 'both' }, 2, (plan) => {
        const files = plan.filter((c) => c.file.path.endsWith('settings.json'));
        expect(files.length).toBe(1);
        return (files[0]?.file.prune ?? []).map((p) => JSON.stringify(p.item));
      });
      expect(prune.length).toBe(2);
      expect(prune.some((item) => item.includes('delete-guard.sh'))).toBe(true);
      expect(prune.some((item) => item.includes('check.sh'))).toBe(true);
      expect(prune.some((item) => item.includes('commit-guard.sh'))).toBe(false);
    } finally {
      await cleanup(home);
    }
  });

  test('a settings.json that does not parse plans no prune and no script removal (BD-4)', async () => {
    const home = await freshHome();
    try {
      const removals = await planIn(
        home,
        { workKind: 'code', hooks: 'none' },
        1,
        (plan) => ({
          removed: plan.filter((c) => c.remove === true).map((c) => c.file.path),
          settings: plan.filter((c) => c.file.path.endsWith('settings.json')).length,
        }),
        '{ not json',
      );
      expect(removals.settings).toBe(0);
      expect(removals.removed.filter((path) => path.includes('/hooks/'))).toEqual([]);
      expect(removals.removed.filter((path) => path.endsWith('check.sh'))).toEqual([]);
    } finally {
      await cleanup(home);
    }
  });

  test("a declined run's help is the same with a prune in the plan (BD-11)", async () => {
    const home = await freshHome();
    try {
      const [pruning, plain] = await planIn(
        home,
        { workKind: 'code', hooks: 'both' },
        1,
        (plan) => {
          const files = plan.map((c) => c.file);
          const stripped = files.map(({ prune: _, ...file }): PlannedFile => file);
          expect(files.some((file) => (file.prune?.length ?? 0) > 0)).toBe(true);
          return [declinedHookHelp(files), declinedHookHelp(stripped)];
        },
      );
      expect(pruning).not.toBeNull();
      expect(pruning).toBe(plain);
    } finally {
      await cleanup(home);
    }
  });

  test('every path a case here touched is under its temp home', async () => {
    const home = await freshHome();
    try {
      await planIn(home, { workKind: 'code', hooks: 'both' }, 1, (plan) => {
        for (const change of plan) expect(change.file.path.startsWith(home)).toBe(true);
      });
      expect((await readdir(join(home, '.claude'))).length).toBeGreaterThan(0);
    } finally {
      await cleanup(home);
    }
  });
});
