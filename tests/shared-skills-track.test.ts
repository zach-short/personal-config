/**
 * `/close-out` and `/handoff` render into each target, from that target's context, and the
 * `~/.claude/skills/` copies leave (shared-skills-track D1 to D4, PLAN.md Phase 1). One global
 * copy carried the last run's track, or the first target's work record (F3, F4, F7).
 *
 * The runs are the real bin in a child process with `HOME` pointed at a temp directory this file
 * made (`X2`). The in-process cases point `$HOME` at their own temp directory for the duration
 * and put the shared sandbox back. Each home is checked to be under the temp directory first.
 */
import { describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planEverything } from '../src/commands/setup.ts';
import { exists, readText } from '../src/lib/disk.ts';
import { meantToBeTracked } from '../src/lib/hidden-tracked.ts';
import { claudeSkillsDir, repoRoot } from '../src/lib/paths.ts';
import { markAdapted, stampLine } from '../src/lib/stamp.ts';
import type { Answers, PlannedFile } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  everySkill,
  tempDir,
  testConfig,
  testContext,
  testRepoPlan,
  testScan,
} from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');
const TRACK_SKILLS = ['close-out', 'handoff'];
const GONE = '(no longer installed)';
// A case that runs the real bin spawns `bun` and `git` several times. Under a full parallel suite
// one took 5.5 s, past Bun's 5 s default, and the timeout's kill took the next case's `git init`
// with it (exit 143).
const CLI_TIMEOUT = 30_000;
const STAMP = {
  version: '0.0.0',
  date: '2026-10-16',
  configHash: '00000000',
  standardVersion: '2.0.0',
  adapted: false,
};

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

async function freshHome(): Promise<string> {
  const home = await tempDir('pc-shared-skills-');
  expect(home.startsWith(tmpdir())).toBe(true);
  expect(home).not.toBe(process.env.PERSONAL_CONFIG_TEST_HOME);
  return home;
}

async function gitInit(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  const proc = Bun.spawn(['git', 'init', '--quiet', path], { stdout: 'pipe', stderr: 'pipe' });
  expect(await proc.exited).toBe(0);
}

/** A projects folder holding one git repo, `repo`, with no remote: so untracked mode. */
async function projectsWithRepo(home: string): Promise<{ projects: string; repo: string }> {
  const projects = join(home, 'projects');
  const repo = join(projects, 'repo');
  await gitInit(repo);
  await writeFile(join(repo, 'README.md'), '# repo\n');
  return { projects, repo };
}

async function setup(home: string, projects: string, answers: Answers): Promise<Run> {
  const starter = JSON.parse(await readText(join(repoRoot(), 'profiles', 'starter.json')));
  starter.answers = {
    ...starter.answers,
    configWeight: 'full',
    usesGit: 'yes',
    skills: 'all',
    ...answers,
  };
  const from = join(home, `profile-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(from, JSON.stringify(starter, null, 2));
  await mkdir(projects, { recursive: true });
  const run = await cli(['setup', '--from', from, '--projects-dir', projects, '--yes'], home);
  expect(run.code).toBe(0);
  return run;
}

function globalSkill(home: string, name: string): string {
  return join(home, '.claude', 'skills', name, 'SKILL.md');
}

function targetSkill(root: string, name: string): string {
  return join(root, '.claude', 'skills', name, 'SKILL.md');
}

/** A global copy as an older run wrote it: stamped, so `leftovers` may remove it. */
async function seedGlobal(home: string, name: string, body = `# ${name}\n`): Promise<void> {
  await mkdir(join(home, '.claude', 'skills', name), { recursive: true });
  await writeFile(globalSkill(home, name), `${stampLine(STAMP)}\n${body}`);
}

const CODE: Answers = { workKind: 'code' };
const NON_CODE: Answers = { workKind: 'non-code' };

describe('each target reads a body rendered from its own context (D1, F7)', () => {
  /** Plans two git targets in one run, with `$HOME` pointed at a temp home. */
  async function planTwo(home: string): Promise<PlannedFile[]> {
    const saved = process.env.HOME;
    process.env.HOME = home;
    try {
      const answers: Answers = {
        ...DEFAULT_ANSWERS,
        workKind: 'code',
        skills: 'all',
        archiveHome: '',
      };
      const repos = (['folders', 'ledger'] as const).map((workProfile) =>
        testRepoPlan({
          workProfile,
          scan: testScan({ name: workProfile, path: join(home, workProfile) }),
        }),
      );
      const changes = await planEverything(testConfig({ answers }), answers, repos);
      return changes.map((change) => change.file);
    } finally {
      process.env.HOME = saved;
    }
  }

  test('a folders target and a ledger target in one run each get their own /close-out', async () => {
    const home = await freshHome();
    try {
      const files = await planTwo(home);
      const body = (path: string) => files.find((f) => f.path === path)?.contents ?? '';
      const folders = body(targetSkill(join(home, 'folders'), 'close-out'));
      const ledger = body(targetSkill(join(home, 'ledger'), 'close-out'));

      expect(folders).toContain('**The phase header**');
      expect(ledger).not.toContain('**The phase header**');
      expect(ledger).toContain('A `## Close-out, <date>` section');
      for (const name of TRACK_SKILLS) {
        expect(files.some((f) => f.path === join(claudeSkillsDir(), name, 'SKILL.md'))).toBe(
          false,
        );
      }
    } finally {
      await cleanup(home);
    }
  });
});

describe('a setup run with a target', () => {
  test(
    'writes both skills into the target and removes the old global copies',
    async () => {
      const home = await freshHome();
      try {
        const { projects, repo } = await projectsWithRepo(home);
        for (const name of TRACK_SKILLS) await seedGlobal(home, name);

        const run = await setup(home, projects, CODE);
        expect(run.stdout).toContain(`skill — /close-out ${GONE}`);
        expect(run.stdout).toContain(`skill — /handoff ${GONE}`);
        for (const name of TRACK_SKILLS) {
          expect(await exists(globalSkill(home, name))).toBe(false);
          expect(await exists(targetSkill(repo, name))).toBe(true);
        }
        expect(await readText(targetSkill(repo, 'close-out'))).toContain(
          'in the same commit as the code',
        );
      } finally {
        await cleanup(home);
      }
    },
    CLI_TIMEOUT,
  );

  test(
    'a non-code run after a code run changes the target copy and adds nothing global',
    async () => {
      const home = await freshHome();
      try {
        const { projects, repo } = await projectsWithRepo(home);
        await setup(home, projects, CODE);
        await setup(home, projects, NON_CODE);

        const closeOut = await readText(targetSkill(repo, 'close-out'));
        expect(closeOut).toContain('in the same commit as the work');
        expect(closeOut).not.toContain('in the same commit as the code');
        for (const name of TRACK_SKILLS)
          expect(await exists(globalSkill(home, name))).toBe(false);
      } finally {
        await cleanup(home);
      }
    },
    CLI_TIMEOUT,
  );

  test(
    'the untracked target keeps both skill folders out of git (D3)',
    async () => {
      const home = await freshHome();
      try {
        const { projects, repo } = await projectsWithRepo(home);
        await setup(home, projects, CODE);
        const exclude = await readText(join(repo, '.git', 'info', 'exclude'));
        expect(exclude).toContain('/.claude/skills/close-out/\n');
        expect(exclude).toContain('/.claude/skills/handoff/\n');
      } finally {
        await cleanup(home);
      }
    },
    CLI_TIMEOUT,
  );

  test(
    'doctor finds each target copy current, because it reproduces it from its stamp',
    async () => {
      const home = await freshHome();
      try {
        const { projects, repo } = await projectsWithRepo(home);
        await setup(home, projects, CODE);
        const run = await cli(['doctor', repo], home);
        expect(run.stdout).not.toContain('close-out/SKILL.md');
        expect(run.stdout).not.toContain('handoff/SKILL.md');
      } finally {
        await cleanup(home);
      }
    },
    CLI_TIMEOUT,
  );
});

describe('what is outside a target (D4)', () => {
  test(
    'a run with no target removes the global copies and writes neither skill',
    async () => {
      const home = await freshHome();
      try {
        for (const name of TRACK_SKILLS) await seedGlobal(home, name);
        await setup(home, join(home, 'empty'), CODE);
        for (const name of TRACK_SKILLS) {
          expect(await exists(globalSkill(home, name))).toBe(false);
          // A context with no target must not fall back to a relative path (PLAN watch-for).
          expect(await exists(targetSkill(repoRoot(), name))).toBe(false);
        }
      } finally {
        await cleanup(home);
      }
    },
    CLI_TIMEOUT,
  );

  test(
    'an adapted global copy is kept, and the preview names it (PLAN BD-3)',
    async () => {
      const home = await freshHome();
      try {
        const { projects, repo } = await projectsWithRepo(home);
        await seedGlobal(home, 'close-out');
        const adapted = markAdapted(await readText(globalSkill(home, 'close-out')), '');
        await writeFile(globalSkill(home, 'close-out'), adapted);

        const run = await setup(home, projects, CODE);
        expect(run.stdout).not.toContain(`/close-out ${GONE}`);
        expect(run.stdout).toContain('hides the copy this run writes into every folder');
        expect(run.stdout).toContain('~/.claude/skills/close-out/SKILL.md');
        expect(await readText(globalSkill(home, 'close-out'))).toBe(adapted);
        expect(await exists(targetSkill(repo, 'close-out'))).toBe(true);
      } finally {
        await cleanup(home);
      }
    },
    CLI_TIMEOUT,
  );

  test(
    'without an adapted copy the preview says nothing about one',
    async () => {
      const home = await freshHome();
      try {
        const { projects } = await projectsWithRepo(home);
        const run = await setup(home, projects, CODE);
        expect(run.stdout).not.toContain('hides the copy');
      } finally {
        await cleanup(home);
      }
    },
    CLI_TIMEOUT,
  );

  test(
    'init writes both skills inside its folder and nothing under ~/.claude (P6)',
    async () => {
      const home = await freshHome();
      try {
        // `init` refuses until one `setup` has saved the person's answers.
        await setup(home, join(home, 'empty'), CODE);
        const folder = join(home, 'notes');
        await mkdir(folder);
        await writeFile(join(folder, 'draft.md'), '# Draft\n');
        await writeFile(
          join(folder, '.personal-config.json'),
          JSON.stringify({ answers: { workKind: 'non-code', skills: 'all' } }),
        );

        const run = await cli(['init', folder, '--yes'], home);
        expect(run.code).toBe(0);
        for (const name of TRACK_SKILLS) {
          expect(await exists(targetSkill(folder, name))).toBe(true);
          expect(await exists(globalSkill(home, name))).toBe(false);
        }
        expect(await readText(targetSkill(folder, 'close-out'))).toContain(
          'in the same commit as the work',
        );
      } finally {
        await cleanup(home);
      }
    },
    CLI_TIMEOUT,
  );
});

describe('the ignore lines follow what the target can hold (D3, BD-2)', () => {
  const answers: Answers = { ...DEFAULT_ANSWERS, workKind: 'code', skills: 'all' };

  function ignoreFile(files: PlannedFile[]): PlannedFile | undefined {
    return files.find((f) => f.path.endsWith('.gitignore') || f.path.endsWith('exclude'));
  }

  test('a folder gets the skills and no ignore file', async () => {
    const plan = testRepoPlan({
      trackMode: 'n/a',
      scan: testScan({ kind: 'folder', path: '/tmp/folder' }),
    });
    const files = await renderAll(testContext(answers, plan));
    expect(files.map((f) => f.path)).toContain(targetSkill('/tmp/folder', 'close-out'));
    expect(ignoreFile(files)).toBeUndefined();
  });

  test('usesGit: no gets the skills and no ignore file', async () => {
    const files = await renderAll(testContext({ ...answers, usesGit: 'no' }, testRepoPlan()));
    expect(files.map((f) => f.path)).toContain(targetSkill('/tmp/example', 'handoff'));
    expect(ignoreFile(files)).toBeUndefined();
  });

  test('a tracked repo keeps them out by .gitignore, and the hidden-file warning skips them', async () => {
    const files = await renderAll(testContext(answers, testRepoPlan()));
    expect(ignoreFile(files)?.contents).toContain('/.claude/skills/close-out/\n');
    const tracked = meantToBeTracked('/tmp/example', files);
    expect(tracked).toContain('CLAUDE.md');
    expect(tracked.some((path) => path.startsWith('.claude/skills/'))).toBe(false);
  });

  test('skills: none writes neither skill and no ignore line for them', async () => {
    const files = await renderAll(testContext({ ...answers, skills: 'none' }, testRepoPlan()));
    expect(files.some((f) => f.path.includes('.claude/skills/'))).toBe(false);
    expect(ignoreFile(files)?.contents ?? '').not.toContain('.claude/skills');
  });
});

/**
 * D2's guard: only `/close-out` and `/handoff` may change body between the tracks. A third skill
 * that starts to differ fails here, which is the signal to move it per target by a new item.
 */
describe('the track-dependent set is two skills (D2)', () => {
  function unstamped(contents: string): string {
    return contents
      .split('\n')
      .filter((line) => !line.includes('personal-config v'))
      .join('\n');
  }

  test('every skill both tracks render, other than the two, has one body', async () => {
    const base: Answers = { ...DEFAULT_ANSWERS, configWeight: 'full', skills: 'all' };
    const render = async (workKind: string) =>
      everySkill(testContext({ ...base, workKind }, testRepoPlan()));
    const [code, nonCode] = await Promise.all([render('code'), render('non-code')]);

    const differs = code
      .filter((file) => !TRACK_SKILLS.some((name) => file.path.endsWith(`/${name}/SKILL.md`)))
      .filter((file) => {
        const other = nonCode.find((f) => f.path === file.path);
        return other !== undefined && unstamped(other.contents) !== unstamped(file.contents);
      })
      .map((file) => file.path);
    expect(differs).toEqual([]);
    for (const name of TRACK_SKILLS) {
      const path = targetSkill('/tmp/example', name);
      const a = code.find((f) => f.path === path)?.contents ?? '';
      const b = nonCode.find((f) => f.path === path)?.contents ?? '';
      expect(unstamped(a)).not.toBe(unstamped(b));
    }
  });
});
