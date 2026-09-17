import { describe, expect, test } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exists, readText } from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

/**
 * A real `git init`, because the fix asks git where the exclude file is rather than spelling
 * the path out — and in a directory that is not a repository git answers nothing, which is a
 * different code path from the one every user is on.
 */
async function world(
  trackMode: 'tracked' | 'untracked',
  extra: Record<string, string> = {},
): Promise<string> {
  const dir = await tempDir('pc-fix-');
  await writeFile(join(dir, '.personal-config.json'), JSON.stringify({ trackMode }));
  await writeFile(join(dir, 'PART0-PROMPT.md'), '# Part 0\n\nWritten 2026-09-16.\n');
  for (const [path, body] of Object.entries(extra)) await writeFile(join(dir, path), body);

  await git(dir, ['init', '--quiet', '--initial-branch=main']);
  await git(dir, ['config', 'user.email', 'test@example.com']);
  await git(dir, ['config', 'user.name', 'test']);
  return dir;
}

/** `git init` seeds a default `.git/info/exclude`, so its presence proves nothing — content does. */
async function excludeText(dir: string): Promise<string> {
  const path = join(dir, '.git', 'info', 'exclude');
  return (await exists(path)) ? readText(path) : '';
}

async function git(cwd: string, args: string[]): Promise<void> {
  await Bun.spawn(['git', ...args], { cwd, stdout: 'ignore', stderr: 'ignore' }).exited;
}

/** The real bin, with its own `$HOME`, so nothing here can reach the machine's config. */
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

describe('doctor --fix', () => {
  test('appends the uncovered personal files to .git/info/exclude', async () => {
    const dir = await world('untracked');
    try {
      const first = await run(dir, ['doctor', '.', '--fix']);
      expect(first.stdout).toContain('fixed 2');

      const written = await excludeText(dir);
      expect(written).toContain('/PART0-PROMPT.md');
      expect(written).toContain('/.personal-config.json');

      // The fix is only real if the rule stops firing on the next run.
      const second = await run(dir, ['doctor', '.']);
      expect(second.stdout).toContain('doctor: no findings.');
      expect(second.code).toBe(0);
    } finally {
      await cleanup(dir);
    }
  });

  test('anchors every line it writes', async () => {
    const dir = await world('untracked');
    try {
      await run(dir, ['doctor', '.', '--fix']);
      const written = await excludeText(dir);
      // A bare `PART0-PROMPT.md` matches at every depth; the renderer anchors for the same
      // reason, and a fix that disagreed with it would hide files the repo ships.
      const added = written
        .split('\n')
        .filter((line) => line.includes('PROMPT') || line.includes('personal-config'));
      expect(added.length).toBe(2);
      for (const line of added) expect(line.startsWith('/')).toBe(true);
    } finally {
      await cleanup(dir);
    }
  });

  test('writes to .gitignore instead when the repo is tracked', async () => {
    const dir = await world('tracked');
    try {
      const result = await run(dir, ['doctor', '.', '--fix']);
      expect(result.stdout).toContain('.gitignore');
      expect(await readText(join(dir, '.gitignore'))).toContain('/PART0-PROMPT.md');
      expect(await excludeText(dir)).not.toContain('/PART0-PROMPT.md');
    } finally {
      await cleanup(dir);
    }
  });

  test('without --fix it reports and writes nothing', async () => {
    const dir = await world('untracked');
    try {
      const result = await run(dir, ['doctor', '.']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('ignored');
      expect(await excludeText(dir)).not.toContain('/PART0-PROMPT.md');
    } finally {
      await cleanup(dir);
    }
  });

  test('--dry-run writes nothing, whatever else was asked for', async () => {
    const dir = await world('untracked');
    try {
      const result = await run(dir, ['doctor', '.', '--fix', '--dry-run']);
      expect(result.stdout).toContain('--dry-run writes nothing');
      expect(await excludeText(dir)).not.toContain('/PART0-PROMPT.md');
      expect(result.code).toBe(1);
    } finally {
      await cleanup(dir);
    }
  });

  test('running it twice appends one copy, not two', async () => {
    const dir = await world('untracked');
    try {
      await run(dir, ['doctor', '.', '--fix']);
      await run(dir, ['doctor', '.', '--fix']);
      const written = await excludeText(dir);
      expect(written.split('/PART0-PROMPT.md').length - 1).toBe(1);
    } finally {
      await cleanup(dir);
    }
  });

  test('leaves a finding no rule marked mechanical, and still exits 1', async () => {
    const dir = await world('untracked', {
      'HANDOFF.md': '# H\n\n## Step log\n\n**1. A step.** Fixed this recently.\n',
    });
    try {
      const result = await run(dir, ['doctor', '.', '--fix']);
      expect(result.stdout).toContain('fixed 2');
      expect(result.stdout).toContain('relative-dates');
      expect(result.code).toBe(1);
    } finally {
      await cleanup(dir);
    }
  });

  test('finds the exclude file from inside a linked worktree', async () => {
    const dir = await world('untracked');
    const lane = join(dir, 'lane');
    try {
      await git(dir, ['add', '-A']);
      await git(dir, ['commit', '--quiet', '-m', 'seed']);
      await writeFile(join(dir, '.git', 'info', 'exclude'), '/lane\n');
      await git(dir, ['worktree', 'add', '--quiet', lane, '-b', 'lane']);
      await writeFile(
        join(lane, '.personal-config.json'),
        JSON.stringify({ trackMode: 'untracked' }),
      );

      const result = await run(lane, ['doctor', '.', '--fix']);
      expect(result.code).toBe(0);
      // A worktree's `.git` is a file: the spelled-out path cannot be created there at all.
      expect(await exists(join(lane, '.git', 'info', 'exclude'))).toBe(false);
    } finally {
      await cleanup(dir);
    }
  });
});
