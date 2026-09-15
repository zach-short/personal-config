/**
 * Fixture repos are generated, not committed: a nested `.git` directory inside this repo would
 * be an embedded repository git refuses to track. `bun run fixtures` rebuilds them from here,
 * and `tests/fixtures/` is ignored.
 */
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

export const FIXTURES_DIR = join(import.meta.dir, 'fixtures');

type Fixture = { name: string; remote: string | null; files: Record<string, string> };

const FIXTURES: Fixture[] = [
  {
    name: 'bun-monorepo',
    remote: 'https://github.com/fixture-owner/bun-monorepo.git',
    files: {
      'package.json': '{ "name": "bun-monorepo", "workspaces": ["packages/*"] }\n',
      'tsconfig.json': '{}\n',
      'bun.lock': '',
      '.github/workflows/ci.yml': 'name: ci\n',
      'packages/core/index.ts': 'export const version = 1;\n',
    },
  },
  {
    name: 'go-module',
    remote: 'git@github.com:fixture-owner/go-module.git',
    files: {
      'go.mod': 'module example.com/api\n\ngo 1.23\n',
      'migrations/0001_init.sql': '-- up\n',
    },
  },
  {
    name: 'swift-app',
    remote: 'git@github.com:fixture-owner/swift-app.git',
    files: {
      'project.yml': 'name: SwiftApp\ntargets:\n  SwiftApp:\n    type: application\n',
      // An existing ledger means the profile is already chosen (standard §0.2): adopt, never rename.
      'HANDOFF.md': '# HANDOFF — swift-app\n\n## Step log\n\n**1. Opened.** Done 2026-09-15.\n',
    },
  },
  { name: 'empty-repo', remote: null, files: {} },
  {
    name: 'not-yours',
    remote: 'https://github.com/someone-else/course-fork.git',
    files: {
      'package.json': '{ "name": "course-fork" }\n',
      'pyproject.toml': '[project]\nname = "course-fork"\n',
    },
  },
];

export async function makeFixtures(root = FIXTURES_DIR): Promise<string> {
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  for (const fixture of FIXTURES) await build(root, fixture);
  return root;
}

async function build(root: string, fixture: Fixture): Promise<void> {
  const dir = join(root, fixture.name);
  await mkdir(dir, { recursive: true });
  for (const [path, contents] of Object.entries(fixture.files)) {
    await Bun.write(join(dir, path), contents);
  }
  await run(dir, ['init', '--quiet', '--initial-branch=main']);
  if (fixture.remote) await run(dir, ['remote', 'add', 'origin', fixture.remote]);
}

async function run(cwd: string, args: string[]): Promise<void> {
  const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'ignore', stderr: 'ignore' });
  await proc.exited;
}

if (import.meta.main) {
  const root = await makeFixtures();
  console.log(`fixtures rebuilt in ${root}`);
}
