import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { checkUsage } from '../src/lib/args.ts';
import { repoRoot } from '../src/lib/paths.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

async function run(args: string[]) {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd: repoRoot(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { code: await proc.exited, stdout, stderr };
}

/** What a raw throw used to leak: the class, the frames, and the path of the installed file. */
function looksLikeAStackTrace(text: string): boolean {
  return /TypeError|ERR_PARSE_ARGS|\bat .+:\d+|args\.ts/.test(text);
}

describe('checkUsage accepts everything the tool actually takes', () => {
  test.each([
    ['a bare invocation', []],
    ['a command alone', ['setup']],
    ['a command with flags', ['setup', '--yes', '--dry-run', '--profile', 'zach']],
    ['a command with positional paths', ['doctor', 'a', 'b']],
    ['help as a flag', ['--help']],
    ['version as a flag', ['--version']],
    ['help as a command', ['help']],
    ['a flag with an = value', ['setup', '--profile=zach']],
  ])('%s passes', (_label, argv) => {
    expect(checkUsage(argv as string[])).toBeNull();
  });
});

describe('an unknown command is refused rather than silently helped', () => {
  test('the message names the token and lists every command that can be run', () => {
    const problem = checkUsage(['setpu']);
    expect(problem).not.toBeNull();
    expect(problem).toContain("unknown command 'setpu'");
    for (const name of [
      'setup',
      'catalog',
      'doctor',
      'undo',
      'archive',
      'passoff',
      'handoff',
      'worktree',
      'context',
    ]) {
      expect(problem).toContain(name);
    }
  });

  // The defect: `resolveCommand` fell back to `help`, and help exits 0 — so in a script a
  // mistyped command was indistinguishable from a run that did the work.
  test('it exits 1, not 0', async () => {
    const result = await run(['setpu']);
    expect(result.code).toBe(1);
  });

  test('it goes to stderr, leaving stdout empty for a redirect', async () => {
    const result = await run(['setpu']);
    expect(result.stderr).toContain("unknown command 'setpu'");
    expect(result.stdout).toBe('');
  });
});

describe('a bad option is reported rather than thrown', () => {
  test.each([
    ['an unknown long flag', ['doctor', '--dryrun'], "Unknown option '--dryrun'"],
    ['an unknown short flag', ['-x'], "Unknown option '-x'"],
    [
      'a flag missing its value',
      ['setup', '--profile'],
      "Option '--profile <value>' argument missing",
    ],
  ])('%s is named in one line', (_label, argv, expected) => {
    const problem = checkUsage(argv as string[]);
    expect(problem).toContain(expected as string);
    expect(problem).toContain('--help');
  });

  test('no message keeps the advice about `--` that parseArgs appends', () => {
    expect(checkUsage(['doctor', '--dryrun'])).not.toContain('place it at the end');
  });

  test.each([
    ['an unknown flag', ['doctor', '--dryrun']],
    ['a flag missing its value', ['setup', '--profile']],
  ])('%s exits 1 with no stack trace in either stream', async (_label, argv) => {
    const result = await run(argv as string[]);
    expect(result.code).toBe(1);
    expect(looksLikeAStackTrace(result.stderr)).toBe(false);
    expect(looksLikeAStackTrace(result.stdout)).toBe(false);
  });
});

describe('the paths that were already right stay right', () => {
  test('a bare invocation still prints help and exits 0', async () => {
    const result = await run([]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('personal-config setup');
    expect(result.stderr).toBe('');
  });

  test('--version still exits 0', async () => {
    const result = await run(['--version']);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
