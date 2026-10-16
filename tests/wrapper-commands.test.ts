/**
 * Item 97. `scripts/personal-config` builds its list of forwarded subcommands from the usage
 * lines of `src/cli.ts --help` ("  personal-config <name> ..."), not from `COMMANDS`. This test is
 * the tie between the two: a command in `COMMANDS` with no usage line in the help would be
 * silently unreachable through the wrapper.
 */
import { expect, test } from 'bun:test';
import { COMMANDS } from '../src/lib/args.ts';

test('every runnable command has a usage line in --help, in the shape the wrapper parses', async () => {
  const proc = Bun.spawn(['bun', 'src/cli.ts', '--help'], { stdout: 'pipe' });
  const help = await new Response(proc.stdout).text();
  await proc.exited;
  const listed = new Set(
    help
      .split('\n')
      .map((line) => /^ {2}personal-config ([a-z]+)/.exec(line)?.[1])
      .filter((name): name is string => name !== undefined),
  );
  const runnable = COMMANDS.filter((name) => name !== 'help' && name !== 'version');
  expect(runnable.filter((name) => !listed.has(name))).toEqual([]);
});

test('the wrapper itself lists every runnable command in --complete', async () => {
  const proc = Bun.spawn(['bash', 'scripts/personal-config', '--complete'], { stdout: 'pipe' });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  const names = new Set(out.split('\n').map((line) => line.split(':')[0]));
  const runnable = COMMANDS.filter((name) => name !== 'help' && name !== 'version');
  expect(runnable.filter((name) => !names.has(name))).toEqual([]);
});
