import { describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from '../src/lib/paths.ts';
import { fillWorktree, recipeBlocks, UNFILLED } from '../src/lib/recipe.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

/** The three heading spellings observed in the shipped standard and two adapted copies. */
const HEADINGS = [
  '## The fresh-checkout recipe — worktree, clone or CI',
  '## The fresh-checkout recipe — worktree or clone',
  '## The fresh-checkout recipe',
];

const INSTALL = ['```bash', 'cd <worktree> && bun install --frozen-lockfile', '```'].join('\n');
const COPIES = ['```bash', 'cp ../primary/web/.env web/.env', '```'].join('\n');

function standard(heading: string, body: string): string {
  return [
    '# Part 6 — Parallel sessions',
    '',
    heading,
    '',
    'A fresh checkout fails gates for environmental reasons before it fails a real one.',
    '',
    body,
    '',
    '## Committing under a shared index',
    '',
    '```bash',
    'git add -N <new-path>',
    '```',
  ].join('\n');
}

async function repoWith(options: { config?: string; standard?: string }): Promise<string> {
  const dir = await tempDir('pc-worktree-');
  await mkdir(join(dir, '.git'), { recursive: true });
  await writeFile(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  await mkdir(join(dir, 'docs'), { recursive: true });
  if (options.standard !== undefined) {
    await writeFile(join(dir, 'docs', 'agent-practices.md'), options.standard);
  }
  if (options.config !== undefined) {
    await writeFile(join(dir, '.personal-config.json'), options.config);
  }
  return dir;
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

describe('extracting the fresh-checkout recipe', () => {
  test('finds it under every heading spelling in the wild', () => {
    for (const heading of HEADINGS) {
      const blocks = recipeBlocks(standard(heading, INSTALL));
      expect(blocks).toEqual(['cd <worktree> && bun install --frozen-lockfile']);
    }
  });

  test('takes every block under the heading, not just the first', () => {
    const blocks = recipeBlocks(standard(HEADINGS[2] ?? '', `${INSTALL}\n\nAnd:\n\n${COPIES}`));
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toContain('cp ../primary/web/.env');
  });

  test('stops at the next heading rather than swallowing the whole part', () => {
    const blocks = recipeBlocks(standard(HEADINGS[0] ?? '', INSTALL));
    expect(blocks.join('\n')).not.toContain('git add -N');
  });

  test('returns nothing when the section is absent', () => {
    expect(recipeBlocks('# Part 6\n\n## Lanes\n\nNo recipe here.\n')).toEqual([]);
  });

  test('an unfilled recipe comes back carrying its placeholder', () => {
    const body = ['```bash', UNFILLED, '```'].join('\n');
    expect(recipeBlocks(standard(HEADINGS[0] ?? '', body))[0]).toBe(UNFILLED);
  });

  test('the worktree placeholder is substituted everywhere it appears', () => {
    const filled = fillWorktree('cd <worktree> && ls <worktree>/site', '/tmp/repo-lane-a');
    expect(filled).toBe('cd /tmp/repo-lane-a && ls /tmp/repo-lane-a/site');
  });
});

describe('the worktree command', () => {
  test('prints the add line and every recipe block', async () => {
    const dir = await repoWith({
      config: JSON.stringify({ standardPath: 'docs/agent-practices.md' }),
      standard: standard(HEADINGS[1] ?? '', `${INSTALL}\n\nAnd:\n\n${COPIES}`),
    });
    try {
      const result = await run(dir, ['worktree', 'lane-a']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('git worktree add');
      expect(result.stdout).toContain('-b lane-a');
      expect(result.stdout).toContain('bun install --frozen-lockfile');
      expect(result.stdout).toContain('cp ../primary/web/.env');
      expect(result.stdout).not.toContain('<worktree>');
    } finally {
      await cleanup(dir);
    }
  });

  test('honours a repo that keeps its worktrees somewhere other than beside the checkout', async () => {
    const dir = await repoWith({
      config: JSON.stringify({
        standardPath: 'docs/agent-practices.md',
        worktreePath: '.claude/worktrees/<lane>',
      }),
      standard: standard(HEADINGS[2] ?? '', INSTALL),
    });
    try {
      const result = await run(dir, ['worktree', 'lane-b']);
      expect(result.stdout).toContain('.claude/worktrees/lane-b');
    } finally {
      await cleanup(dir);
    }
  });

  test('refuses, naming setup, when the repo has no .personal-config.json', async () => {
    const dir = await repoWith({ standard: standard(HEADINGS[0] ?? '', INSTALL) });
    try {
      const result = await run(dir, ['worktree', 'lane-a']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('personal-config setup');
      expect(result.stdout).not.toContain('git worktree add');
    } finally {
      await cleanup(dir);
    }
  });

  test('refuses when Part 0 never filled the recipe in', async () => {
    const dir = await repoWith({
      config: JSON.stringify({ standardPath: 'docs/agent-practices.md' }),
      standard: standard(HEADINGS[0] ?? '', ['```bash', UNFILLED, '```'].join('\n')),
    });
    try {
      const result = await run(dir, ['worktree', 'lane-a']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain(UNFILLED);
      expect(result.stdout).not.toContain('git worktree add');
    } finally {
      await cleanup(dir);
    }
  });

  test('refuses when the recorded standard is not on disk', async () => {
    const dir = await repoWith({ config: JSON.stringify({ standardPath: 'docs/missing.md' }) });
    try {
      const result = await run(dir, ['worktree', 'lane-a']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('nothing is there');
    } finally {
      await cleanup(dir);
    }
  });

  test('a lane is required', async () => {
    const dir = await repoWith({});
    try {
      const result = await run(dir, ['worktree']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('usage: personal-config worktree <lane>');
    } finally {
      await cleanup(dir);
    }
  });
});
