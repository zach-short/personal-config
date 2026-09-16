import { describe, expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readMore } from '../src/lib/ask.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { ALL_QUESTIONS, PRACTICE_AREAS, readMoreIds } from '../src/questions/index.ts';
import { cleanup, tempDir } from './helpers.ts';
import { makeFixtures } from './make-fixtures.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

async function run(args: string[], env: Record<string, string> = {}) {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd: repoRoot(),
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { code: await proc.exited, stdout, stderr };
}

describe('--dry-run', () => {
  test('previews the tree and writes nothing at all', async () => {
    const fixtures = await makeFixtures();
    const home = await tempDir('pc-home-');
    try {
      const result = await run(
        ['setup', '--profile', 'zach', '--yes', '--dry-run', '--projects-dir', fixtures],
        { HOME: home },
      );

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('This run would write:');
      expect(result.stdout).toContain('--dry-run: nothing was written.');

      // The only thing in the sandbox home should be nothing.
      const left = await readdir(home).catch(() => []);
      expect(left).toEqual([]);
    } finally {
      await cleanup(home);
    }
  });

  test('the ownership guard forces untracked mode on a repo that is not yours', async () => {
    const fixtures = await makeFixtures();
    const home = await tempDir('pc-home-');
    try {
      const result = await run(
        ['setup', '--profile', 'zach', '--yes', '--dry-run', '--projects-dir', fixtures],
        { HOME: home },
      );
      // bun-monorepo's remote owner is `fixture-owner`, which is nobody's login here.
      expect(result.stdout).toContain('untracked mode');
      expect(result.stdout).toContain('CLAUDE.local.md');
      expect(result.stdout).not.toMatch(/^\s+CLAUDE\.md\s/m);
    } finally {
      await cleanup(home);
    }
  });
});

describe('help and version', () => {
  test('a bare invocation prints help rather than doing anything', async () => {
    const result = await run([]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('personal-config setup');
    // The claim is load-bearing, so it is asserted with its one exception rather than without:
    // `--from <url|id>` fetches, and a promise that no longer holds is worse than none.
    expect(result.stdout).toContain('Nothing leaves your machine');
    expect(result.stdout).toContain('--from <url|id> is the one exception');
  });

  test('--version prints the package version', async () => {
    const result = await run(['--version']);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('the question catalog', () => {
  test('every question has a long form that exists and is not a stub', async () => {
    for (const id of readMoreIds()) {
      const text = await readMore(id);
      expect(text).not.toContain('No long form written yet');
      expect(text.length).toBeGreaterThan(400);
    }
  });

  test('every long form covers what the option does and how to undo it', async () => {
    for (const id of readMoreIds()) {
      const text = (await readMore(id)).toLowerCase();
      expect(text).toContain('undo');
    }
  });

  test('every choice question has a recommended option, first', () => {
    const choices = ALL_QUESTIONS.filter((q) => q.options && q.options.length > 2);
    for (const question of choices) {
      const recommended = question.options?.findIndex((o) => o.recommended === true);
      expect(recommended).toBe(0);
    }
  });

  test('every option carries a practical example', () => {
    for (const question of ALL_QUESTIONS) {
      for (const option of question.options ?? []) {
        expect(option.example.length).toBeGreaterThan(10);
      }
    }
  });

  test('every conventions area renders a rule for a language it claims to cover', () => {
    const areas = PRACTICE_AREAS.filter((a) => a.target === 'conventions');
    for (const area of areas) {
      const languages = area.languages.length > 0 ? area.languages : ['typescript'];
      const value = area.question.options?.[0]?.value ?? 'none';
      for (const language of languages) {
        expect(area.rule(value, language)).not.toBeNull();
      }
    }
  });

  test('answering "none" in any area renders no rule at all', () => {
    for (const area of PRACTICE_AREAS) {
      expect(area.rule('none', 'typescript')).toBeNull();
      expect(area.policy?.('none') ?? null).toBeNull();
    }
  });

  test('every policy area renders a Part 11 paragraph', () => {
    const areas = PRACTICE_AREAS.filter((a) => a.target === 'policy');
    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) {
      const value = area.question.options?.[0]?.value ?? 'none';
      expect(area.policy?.(value) ?? null).not.toBeNull();
    }
  });
});

describe('the engine carries no personal strings', () => {
  test('grep for a name across src, templates and standard', async () => {
    const proc = Bun.spawn(['grep', '-rni', 'zach', 'src/', 'templates/', 'standard/'], {
      cwd: repoRoot(),
      stdout: 'pipe',
      stderr: 'ignore',
    });
    const out = await new Response(proc.stdout).text();
    expect(out.trim()).toBe('');
  });
});
