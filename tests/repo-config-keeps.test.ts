/**
 * A re-render of `.personal-config.json` keeps the keys no question asks for. On 2026-10-16
 * `init . --yes --force` wrote `"gateCommand": ""` over a hand-set command, which silently turns
 * the completion gate off, and board item 94 saw `archiveHome: ""` after a `setup` run the same
 * way. `itemsDir` and `ledgerFrozenAt` already survived; they are here so they keep doing so.
 *
 * The real bin in a child process, with `HOME` and the target both temp directories (`X2`).
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

async function cli(args: string[], home: string): Promise<number> {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd: repoRoot(),
    env: { ...process.env, HOME: home },
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return proc.exited;
}

let home = '';

beforeAll(async () => {
  home = await tempDir('pc-home-');
  const empty = join(home, 'empty-projects');
  await mkdir(empty);
  expect(
    await cli(['setup', '--profile', 'starter', '--yes', '--projects-dir', empty], home),
  ).toBe(0);
});

afterAll(async () => {
  await cleanup(home);
});

const KEPT = {
  gateCommand: 'bun run typecheck && bun test',
  archiveHome: '~/archive/notes',
  itemsDir: 'tasks',
  ledgerFrozenAt: 12,
};

test('a re-run of `init` keeps the hand-set keys it has no answer for', async () => {
  const dir = join(home, 'work', 'notes');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'draft.md'), '# Draft\n');
  expect(await cli(['init', dir, '--yes', '--force'], home)).toBe(0);

  const path = join(dir, '.personal-config.json');
  const first = (await Bun.file(path).json()) as Record<string, unknown>;
  await Bun.write(path, `${JSON.stringify({ ...first, ...KEPT }, null, 2)}\n`);
  await mkdir(join(dir, 'tasks'));
  await writeFile(join(dir, 'tasks', '1-first.md'), '# 1 First\n');

  expect(await cli(['init', dir, '--yes', '--force'], home)).toBe(0);
  const second = (await Bun.file(path).json()) as Record<string, unknown>;
  expect({
    gateCommand: second.gateCommand,
    archiveHome: second.archiveHome,
    itemsDir: second.itemsDir,
    ledgerFrozenAt: second.ledgerFrozenAt,
  }).toEqual(KEPT);
});

test('a re-run of `setup` keeps them too', async () => {
  const projects = join(home, 'projects');
  const dir = join(projects, 'notes');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'draft.md'), '# Draft\n');
  const setup = [
    'setup',
    '--profile',
    'starter',
    '--yes',
    '--force',
    '--projects-dir',
    projects,
  ];
  expect(await cli(setup, home)).toBe(0);

  const path = join(dir, '.personal-config.json');
  const first = (await Bun.file(path).json()) as Record<string, unknown>;
  await Bun.write(path, `${JSON.stringify({ ...first, ...KEPT }, null, 2)}\n`);
  await mkdir(join(dir, 'tasks'));
  await writeFile(join(dir, 'tasks', '1-first.md'), '# 1 First\n');

  expect(await cli(setup, home)).toBe(0);
  const second = (await Bun.file(path).json()) as Record<string, unknown>;
  expect({
    gateCommand: second.gateCommand,
    archiveHome: second.archiveHome,
    itemsDir: second.itemsDir,
    ledgerFrozenAt: second.ledgerFrozenAt,
  }).toEqual(KEPT);
});
