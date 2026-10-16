import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { bareRoute } from '../src/lib/args.ts';
import { repoRoot } from '../src/lib/paths.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

/** A real child with piped ends: `isTTY` is undefined there, which no property override gives. */
async function run(args: string[]) {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd: repoRoot(),
    env: process.env,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  proc.stdin.end();
  const stdout = await new Response(proc.stdout).text();
  return { code: await proc.exited, stdout };
}

describe('bareRoute', () => {
  test('no terminal is the help text, saved config or not', () => {
    expect(bareRoute(false, false)).toBe('help');
    expect(bareRoute(false, true)).toBe('help');
  });

  test('a terminal opens the guided setup, or the home screen once a config is saved', () => {
    expect(bareRoute(true, false)).toBe('guided');
    expect(bareRoute(true, true)).toBe('home');
  });
});

describe('the bare command through a pipe', () => {
  test('prints the help text byte for byte and exits 0', async () => {
    const bare = await run([]);
    const help = await run(['--help']);
    expect(bare.code).toBe(0);
    expect(bare.stdout).toBe(help.stdout);
    expect(bare.stdout).toContain('personal-config setup');
  });
});
