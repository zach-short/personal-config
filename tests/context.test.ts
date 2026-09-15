import { describe, expect, test } from 'bun:test';
import { mkdir, realpath, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { claudeProjectsDir, projectSlug, repoRoot } from '../src/lib/paths.ts';
import { contextSize, findBySentinel, transcripts } from '../src/lib/transcript.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

function usageLine(input: number, creation: number, read: number, text = 'hello'): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      content: text,
      usage: {
        input_tokens: input,
        cache_creation_input_tokens: creation,
        cache_read_input_tokens: read,
      },
    },
  });
}

/** Plants a transcript where the harness would write one, under a redirected `$HOME`. */
async function plant(home: string, cwd: string, name: string, lines: string[], at: Date) {
  const dir = join(home, '.claude', 'projects', projectSlug(cwd));
  await mkdir(dir, { recursive: true });
  const path = join(dir, name);
  await writeFile(path, `${lines.join('\n')}\n`);
  await utimes(path, at, at);
  return path;
}

/**
 * `process.cwd()` in the spawned CLI is the *resolved* path, and on macOS a temp directory
 * reaches it through a symlink (`/var` → `/private/var`). Resolving here is what makes the
 * planted transcript land under the slug the command will actually compute.
 */
async function repoDir(): Promise<string> {
  return realpath(await tempDir('pc-repo-'));
}

async function run(cwd: string, home: string, args: string[]) {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd,
    env: { ...process.env, HOME: home },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  return { code: await proc.exited, stdout };
}

describe('reading a transcript', () => {
  test('the size is the last usage record, all three keys summed', () => {
    const jsonl = [usageLine(1, 2, 3), usageLine(1000, 20000, 300000)].join('\n');
    expect(contextSize(jsonl)).toBe(321000);
  });

  test('a line with no usage record never becomes the answer', () => {
    const jsonl = [usageLine(10, 20, 30), JSON.stringify({ type: 'user', message: {} })].join(
      '\n',
    );
    expect(contextSize(jsonl)).toBe(60);
  });

  test('a malformed line is skipped rather than fatal', () => {
    expect(contextSize(['{not json', usageLine(5, 0, 0)].join('\n'))).toBe(5);
  });

  test('a session that has logged no usage yet reports nothing, not zero', () => {
    expect(contextSize(JSON.stringify({ type: 'user', message: {} }))).toBeNull();
  });
});

describe('finding this session among several', () => {
  test('the sentinel wins over modification time', async () => {
    const home = await tempDir('pc-home-');
    const cwd = await repoDir();
    try {
      const older = await plant(
        home,
        cwd,
        'ours.jsonl',
        [usageLine(1, 1, 1, 'the link contract')],
        new Date(1000),
      );
      await plant(
        home,
        cwd,
        'newer.jsonl',
        [usageLine(394, 0, 0, 'someone else')],
        new Date(9000),
      );

      const files = await transcripts(join(home, '.claude', 'projects', projectSlug(cwd)));
      expect(files[0]).toContain('newer.jsonl');
      expect(await findBySentinel(files, 'the link contract')).toBe(older);
    } finally {
      await cleanup(home);
      await cleanup(cwd);
    }
  });

  test('no match is null, never the newest as a fallback', async () => {
    const home = await tempDir('pc-home-');
    const cwd = await repoDir();
    try {
      await plant(home, cwd, 'other.jsonl', [usageLine(1, 1, 1, 'unrelated')], new Date(9000));
      const files = await transcripts(join(home, '.claude', 'projects', projectSlug(cwd)));
      expect(await findBySentinel(files, 'nothing says this')).toBeNull();
    } finally {
      await cleanup(home);
      await cleanup(cwd);
    }
  });

  test('a directory with no transcripts, or none at all, is empty rather than an error', async () => {
    expect(await transcripts(join(await tempDir('pc-empty-'), 'nope'))).toEqual([]);
  });

  test('the project slug is the working directory, one dash per unusable character', () => {
    expect(projectSlug('/Users/someone/Projects/a_repo')).toBe(
      '-Users-someone-Projects-a-repo',
    );
    expect(claudeProjectsDir('/a/b')).toContain(join('.claude', 'projects', '-a-b'));
  });
});

describe('the context command', () => {
  test('prints the size of the transcript the sentinel names', async () => {
    const home = await tempDir('pc-home-');
    const cwd = await repoDir();
    try {
      await plant(
        home,
        cwd,
        'ours.jsonl',
        [usageLine(1000, 20000, 300000, 'lane alpha')],
        new Date(1000),
      );
      await plant(
        home,
        cwd,
        'theirs.jsonl',
        [usageLine(394000, 0, 0, 'lane beta')],
        new Date(9000),
      );

      const result = await run(cwd, home, ['context', '--sentinel', 'lane alpha']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('ours.jsonl');
      expect(result.stdout).toContain('321,000 tokens');
      expect(result.stdout).not.toContain('394,000');
    } finally {
      await cleanup(home);
      await cleanup(cwd);
    }
  });

  test('refuses without a sentinel, and says why it is not a convenience', async () => {
    const home = await tempDir('pc-home-');
    const cwd = await repoDir();
    try {
      await plant(home, cwd, 'ours.jsonl', [usageLine(1, 1, 1)], new Date(1000));
      const result = await run(cwd, home, ['context']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('--sentinel is required');
      expect(result.stdout).not.toContain('tokens');
    } finally {
      await cleanup(home);
      await cleanup(cwd);
    }
  });

  test('lists the candidates rather than guessing when nothing matches', async () => {
    const home = await tempDir('pc-home-');
    const cwd = await repoDir();
    try {
      await plant(home, cwd, 'one.jsonl', [usageLine(1, 1, 1, 'alpha')], new Date(1000));
      await plant(home, cwd, 'two.jsonl', [usageLine(2, 2, 2, 'beta')], new Date(9000));

      const result = await run(cwd, home, ['context', '--sentinel', 'gamma']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('one.jsonl');
      expect(result.stdout).toContain('two.jsonl');
      expect(result.stdout).not.toContain('tokens');
    } finally {
      await cleanup(home);
      await cleanup(cwd);
    }
  });

  test('says so plainly when this project has no transcript at all', async () => {
    const home = await tempDir('pc-home-');
    const cwd = await repoDir();
    try {
      const result = await run(cwd, home, ['context', '--sentinel', 'anything']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('no transcript found under');
    } finally {
      await cleanup(home);
      await cleanup(cwd);
    }
  });

  test('says so when the session has not logged a usage record yet', async () => {
    const home = await tempDir('pc-home-');
    const cwd = await repoDir();
    try {
      await plant(
        home,
        cwd,
        'fresh.jsonl',
        [JSON.stringify({ message: { content: 'lane alpha' } })],
        new Date(1000),
      );
      const result = await run(cwd, home, ['context', '--sentinel', 'lane alpha']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('no usage records yet');
    } finally {
      await cleanup(home);
      await cleanup(cwd);
    }
  });
});
