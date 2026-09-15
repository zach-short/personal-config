import { describe, expect, test } from 'bun:test';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

const INDEX = [
  '# archive — index',
  '',
  'Legend: ✅ closed/shipped',
  '',
  '## Closed',
  '',
  '- **older-thing/** ✅ — an earlier one. Closed 2026-08-01, last commit `aaa1111`.',
  '',
].join('\n');

const DOCS_INDEX = [
  '# docs',
  '',
  '## Open',
  '',
  '- `incomplete/week-grid/` — the drag work, opened 2026-09-01.',
  '- `incomplete/other/` — something else.',
  '',
].join('\n');

type Setup = { extra?: Record<string, string>; commit?: boolean; index?: string | null };

/**
 * A real `git init` and a real commit: every step this command automates is a git read, and a
 * `.git` holding only `HEAD` makes git walk up and answer for the parent repo instead.
 */
async function world(options: Setup = {}) {
  const dir = await tempDir('pc-archive-');
  const repo = join(dir, 'repo');
  const archive = join(dir, 'archive');
  await mkdir(join(repo, 'docs', 'incomplete', 'week-grid'), { recursive: true });
  await mkdir(archive, { recursive: true });

  await writeFile(
    join(repo, 'docs/incomplete/week-grid/SCOPE.md'),
    '# Week grid — drag to edit\n',
  );
  await writeFile(join(repo, 'docs/incomplete/week-grid/PLAN.md'), '# Plan\n');
  await writeFile(join(repo, 'docs/README.md'), DOCS_INDEX);
  await writeFile(
    join(repo, '.personal-config.json'),
    JSON.stringify({ archiveHome: archive }),
  );
  for (const [path, body] of Object.entries(options.extra ?? {})) {
    await mkdir(join(repo, path.slice(0, path.lastIndexOf('/'))), { recursive: true });
    await writeFile(join(repo, path), body);
  }
  if (options.index !== null)
    await writeFile(join(archive, 'INDEX.md'), options.index ?? INDEX);

  await git(repo, ['init', '--quiet', '--initial-branch=main']);
  await git(repo, ['config', 'user.email', 'test@example.com']);
  await git(repo, ['config', 'user.name', 'test']);
  if (options.commit !== false) {
    await git(repo, ['add', '-A']);
    await git(repo, ['commit', '--quiet', '-m', 'seed']);
  }
  return { dir, repo, archive };
}

async function git(cwd: string, args: string[]): Promise<void> {
  await Bun.spawn(['git', ...args], { cwd, stdout: 'ignore', stderr: 'ignore' }).exited;
}

async function run(cwd: string, args: string[]) {
  const home = await tempDir('pc-home-');
  try {
    const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
      cwd,
      env: { ...process.env, HOME: home },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    return { code: await proc.exited, stdout };
  } finally {
    await cleanup(home);
  }
}

describe('archive — the plan, before anything moves', () => {
  test('splits referrers into the kind that blocks and the kind that does not', async () => {
    const { dir, repo } = await world({
      extra: { '.github/workflows/ci.yml': 'run: ./check docs/incomplete/week-grid\n' },
    });
    try {
      const result = await run(repo, ['archive', 'week-grid']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('read at runtime — these block the move');
      expect(result.stdout).toContain('.github/workflows/ci.yml');
      expect(result.stdout).toContain('prose citations');
      expect(result.stdout).toContain('docs/README.md');
    } finally {
      await cleanup(dir);
    }
  });

  test('writes neither index line while the folder is still in the repo', async () => {
    const { dir, repo, archive } = await world();
    try {
      const result = await run(repo, ['archive', 'week-grid']);
      expect(result.stdout).toContain('Neither line is written yet');
      expect(await Bun.file(join(archive, 'INDEX.md')).text()).toBe(INDEX);
      expect(await Bun.file(join(repo, 'docs', 'README.md')).text()).toBe(DOCS_INDEX);
    } finally {
      await cleanup(dir);
    }
  });

  test('prints the two commit blocks when the folder is not committed (step 2)', async () => {
    const { dir, repo } = await world({ commit: false });
    try {
      const result = await run(repo, ['archive', 'week-grid']);
      expect(result.stdout).toContain('uncommitted change(s) under it');
      expect(result.stdout).toContain('git add docs/incomplete/week-grid');
      // The repo's settled ritual: both blocks name the files (HANDOFF 14).
      expect(result.stdout).toContain(
        'git commit docs/incomplete/week-grid -m "close out week-grid"',
      );
    } finally {
      await cleanup(dir);
    }
  });

  test('takes the topic from the doc’s own first heading', async () => {
    const { dir, repo } = await world();
    try {
      const result = await run(repo, ['archive', 'week-grid']);
      expect(result.stdout).toContain('Week grid — drag to edit');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('archive --move', () => {
  test('refuses while something reads the path at runtime', async () => {
    const { dir, repo } = await world({
      extra: { '.github/workflows/ci.yml': 'run: ./check docs/incomplete/week-grid\n' },
    });
    try {
      const result = await run(repo, ['archive', 'week-grid', '--move']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('--move refused');
      expect(await Bun.file(join(repo, 'docs/incomplete/week-grid/SCOPE.md')).exists()).toBe(
        true,
      );
    } finally {
      await cleanup(dir);
    }
  });

  test('refuses while the folder is uncommitted, because the repo would not record how it ended', async () => {
    const { dir, repo } = await world({ commit: false });
    try {
      const result = await run(repo, ['archive', 'week-grid', '--move']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('commit it first');
    } finally {
      await cleanup(dir);
    }
  });

  test('moves, verifies every file arrived, then writes both index lines', async () => {
    const { dir, repo, archive } = await world();
    try {
      const result = await run(repo, ['archive', 'week-grid', '--move']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('verified 2 file(s) arrived');

      expect(await Bun.file(join(archive, 'week-grid', 'SCOPE.md')).exists()).toBe(true);
      expect(await Bun.file(join(repo, 'docs/incomplete/week-grid/SCOPE.md')).exists()).toBe(
        false,
      );

      const index = await Bun.file(join(archive, 'INDEX.md')).text();
      expect(index).toContain('- **week-grid/** ✅ — Week grid — drag to edit.');
      expect(index).toMatch(/last commit `[0-9a-f]{7,}`/);
      expect(index.indexOf('older-thing')).toBeLessThan(index.indexOf('week-grid'));

      expect(await Bun.file(join(repo, 'docs', 'README.md')).text()).toContain('**Archived ');
    } finally {
      await cleanup(dir);
    }
  });

  test('--dry-run moves nothing and writes nothing', async () => {
    const { dir, repo, archive } = await world();
    try {
      const result = await run(repo, ['archive', 'week-grid', '--move', '--dry-run']);
      expect(result.stdout).toContain('nothing was moved');
      expect(await Bun.file(join(repo, 'docs/incomplete/week-grid/SCOPE.md')).exists()).toBe(
        true,
      );
      expect(await Bun.file(join(archive, 'INDEX.md')).text()).toBe(INDEX);
    } finally {
      await cleanup(dir);
    }
  });
});

describe('archive — the run after the move', () => {
  test('indexes a folder somebody moved by hand', async () => {
    const { dir, repo, archive } = await world();
    try {
      await rename(join(repo, 'docs/incomplete/week-grid'), join(archive, 'week-grid'));
      const result = await run(repo, ['archive', 'week-grid']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('already at');
      expect(await Bun.file(join(archive, 'INDEX.md')).text()).toContain('**week-grid/**');
    } finally {
      await cleanup(dir);
    }
  });

  test('still finds the last commit for a path the repo no longer has', async () => {
    const { dir, repo, archive } = await world();
    try {
      await rename(join(repo, 'docs/incomplete/week-grid'), join(archive, 'week-grid'));
      await run(repo, ['archive', 'week-grid']);
      expect(await Bun.file(join(archive, 'INDEX.md')).text()).not.toContain(
        'last commit `none`',
      );
    } finally {
      await cleanup(dir);
    }
  });

  test('a second run writes nothing, rather than a second line', async () => {
    const { dir, repo, archive } = await world();
    try {
      await run(repo, ['archive', 'week-grid', '--move']);
      const once = await Bun.file(join(archive, 'INDEX.md')).text();
      const again = await run(repo, ['archive', 'week-grid']);
      expect(again.stdout).toContain('already say this');
      expect(await Bun.file(join(archive, 'INDEX.md')).text()).toBe(once);
    } finally {
      await cleanup(dir);
    }
  });
});

describe('archive refuses rather than guesses', () => {
  test('when the same slug is in both places at once', async () => {
    const { dir, repo, archive } = await world();
    try {
      await mkdir(join(archive, 'week-grid'), { recursive: true });
      const result = await run(repo, ['archive', 'week-grid']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('It is in both places');
    } finally {
      await cleanup(dir);
    }
  });

  test('when the repo records no archive home', async () => {
    const { dir, repo } = await world();
    try {
      await writeFile(join(repo, '.personal-config.json'), '{}');
      const result = await run(repo, ['archive', 'week-grid']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('personal-config setup');
    } finally {
      await cleanup(dir);
    }
  });

  test('when the archive has no index to add a line to', async () => {
    const { dir, repo } = await world({ index: null });
    try {
      const result = await run(repo, ['archive', 'week-grid']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('no INDEX.md');
    } finally {
      await cleanup(dir);
    }
  });

  test('when the slug is in neither place, naming all three it looked in', async () => {
    const { dir, repo } = await world();
    try {
      const result = await run(repo, ['archive', 'nothing-here']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('docs/incomplete/nothing-here/');
      expect(result.stdout).toContain('already moved, waiting to be indexed');
    } finally {
      await cleanup(dir);
    }
  });

  test('a slug is required', async () => {
    const { dir, repo } = await world();
    try {
      const result = await run(repo, ['archive']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('usage: personal-config archive');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('archive outside Profile P', () => {
  test('archives any path in the repo, which is how a Profile L repo retires a doc', async () => {
    const { dir, repo, archive } = await world();
    try {
      await writeFile(join(repo, 'OLD-NOTES.md'), '# Old notes — the first pass\n');
      await git(repo, ['add', '-A']);
      await git(repo, ['commit', '--quiet', '-m', 'notes']);

      const result = await run(repo, ['archive', 'OLD-NOTES.md', '--move']);
      expect(result.code).toBe(0);
      expect(await Bun.file(join(archive, 'OLD-NOTES.md')).exists()).toBe(true);
      expect(await Bun.file(join(archive, 'INDEX.md')).text()).toContain(
        '- **OLD-NOTES.md** ✅ — Old notes — the first pass.',
      );
    } finally {
      await cleanup(dir);
    }
  });
});
