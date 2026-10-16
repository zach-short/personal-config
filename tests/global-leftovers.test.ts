/**
 * `setup` removes the global files a run no longer renders (setup-global-leftovers D1, PLAN.md
 * Phase 1). A run on one track used to leave the other track's skills and rules on disk, so
 * `model-routing.md` could deny the `/delegate` exception while `/delegate` stayed installed.
 *
 * Every run but the two-target case is the real bin in a child process with `HOME` pointed at a
 * temp directory this file made (`X2`). The two-target case calls `planEverything`, which reads
 * the disk and writes nothing, with `$HOME` pointed at its own temp directory for the duration.
 * A case that reached the real home would delete the developer's skills, so each home is checked
 * to be under the temp directory before anything runs in it.
 */
import { describe, expect, test } from 'bun:test';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planEverything } from '../src/commands/setup.ts';
import { exists, readText } from '../src/lib/disk.ts';
import { claudeRulesDir, claudeSkillsDir, repoRoot } from '../src/lib/paths.ts';
import { markAdapted, stampLine } from '../src/lib/stamp.ts';
import type { Answers } from '../src/lib/types.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  tempDir,
  testConfig,
  testRepoPlan,
  testScan,
} from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');
const CODE_ONLY = ['audit', 'autopilot', 'clean-up', 'delegate'];
const EVERY_SKILL = [...CODE_ONLY, 'close-out', 'handoff', 'passoff', 'scope'];
const GONE = '(no longer installed)';

type Run = { code: number; stdout: string };

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
  const home = await tempDir('pc-leftovers-');
  expect(home.startsWith(tmpdir())).toBe(true);
  expect(home).not.toBe(process.env.PERSONAL_CONFIG_TEST_HOME);
  return home;
}

/** The starter profile on one track, with every skill, both hooks and `/write-doc` asked for. */
async function profile(home: string, name: string, answers: Answers): Promise<string> {
  const starter = JSON.parse(await readText(join(repoRoot(), 'profiles', 'starter.json')));
  starter.answers = {
    ...starter.answers,
    configWeight: 'full',
    usesGit: 'yes',
    skills: 'all',
    hooks: 'both',
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

function skill(home: string, name: string): string {
  return join(home, '.claude', 'skills', name, 'SKILL.md');
}

function rule(home: string, name: string): string {
  return join(home, '.claude', 'rules', `${name}.md`);
}

async function skillFolders(home: string): Promise<string[]> {
  return (await readdir(join(home, '.claude', 'skills'))).sort();
}

const CODE: Answers = { workKind: 'code' };
const NON_CODE: Answers = { workKind: 'non-code' };

describe('a later run removes what it no longer renders (D1)', () => {
  test('code then non-code: the code-only skills and commits.md go, with their folders', async () => {
    const home = await freshHome();
    try {
      await setup(home, CODE);
      expect(await skillFolders(home)).toEqual([...EVERY_SKILL].sort());
      expect(await exists(rule(home, 'commits'))).toBe(true);

      const run = await setup(home, NON_CODE);
      expect(run.stdout).toContain('5 to remove');
      expect(run.stdout).toContain('Removed 5 file(s) this run no longer installs.');
      for (const name of CODE_ONLY) expect(await exists(skill(home, name))).toBe(false);
      expect(await exists(rule(home, 'commits'))).toBe(false);
      expect(await skillFolders(home)).toEqual([
        'close-out',
        'handoff',
        'passoff',
        'scope',
        'write-doc',
      ]);
      expect(await readText(rule(home, 'model-routing'))).not.toContain('/delegate');
    } finally {
      await cleanup(home);
    }
  });

  test('undo after that restores each removed file byte for byte', async () => {
    const home = await freshHome();
    try {
      await setup(home, CODE);
      const paths = [...CODE_ONLY.map((name) => skill(home, name)), rule(home, 'commits')];
      const before = await Promise.all(paths.map((path) => readText(path)));

      await setup(home, NON_CODE);
      const undone = await cli(['undo'], home);
      expect(undone.code).toBe(0);
      expect(await Promise.all(paths.map((path) => readText(path)))).toEqual(before);
    } finally {
      await cleanup(home);
    }
  });

  test('non-code then code: write-doc/SKILL.md and style.md go, check.sh stays (BD-3)', async () => {
    const home = await freshHome();
    try {
      await setup(home, NON_CODE);
      const dir = join(home, '.claude', 'skills', 'write-doc');
      expect(await exists(join(dir, 'style.md'))).toBe(true);

      const run = await setup(home, CODE);
      expect(run.stdout).toContain(`skill — /write-doc ${GONE}`);
      expect(run.stdout).toContain(`skill — /write-doc style ${GONE}`);
      expect(await exists(join(dir, 'SKILL.md'))).toBe(false);
      expect(await exists(join(dir, 'style.md'))).toBe(false);
      expect(await exists(join(dir, 'check.sh'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });

  test('skills: none after skills: all removes every stamped skill (BD-8)', async () => {
    const home = await freshHome();
    try {
      await setup(home, CODE);
      const run = await setup(home, { ...CODE, skills: 'none' });
      expect(run.stdout).toContain(`Removed ${EVERY_SKILL.length} file(s)`);
      expect(await skillFolders(home)).toEqual([]);
    } finally {
      await cleanup(home);
    }
  });

  test('--dry-run lists the removals and removes nothing', async () => {
    const home = await freshHome();
    try {
      await setup(home, CODE);
      const run = await setup(home, NON_CODE, ['--dry-run']);
      expect(run.stdout.split(GONE).length - 1).toBe(5);
      expect(run.stdout).toContain('5 to remove');
      expect(run.stdout).toContain('--dry-run: nothing was written.');
      for (const name of CODE_ONLY) expect(await exists(skill(home, name))).toBe(true);
      expect(await exists(rule(home, 'commits'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });
});

describe('what is never removed', () => {
  test('a file with no stamp, or one marked adapted, is not planned (BD-4)', async () => {
    const home = await freshHome();
    try {
      await setup(home, CODE);
      await writeFile(skill(home, 'delegate'), '# My own delegate skill\n');
      const audit = await readText(skill(home, 'audit'));
      await writeFile(skill(home, 'audit'), markAdapted(audit, ''));

      const run = await setup(home, NON_CODE);
      expect(run.stdout).not.toContain(`/delegate ${GONE}`);
      expect(run.stdout).not.toContain(`/audit ${GONE}`);
      expect(run.stdout).toContain(`/autopilot ${GONE}`);
      expect(await readText(skill(home, 'delegate'))).toBe('# My own delegate skill\n');
      expect(await exists(skill(home, 'audit'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });

  test('init after a code run removes nothing global, even on another track (DESIGN §5, F8)', async () => {
    const home = await freshHome();
    try {
      await setup(home, CODE);
      const folder = join(home, 'notes');
      await mkdir(folder);
      await writeFile(join(folder, 'draft.md'), '# Draft\n');
      // The folder's own answers make init render the non-code track, whose global plan would
      // remove the code-only skills. `insideOnly` must drop every one of those removals.
      await writeFile(
        join(folder, '.personal-config.json'),
        JSON.stringify({ answers: { workKind: 'non-code' } }),
      );

      const run = await cli(['init', folder, '--yes'], home);
      expect(run.code).toBe(0);
      expect(run.stdout).toContain('This folder is set up as non-code');
      expect(run.stdout).not.toContain(GONE);
      expect(run.stdout).toContain('0 to remove');
      for (const name of CODE_ONLY) expect(await exists(skill(home, name))).toBe(true);
      expect(await exists(rule(home, 'commits'))).toBe(true);
    } finally {
      await cleanup(home);
    }
  });
});

describe('two targets (F10)', () => {
  const STAMP = {
    version: '0.0.0',
    date: '2026-10-16',
    configHash: '00000000',
    standardVersion: '2.0.0',
    adapted: false,
  };

  /** Plans with `$HOME` pointed at a seeded temp home, then puts the shared sandbox back. */
  async function planIn(
    home: string,
    workProfiles: ('ledger' | 'folders')[],
  ): Promise<string[]> {
    const saved = process.env.HOME;
    process.env.HOME = home;
    try {
      for (const name of ['autopilot', 'audit']) {
        await mkdir(join(claudeSkillsDir(), name), { recursive: true });
        await writeFile(
          join(claudeSkillsDir(), name, 'SKILL.md'),
          `${stampLine(STAMP)}\n# ${name}\n`,
        );
      }
      await mkdir(claudeRulesDir(), { recursive: true });
      const answers: Answers = {
        ...DEFAULT_ANSWERS,
        workKind: 'code',
        skills: 'all',
        archiveHome: '',
      };
      const repos = workProfiles.map((workProfile, i) =>
        testRepoPlan({
          workProfile,
          scan: testScan({ name: `t${i}`, path: join(home, `t${i}`) }),
        }),
      );
      const changes = await planEverything(testConfig({ answers }), answers, repos);
      return changes.filter((c) => c.remove === true).map((c) => c.file.path);
    } finally {
      process.env.HOME = saved;
    }
  }

  test('a folders target alone plans the board skills for removal', async () => {
    const home = await freshHome();
    try {
      const removed = await planIn(home, ['folders']);
      expect(removed).toContain(join(home, '.claude', 'skills', 'autopilot', 'SKILL.md'));
      expect(removed).toContain(join(home, '.claude', 'skills', 'audit', 'SKILL.md'));
    } finally {
      await cleanup(home);
    }
  });

  test('with a ledger target beside it, nothing either renders is removed', async () => {
    const home = await freshHome();
    try {
      expect(await planIn(home, ['folders', 'ledger'])).toEqual([]);
    } finally {
      await cleanup(home);
    }
  });
});
