/**
 * `personal-config upgrade` (upgrade-command `DESIGN.md` D1–D4). The slice is the part a reader
 * would not catch — a missing middle version reads as a complete answer — so it is pinned against
 * the shipped changelog and against one fixture per way a slicer goes wrong (X1). The rest runs
 * the real bin, each run with its own `$HOME` (X2): the dials the row names — a short-track target
 * gets one line (DIAL-5), a stamp newer than installed stops (DIAL-2) — and H5, that the prompt
 * `--write` leaves behind is one `doctor` has nothing failing to say about.
 */
import { describe, expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { entriesBetween, parseChangelog } from '../src/lib/changelog.ts';
import { scanRepo } from '../src/lib/discover.ts';
import { exists, readText, writeText } from '../src/lib/disk.ts';
import { isGitRepo, isIgnored } from '../src/lib/git.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { compareVersions } from '../src/lib/semver.ts';
import { readStamp, stampLine } from '../src/lib/stamp.ts';
import { assess, isFailure } from '../src/lib/upgrade.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { renderAll } from '../src/render/index.ts';
import { standardVersion } from '../src/render/standard.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testContext, testRepoPlan } from './helpers.ts';
import { makeFixtures } from './make-fixtures.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');
const SHIPPED = join(repoRoot(), 'standard', 'CHANGELOG.md');

type Run = { code: number; stdout: string };

async function bin(args: string[], home: string): Promise<Run> {
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

/** An adapted standard at `version`, in the shape §0.7 leaves one: header, then Part 1. */
async function adaptedRepo(dir: string, version: string): Promise<string> {
  const path = join(dir, 'docs', 'AGENT-PRACTICES.md');
  const stamp = stampLine({
    version: '0.5.0',
    date: '2026-09-23',
    configHash: '00000000',
    standardVersion: version,
    adapted: true,
  });
  await writeText(
    path,
    `${stamp}\n# Agent working standard — leaflet\n\n**Adapted to this repo 2026-09-14, solo mode.**\n\n# Part 1 — The rules that hold everywhere\n\nR1 holds.\n`,
  );
  return path;
}

/** What `upgrade` printed for one root, the root's own header line excluded. */
function linesAfterRoot(stdout: string): string[] {
  return stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .slice(1);
}

async function withDirs(run: (dir: string, home: string) => Promise<void>): Promise<void> {
  const dir = await tempDir('pc-upgrade-');
  const home = await tempDir('pc-home-');
  try {
    await run(dir, home);
  } finally {
    await cleanup(dir);
    await cleanup(home);
  }
}

describe('parseChangelog, on the changelog this package ships', () => {
  test('every entry, newest first, the installed one on top, and the preamble is not one', async () => {
    const versions = parseChangelog(await readText(SHIPPED)).map((e) => e.version);
    expect(versions[0]).toBe(await standardVersion());
    expect(versions.slice(-6)).toEqual(['1.2.0', '1.1.0', '1.0.3', '1.0.2', '1.0.1', '1.0.0']);
    const sorted = [...versions].sort((a, b) => compareVersions(b, a) ?? 0);
    expect(versions).toEqual(sorted);
  });

  test('a body stops at the next heading and carries no blank edges', async () => {
    const entries = parseChangelog(await readText(SHIPPED));
    const body = entries.find((e) => e.version === '1.0.3')?.body ?? '';
    expect(body).not.toContain('## 1.0.2');
    expect(body.startsWith('\n')).toBe(false);
    expect(body.endsWith('\n')).toBe(false);
    expect(body.length).toBeGreaterThan(0);
  });
});

describe('entriesBetween — exactly the entries between two versions', () => {
  test('on the shipped changelog: after the stamped version, up to the installed one', async () => {
    const entries = parseChangelog(await readText(SHIPPED));
    const versions = (from: string, to: string) =>
      entriesBetween(entries, from, to).map((e) => e.version);
    expect(versions('1.0.2', '1.2.0')).toEqual(['1.2.0', '1.1.0', '1.0.3']);
    expect(versions('1.0.0', '1.2.0')).toEqual(['1.2.0', '1.1.0', '1.0.3', '1.0.2', '1.0.1']);
    expect(versions('1.1.0', '1.2.0')).toEqual(['1.2.0']);
    expect(versions('1.2.0', '1.2.0')).toEqual([]);
  });

  /** Every way a slicer goes wrong, in one changelog. Each test below names the one it pins. */
  const HOSTILE = [
    '# Changelog',
    '',
    'A preamble that mentions ## 0.0.1 — 2026-01-01 mid-line.',
    '',
    '## Unreleased',
    '',
    '- not a release',
    '',
    '## 2.0.0 — 2026-10-01',
    '',
    '- beyond what is installed',
    '',
    '## 1.10.0 — 2026-09-30',
    '',
    '- ten',
    '',
    '```md',
    '## 9.9.9 — 2026-01-01',
    '```',
    '',
    '## 1.9.0 — 2026-09-29',
    '',
    '- nine',
    '',
    '## 1.2.0 — 2026-09-23',
    '',
    '- two',
    '',
  ].join('\n');

  const entries = parseChangelog(HOSTILE);
  const between = entriesBetween(entries, '1.2.0', '1.10.0');

  test('violates a naive slicer: a heading of another shape is not an entry and ends the one above', () => {
    expect(entries.map((e) => e.version)).not.toContain('Unreleased');
    expect(entries.some((e) => e.body.includes('not a release'))).toBe(false);
  });

  test('violates a naive slicer: a heading inside a fence is the body, not a new entry', () => {
    expect(entries.map((e) => e.version)).not.toContain('9.9.9');
    expect(entries.find((e) => e.version === '1.10.0')?.body).toContain('## 9.9.9');
  });

  test('violates a string sort: 1.10.0 is newer than 1.9.0', () => {
    expect(between.map((e) => e.version)).toEqual(['1.10.0', '1.9.0']);
  });

  test('violates an inclusive lower bound: the stamped version is already applied', () => {
    expect(between.map((e) => e.version)).not.toContain('1.2.0');
  });

  test('violates an open upper bound: an entry above what is installed is not offered', () => {
    expect(between.map((e) => e.version)).not.toContain('2.0.0');
  });
});

describe('assess', () => {
  const entries = parseChangelog('## 1.1.0 — 2026-09-19\n\n- one\n\n## 1.0.0 — 2026-09-15\n');

  test('each verdict, and which of them fail', () => {
    expect(assess('1.1.0', '1.1.0', entries).kind).toBe('current');
    expect(assess('1.0.0', '1.1.0', entries)).toMatchObject({ kind: 'behind', from: '1.0.0' });
    expect(assess('2.0.0', '1.1.0', entries).kind).toBe('ahead');
    expect(assess('unknown', '1.1.0', entries).kind).toBe('unnamed');
    expect(assess('1.x', '1.1.0', entries).kind).toBe('unreadable');

    const failing = ['1.1.0', '1.0.0', '2.0.0', 'unknown', '1.x'].filter((v) =>
      isFailure(assess(v, '1.1.0', entries)),
    );
    expect(failing).toEqual(['2.0.0', '1.x']);
  });
});

describe('the bin', () => {
  test('behind: the gap, then exactly the entries between, newest first — and no write', async () => {
    await withDirs(async (dir, home) => {
      await adaptedRepo(dir, '1.0.2');
      const run = await bin(['upgrade', dir], home);
      expect(run.code).toBe(0);
      expect(run.stdout).toContain('adapted from standard v1.0.2');

      // Derived from the shipped changelog so the next standard release does not break it; the
      // two oldest are pinned, because they are the bound this test exists for.
      const shipped = parseChangelog(await readText(SHIPPED));
      const expected = entriesBetween(shipped, '1.0.2', await standardVersion()).map(
        (e) => `## ${e.version} — ${e.date}`,
      );
      const headings = run.stdout.split('\n').filter((line) => /^## \d/.test(line));
      expect(headings).toEqual(expected);
      expect(headings.slice(-2)).toEqual(['## 1.1.0 — 2026-09-19', '## 1.0.3 — 2026-09-16']);
      expect(run.stdout).toContain('covers the adapted standard only');
      expect(run.stdout).toContain('--write');
      expect(await exists(join(dir, 'UPGRADE-PROMPT.md'))).toBe(false);
    });
  });

  test('current: one line saying there is nothing to do, exit 0', async () => {
    await withDirs(async (dir, home) => {
      await adaptedRepo(dir, await standardVersion());
      const run = await bin(['upgrade', dir], home);
      expect(run.code).toBe(0);
      expect(run.stdout).toContain('Nothing to do.');
      expect(run.stdout).not.toMatch(/^## \d/m);
    });
  });

  test('DIAL-5: a short-track target gets one line and exit 0', async () => {
    await withDirs(async (dir, home) => {
      const scan = await scanRepo(dir, 'folder');
      const answers = {
        ...DEFAULT_ANSWERS,
        workKind: 'non-code',
        configWeight: 'light',
        usesGit: 'no',
        proofLine: 'the totals agree with the source table',
      };
      const ctx = testContext(answers, testRepoPlan({ scan, trackMode: 'n/a' }));
      const files = (await renderAll(ctx)).filter((f) => f.path.startsWith(dir));
      await commitPlan(await resolvePlan(files));
      expect(readStamp(await readText(join(dir, 'docs', 'AGENT-PRACTICES.md')))).not.toBeNull();

      const run = await bin(['upgrade', dir], home);
      expect(run.code).toBe(0);
      const lines = linesAfterRoot(run.stdout);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('No adapted standard here');
      expect(lines[0]).toContain('re-running `setup`');
    });
  });

  test('DIAL-5: a directory never set up gets one line and exit 0', async () => {
    await withDirs(async (dir, home) => {
      const run = await bin(['upgrade', dir], home);
      expect(run.code).toBe(0);
      expect(linesAfterRoot(run.stdout)).toHaveLength(1);
      expect(run.stdout).toContain('No adapted standard here');
    });
  });

  test('DIAL-5: an adaptation from before the marker gets one line naming `doctor --fix`', async () => {
    await withDirs(async (dir, home) => {
      const standard = await adaptedRepo(dir, '1.0.2');
      const text = await readText(standard);
      await writeText(standard, text.slice(text.indexOf('\n') + 1));
      expect(readStamp(await readText(standard))).toBeNull();

      const run = await bin(['upgrade', dir], home);
      expect(run.code).toBe(0);
      const lines = linesAfterRoot(run.stdout);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('docs/AGENT-PRACTICES.md was adapted by Part 0');
      expect(lines[0]).toContain('`personal-config doctor --fix`');
    });
  });

  test('DIAL-2: a stamp newer than installed reports, names the package update, and stops', async () => {
    await withDirs(async (dir, home) => {
      await adaptedRepo(dir, '9.0.0');
      const run = await bin(['upgrade', '--write', dir], home);
      expect(run.code).toBe(1);
      expect(run.stdout).toContain('newer than');
      expect(run.stdout).toContain('Update the package');
      expect(run.stdout).not.toMatch(/^## \d/m);
      expect(await exists(join(dir, 'UPGRADE-PROMPT.md'))).toBe(false);
    });
  });

  test('--dry-run with --write writes nothing', async () => {
    await withDirs(async (dir, home) => {
      await adaptedRepo(dir, '1.0.2');
      const run = await bin(['upgrade', '--write', '--dry-run', dir], home);
      expect(run.code).toBe(0);
      expect(run.stdout).toContain('--dry-run: nothing was written.');
      expect(await readdir(dir)).toEqual(['docs']);
    });
  });

  test('--write refuses a UPGRADE-PROMPT.md this tool did not write, and leaves it alone', async () => {
    await withDirs(async (dir, home) => {
      await adaptedRepo(dir, '1.0.2');
      const mine = join(dir, 'UPGRADE-PROMPT.md');
      await writeText(mine, '# my own notes\n');
      const run = await bin(['upgrade', '--write', dir], home);
      expect(run.code).toBe(1);
      expect(run.stdout).toContain('this tool did not write it');
      expect(await readText(mine)).toBe('# my own notes\n');
    });
  });

  test('--write never edits the adapted document (DIAL-7), and a second run is a no-op', async () => {
    await withDirs(async (dir, home) => {
      const standard = await adaptedRepo(dir, '1.0.2');
      const before = await readText(standard);
      expect((await bin(['upgrade', '--write', dir], home)).code).toBe(0);
      expect(await readText(standard)).toBe(before);

      const again = await bin(['upgrade', '--write', dir], home);
      expect(again.code).toBe(0);
      expect(again.stdout).toContain('already says this');
    });
  });
});

describe('H5 — the prompt --write leaves passes doctor in the repo it lands in', () => {
  test('a repo set up for real, its standard adapted at 1.0.2: prompt, ignore line, nothing failing', async () => {
    const home = await tempDir('pc-home-');
    const projects = await tempDir('pc-projects-');
    try {
      await makeFixtures(projects);
      const setup = await bin(
        ['setup', '--profile', 'starter', '--yes', '--projects-dir', projects],
        home,
      );
      expect(setup.code).toBe(0);
      const repo = await configuredRepo(projects);
      const standard = join(repo, await recordedStandardPath(repo));

      const installed = await standardVersion();
      const text = await readText(standard);
      expect(readStamp(text)?.standardVersion).toBe(installed);
      await writeText(
        standard,
        text.replace(`standard v${installed} -->`, 'standard v1.0.2 · adapted -->'),
      );

      const upgrade = await bin(['upgrade', '--write', repo], home);
      expect(upgrade.code).toBe(0);

      const prompt = await readText(join(repo, 'UPGRADE-PROMPT.md'));
      expect(readStamp(prompt)).toMatchObject({ standardVersion: installed, adapted: false });
      expect(prompt).toContain('### 1.1.0 — 2026-09-19');
      expect(prompt).not.toContain('### 1.0.2 —');
      expect(await isGitRepo(repo)).toBe(true);
      expect(await isIgnored(repo, 'UPGRADE-PROMPT.md')).toBe(true);

      const doctor = await bin(['doctor', repo], home);
      expect(doctor.stdout).toContain('markdown file(s) checked');
      const failing = doctor.stdout
        .split('\n')
        .filter((line) => line.startsWith('  /') && !line.endsWith('(advisory)'));
      expect(failing).toEqual([]);
      expect(doctor.stdout).not.toContain('UPGRADE-PROMPT.md:');
      expect(doctor.code).toBe(0);
    } finally {
      await cleanup(home);
      await cleanup(projects);
    }
  });
});

/** `--yes` configures what discovery found; which repo is its business, not this test's. */
async function configuredRepo(projects: string): Promise<string> {
  for (const name of await readdir(projects)) {
    const dir = join(projects, name);
    if (await exists(join(dir, '.personal-config.json'))) return dir;
  }
  throw new Error(`setup configured no repo under ${projects}`);
}

async function recordedStandardPath(repo: string): Promise<string> {
  const parsed = JSON.parse(await readText(join(repo, '.personal-config.json'))) as {
    standardPath?: string;
  };
  if (!parsed.standardPath) throw new Error('setup recorded no standardPath');
  return parsed.standardPath;
}
