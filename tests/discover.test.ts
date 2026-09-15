import { beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { scanProjectsDir } from '../src/lib/discover.ts';
import { ownerFromRemote, ownsRepo } from '../src/lib/git.ts';
import type { RepoScan } from '../src/lib/types.ts';
import { makeFixtures } from './make-fixtures.ts';

let scans: RepoScan[] = [];
const byName = (name: string): RepoScan => {
  const hit = scans.find((s) => s.name === name);
  if (!hit) throw new Error(`fixture ${name} not scanned`);
  return hit;
};

beforeAll(async () => {
  const root = await makeFixtures();
  scans = await scanProjectsDir(root);
});

describe('discovery', () => {
  test('finds every fixture repo and nothing else', () => {
    expect(scans.map((s) => s.name).sort()).toEqual([
      'bun-monorepo',
      'empty-repo',
      'go-module',
      'not-yours',
      'swift-app',
    ]);
  });

  test('a Bun monorepo: typescript, bun, CI', () => {
    const repo = byName('bun-monorepo');
    expect(repo.languages).toContain('typescript');
    expect(repo.packageManager).toBe('bun');
    expect(repo.hasCi).toBe(true);
    expect(repo.remoteOwner).toBe('fixture-owner');
  });

  test('a Go module: go, migrations, no CI', () => {
    const repo = byName('go-module');
    expect(repo.languages).toEqual(['go']);
    expect(repo.migrations).toEqual(['migrations']);
    expect(repo.hasCi).toBe(false);
    expect(repo.packageManager).toBeNull();
  });

  test('a Swift/XcodeGen tree with a ledger already has its profile chosen', () => {
    const repo = byName('swift-app');
    expect(repo.languages).toEqual(['swift']);
    expect(repo.existingDocs).toContain('HANDOFF.md');
    // §0.2: adopt what is there, never rename.
    expect(repo.impliedProfile).toBe('ledger');
  });

  test('an empty repo reports nothing rather than guessing', () => {
    const repo = byName('empty-repo');
    expect(repo.languages).toEqual([]);
    expect(repo.packageManager).toBeNull();
    expect(repo.remoteOwner).toBeNull();
    expect(repo.impliedProfile).toBeNull();
  });

  test('a repo whose remote is someone else’s reports their owner', () => {
    const repo = byName('not-yours');
    expect(repo.remoteOwner).toBe('someone-else');
    expect(repo.languages.sort()).toEqual(['python', 'typescript']);
  });

  test('a non-repo directory is not scanned', async () => {
    const root = join(import.meta.dir, 'fixtures');
    await Bun.write(join(root, 'not-a-repo', 'package.json'), '{}');
    const rescanned = await scanProjectsDir(root);
    expect(rescanned.map((s) => s.name)).not.toContain('not-a-repo');
  });
});

describe('ownership guard', () => {
  test('parses both remote forms', () => {
    expect(ownerFromRemote('https://github.com/owner/repo.git')).toBe('owner');
    expect(ownerFromRemote('git@github.com:owner/repo.git')).toBe('owner');
    expect(ownerFromRemote('https://github.com/owner/repo')).toBe('owner');
    expect(ownerFromRemote(null)).toBeNull();
  });

  test('ownership needs proof — an unknown login or owner is not yours', () => {
    expect(ownsRepo('owner', 'owner')).toBe(true);
    expect(ownsRepo('Owner', 'owner')).toBe(true);
    expect(ownsRepo('owner', 'someone-else')).toBe(false);
    expect(ownsRepo(null, 'owner')).toBe(false);
    expect(ownsRepo('owner', null)).toBe(false);
  });
});
