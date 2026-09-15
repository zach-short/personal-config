/**
 * The stamp's config hash has to be reproducible by a later `doctor` run from what is on disk,
 * or the first thing a freshly configured repo does is tell its owner to re-run the setup they
 * have just run. That happened for every repo until 2026-09-15; these tests are the guard.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { configHash, hashedAnswers } from '../src/lib/config.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir, testConfig } from './helpers.ts';
import { makeFixtures } from './make-fixtures.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

async function cli(args: string[], home: string): Promise<{ code: number; stdout: string }> {
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

type Rendered = { home: string; projects: string; repo: string };

/** Run `setup` the way a person would, and hand back the repo it configured. */
async function render(profile: string): Promise<Rendered> {
  const home = await tempDir('pc-home-');
  const projects = await tempDir('pc-projects-');
  await makeFixtures(projects);

  const args = ['setup', '--profile', profile, '--yes', '--projects-dir', projects];
  const result = await cli(args, home);
  expect(result.code).toBe(0);

  const repo = await configuredRepo(projects);
  return { home, projects, repo };
}

/** `--yes` configures one repo; which one is discovery's business, not this test's. */
async function configuredRepo(projects: string): Promise<string> {
  const names = await readdir(projects);
  for (const name of names) {
    const dir = join(projects, name);
    if (await Bun.file(join(dir, '.personal-config.json')).exists()) return dir;
  }
  throw new Error(`setup configured no repo under ${projects}`);
}

async function savedAnswers(repo: string): Promise<Record<string, unknown>> {
  const parsed = (await Bun.file(join(repo, '.personal-config.json')).json()) as {
    answers?: Record<string, unknown>;
  };
  return parsed.answers ?? {};
}

async function writeAnswer(repo: string, key: string, value: string): Promise<void> {
  const path = join(repo, '.personal-config.json');
  const parsed = (await Bun.file(path).json()) as { answers: Record<string, unknown> };
  parsed.answers[key] = value;
  await Bun.write(path, `${JSON.stringify(parsed, null, 2)}\n`);
}

async function driftCount(repo: string, home: string, args: string[] = []): Promise<number> {
  const result = await cli(['doctor', ...args, repo], home);
  // A run that died before reading anything reports zero of every rule, which would read as a
  // pass. Assert it actually looked at the repo before trusting a zero.
  expect(result.stdout).toContain('markdown file(s) checked');
  return result.stdout.split('\n').filter((line) => line.includes('stamp-drift')).length;
}

/**
 * The `starter` profile has an empty archive home, so it cannot catch a `<repo>` placeholder
 * being hashed unresolved — which is exactly the bug that survived the first fix. A profile
 * with a real archive home is the one worth running the whole way through.
 */
describe('a repo `setup` just rendered', () => {
  let rendered: Rendered;

  beforeAll(async () => {
    rendered = await render('zach');
  });

  afterAll(async () => {
    await cleanup(rendered.home);
    await cleanup(rendered.projects);
  });

  test('reports no drift the first time `doctor` is run on it', async () => {
    expect(await driftCount(rendered.repo, rendered.home)).toBe(0);
  });

  test('is judged the same without the `--profile` it was rendered with', async () => {
    expect(await driftCount(rendered.repo, rendered.home, ['--profile', 'starter'])).toBe(0);
  });

  test('saves the answers the hash covers, and none of the ones it does not', async () => {
    const answers = await savedAnswers(rendered.repo);
    expect(answers['practices.comments']).toBe('why-only');
    expect(answers.projectsDir).toBeUndefined();
    expect(answers['models.deep']).toBeUndefined();
  });

  test('drifts once a saved answer genuinely changes, and stops when it is put back', async () => {
    await writeAnswer(rendered.repo, 'practices.comments', 'none');
    expect(await driftCount(rendered.repo, rendered.home)).toBeGreaterThan(0);

    await writeAnswer(rendered.repo, 'practices.comments', 'why-only');
    expect(await driftCount(rendered.repo, rendered.home)).toBe(0);
  });
});

describe('a repo rendered from the neutral profile', () => {
  test('reports no drift either', async () => {
    const rendered = await render('starter');
    try {
      expect(await driftCount(rendered.repo, rendered.home)).toBe(0);
    } finally {
      await cleanup(rendered.home);
      await cleanup(rendered.projects);
    }
  });
});

describe('what the hash covers', () => {
  test('the directory `setup` was pointed at does not move it', async () => {
    const a = testConfig({
      answers: { 'practices.types': 'strict', projectsDir: '~/Projects' },
    });
    const b = testConfig({
      answers: { 'practices.types': 'strict', projectsDir: '/srv/code' },
    });
    expect(await configHash(a)).toBe(await configHash(b));
  });

  test('the `models.*` answers do not move it on their own — the tiers already do', async () => {
    const a = testConfig({ answers: { 'models.default': 'Opus 5' } });
    const b = testConfig({ answers: { 'models.default': 'Something Else' } });
    expect(await configHash(a)).toBe(await configHash(b));

    const tiers = testConfig({ models: { deep: 'A', default: 'B', fast: 'C' } });
    expect(await configHash(tiers)).not.toBe(await configHash(testConfig()));
  });

  test('a resolved archive home is not the same config as the template it came from', async () => {
    const template = testConfig({ archiveHome: '~/Projects/archive/<repo>' });
    const resolved = testConfig({ archiveHome: '~/Projects/archive/leaf' });
    expect(await configHash(template)).not.toBe(await configHash(resolved));
  });
});

describe('hashedAnswers', () => {
  test('drops exactly the four keys nothing is rendered from', () => {
    const kept = hashedAnswers({
      projectsDir: '~/Projects',
      'models.deep': 'Fable 5.1',
      'models.default': 'Opus 5',
      'models.fast': 'Sonnet 5',
      'practices.comments': 'why-only',
    });
    expect(Object.keys(kept)).toEqual(['practices.comments']);
  });

  test('sorts, so two runs that answered the same in a different order agree', () => {
    const one = hashedAnswers({ b: '2', a: '1' });
    const two = hashedAnswers({ a: '1', b: '2' });
    expect(Object.keys(one)).toEqual(['a', 'b']);
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
  });
});
