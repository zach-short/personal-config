import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { collectDocs, kindOf } from '../src/doctor/scan.ts';
import { cleanup, tempDir, testConfig } from './helpers.ts';

const EXPECTATION = { standardVersion: '1.0.0', config: testConfig() };

async function findingsFor(files: Record<string, string>): Promise<string[]> {
  const dir = await tempDir();
  try {
    for (const [path, contents] of Object.entries(files)) {
      await Bun.write(join(dir, path), contents);
    }
    const report = await runDoctorOn(dir, EXPECTATION);
    return report.findings.map((f) => f.rule);
  } finally {
    await cleanup(dir);
  }
}

/** §2.2 — a Profile P repo keeps project folders, and before 2026-09-15 no rule saw any of them. */
describe('§2.2 — Profile P documents are classified', () => {
  test('a doc inside an effort folder is a project doc, whatever it is called', () => {
    expect(kindOf('docs/incomplete/click-counting/NOTES.md')).toBe('project');
    expect(kindOf('docs/incomplete/click-counting/SCOPE.md')).toBe('project');
  });

  test('the four named stage documents are project docs wherever they sit', () => {
    for (const name of ['SCOPE.md', 'DESIGN.md', 'PLAN.md', 'RUNTIME-PASS.md']) {
      expect(kindOf(`archive/click-counting/${name}`)).toBe('project');
    }
  });

  test('§8.2 — a docs index is checkable; the repo’s own README is not', () => {
    expect(kindOf('docs/README.md')).toBe('docs-index');
    expect(kindOf('README.md')).toBe('other');
  });
});

describe('per-item-board D1 — an item file is its own kind', () => {
  test('a file directly inside the items folder is an item, whatever it is called', () => {
    expect(kindOf('repo/passoff/1-first.md', undefined, 'repo/passoff')).toBe('item');
    expect(kindOf('repo/passoff/notes.md', undefined, 'repo/passoff')).toBe('item');
  });

  test('a file in a folder nested under it is not', () => {
    expect(kindOf('repo/passoff/old/1-first.md', undefined, 'repo/passoff')).toBe('other');
  });

  test('without an items folder to compare against, the same path is not an item', () => {
    expect(kindOf('repo/passoff/1-first.md')).toBe('other');
  });

  test('doctor walks an adopted board’s folder as items, and only that folder', async () => {
    const dir = await tempDir();
    try {
      await Bun.write(join(dir, '.personal-config.json'), '{"boardFile":"NEXT.md"}\n');
      await Bun.write(join(dir, 'next/1-first.md'), '# 1. First\n');
      await Bun.write(join(dir, 'passoff/1-first.md'), '# 1. First\n');
      const docs = await collectDocs(dir);
      const kinds = Object.fromEntries(docs.map((d) => [d.path.slice(dir.length + 1), d.kind]));
      expect(kinds['next/1-first.md']).toBe('item');
      expect(kinds['passoff/1-first.md']).toBe('other');
      expect(docs.every((d) => d.itemsDir === join(dir, 'next'))).toBe(true);
    } finally {
      await cleanup(dir);
    }
  });

  test('a board below the root reads the folder beside it, not the root’s', async () => {
    const dir = await tempDir();
    try {
      await Bun.write(join(dir, 'PASSOFF.md'), '# board\n');
      await Bun.write(join(dir, 'examples/PASSOFF.md'), '# board\n');
      const docs = await collectDocs(dir);
      const itemsDirOf = (rel: string) => docs.find((d) => d.path === join(dir, rel))?.itemsDir;
      expect(itemsDirOf('PASSOFF.md')).toBe(join(dir, 'passoff'));
      expect(itemsDirOf('examples/PASSOFF.md')).toBe(join(dir, 'examples', 'passoff'));
    } finally {
      await cleanup(dir);
    }
  });
});

describe('§2.2 — the prose rules now reach them', () => {
  test('violates: a relative date in an item file', async () => {
    const found = await findingsFor({ 'passoff/1-first.md': '# 1. First\n\nOpened today.\n' });
    expect(found).toContain('relative-dates');
  });

  test('passes: the same item file written to the rules', async () => {
    const found = await findingsFor({
      'passoff/1-first.md': '# 1. First\n\nOpened 2026-10-15.\n',
    });
    expect(found).toEqual([]);
  });

  test('violates: a relative date in a scope doc', async () => {
    const found = await findingsFor({
      'docs/incomplete/widget/SCOPE.md': '# Scope\n\nVerified today.\n',
    });
    expect(found).toContain('relative-dates');
  });

  test('violates: an unfilled placeholder in a plan', async () => {
    const found = await findingsFor({
      'docs/incomplete/widget/PLAN.md': '# Plan\n\nBuild with {{BUILD_CMD}}.\n',
    });
    expect(found).toContain('placeholders');
  });

  test('violates: a relative date in the docs index', async () => {
    const found = await findingsFor({ 'docs/README.md': '# Docs\n\nUpdated recently.\n' });
    expect(found).toContain('relative-dates');
  });

  test('passes: the same documents written to the rules', async () => {
    const found = await findingsFor({
      'docs/incomplete/widget/SCOPE.md': '# Scope\n\nVerified 2026-09-15.\n',
      'docs/incomplete/widget/PLAN.md': '# Plan\n\nBuild with `bun run build`.\n',
      'docs/README.md': '# Docs\n\nUpdated 2026-09-15.\n',
    });
    expect(found).toEqual([]);
  });

  test('passes: the repo’s own README is still left alone', async () => {
    const found = await findingsFor({
      'README.md': '# x\n\nShipped recently, with {{TOKEN}}.\n',
    });
    expect(found).toEqual([]);
  });
});
