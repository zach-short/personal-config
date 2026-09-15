import { describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { duplicateSteps, ledgerSteps, missingSteps, nextFreeStep } from '../src/lib/ledger.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

function log(...steps: string[]): string {
  return ['# NOTES', '', '## Step log', '', ...steps].join('\n\n');
}

const STEP_ONE = '**1. Direction set.** Done 2026-09-15, Deep. Read everything.';
const STEP_TWO = '**2. Built the thing.** Done 2026-09-15, Default, commit `abc1234`.';

async function repoWith(files: Record<string, string>): Promise<string> {
  const dir = await tempDir('pc-ledger-');
  await mkdir(join(dir, '.git'), { recursive: true });
  await writeFile(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, name), body);
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

describe('reading the step log', () => {
  test('finds each numbered step and its title', () => {
    const steps = ledgerSteps(log(STEP_ONE, STEP_TWO));
    expect(steps.map((s) => s.number)).toEqual([1, 2]);
    expect(steps[1]?.title).toBe('Built the thing.');
  });

  test('a step quoted inside a fenced block is not a step', () => {
    const fenced = ['```', '**9. Not a real step.** Pasted from somewhere else.', '```'];
    expect(ledgerSteps(log(STEP_ONE, fenced.join('\n')))).toHaveLength(1);
  });

  test('the next free number is one past the highest, never a hole', () => {
    expect(nextFreeStep(ledgerSteps(log(STEP_ONE, STEP_TWO)))).toBe(3);
    expect(nextFreeStep(ledgerSteps(log('**1. A.** x', '**4. D.** x')))).toBe(5);
  });

  test('an empty log hands out 1', () => {
    expect(nextFreeStep(ledgerSteps(log()))).toBe(1);
  });

  test('holes and duplicates are reported rather than silently filled', () => {
    const steps = ledgerSteps(log('**1. A.** x', '**3. C.** x', '**3. C again.** x'));
    expect(missingSteps(steps)).toEqual([2]);
    expect(duplicateSteps(steps)).toEqual([3]);
  });
});

describe('the handoff command', () => {
  test('reports the next free number, the count and the modification time', async () => {
    const dir = await repoWith({ 'HANDOFF.md': log(STEP_ONE, STEP_TWO) });
    try {
      const result = await run(dir, ['handoff', 'step']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('2 step(s)');
      expect(result.stdout).toContain('The next free number is 3.');
      expect(result.stdout).toMatch(/last modified \d{4}-\d{2}-\d{2}T/);
    } finally {
      await cleanup(dir);
    }
  });

  test('says plainly that it reports rather than reserves', async () => {
    const dir = await repoWith({ 'HANDOFF.md': log(STEP_ONE) });
    try {
      const result = await run(dir, ['handoff', 'step']);
      expect(result.stdout).toContain('Reported, not reserved');
    } finally {
      await cleanup(dir);
    }
  });

  test('scaffolds the step the standard asks for, with the real branch', async () => {
    const dir = await repoWith({ 'HANDOFF.md': log(STEP_ONE) });
    try {
      const result = await run(dir, ['handoff', 'step']);
      expect(result.stdout).toContain('**2. <Imperative title>.**');
      expect(result.stdout).toContain('Left owed:');
    } finally {
      await cleanup(dir);
    }
  });

  test('warns when the log is already non-contiguous', async () => {
    const dir = await repoWith({ 'HANDOFF.md': log('**1. A.** x', '**3. C.** x') });
    try {
      const result = await run(dir, ['handoff', 'step']);
      expect(result.stdout).toContain('Missing below the highest: 2');
      expect(result.stdout).toContain('The next free number is 4.');
    } finally {
      await cleanup(dir);
    }
  });

  test('reads the adopted ledger name rather than assuming HANDOFF.md (§0.2)', async () => {
    const dir = await repoWith({
      'NOTES.md': log(STEP_ONE, STEP_TWO, '**3. Third.** x'),
      '.personal-config.json': JSON.stringify({ ledgerFile: 'NOTES.md' }),
    });
    try {
      const result = await run(dir, ['handoff', 'step']);
      expect(result.stdout).toContain('NOTES.md');
      expect(result.stdout).toContain('The next free number is 4.');
    } finally {
      await cleanup(dir);
    }
  });

  test('refuses, naming both profiles, when there is no ledger', async () => {
    const dir = await repoWith({});
    try {
      const result = await run(dir, ['handoff', 'step']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('docs/incomplete/<slug>/');
    } finally {
      await cleanup(dir);
    }
  });

  test('a sub-command is required', async () => {
    const dir = await repoWith({ 'HANDOFF.md': log(STEP_ONE) });
    try {
      const result = await run(dir, ['handoff']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('usage: personal-config handoff step');
    } finally {
      await cleanup(dir);
    }
  });
});
