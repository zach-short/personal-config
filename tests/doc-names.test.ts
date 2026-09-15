import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { scanRepo } from '../src/lib/discover.ts';
import { DEFAULT_DOC_NAMES, readDocNames } from '../src/lib/repo-config.ts';
import { boardFile, ledgerFile } from '../src/render/context.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testContext, testRepoPlan } from './helpers.ts';

const EXPECTATION = { configHash: 'abcd1234', standardVersion: '1.0.0' };

/** §0.2: the repo keeps `NOTES.md` and `NEXT.md`, and nothing renames them. */
const ADOPTED = `${JSON.stringify({ ledgerFile: 'NOTES.md', boardFile: 'NEXT.md' })}\n`;

async function inRepo<T>(
  files: Record<string, string>,
  run: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await tempDir();
  try {
    for (const [path, contents] of Object.entries(files)) {
      await Bun.write(join(dir, path), contents);
    }
    return await run(dir);
  } finally {
    await cleanup(dir);
  }
}

async function rulesFor(files: Record<string, string>): Promise<string[]> {
  return inRepo(files, async (dir) => {
    const report = await runDoctorOn(dir, EXPECTATION);
    return report.findings.map((f) => f.rule);
  });
}

describe('§0.2 — reading the adopted names', () => {
  test('a repo with no config gets the defaults', async () => {
    const names = await inRepo({ 'README.md': '# x\n' }, readDocNames);
    expect(names).toEqual(DEFAULT_DOC_NAMES);
  });

  test('a recorded name outranks the default', async () => {
    const names = await inRepo({ '.personal-config.json': ADOPTED }, readDocNames);
    expect(names).toEqual({ ledger: 'NOTES.md', board: 'NEXT.md' });
  });

  test('Profile P writes empty names, which mean "no such file", not "no default"', async () => {
    const config = `${JSON.stringify({ ledgerFile: '', boardFile: '' })}\n`;
    const names = await inRepo({ '.personal-config.json': config }, readDocNames);
    expect(names).toEqual(DEFAULT_DOC_NAMES);
  });

  test('a corrupt config falls back rather than throwing', async () => {
    const names = await inRepo({ '.personal-config.json': '{ not json\n' }, readDocNames);
    expect(names).toEqual(DEFAULT_DOC_NAMES);
  });
});

describe('§0.2 — doctor checks the adopted ledger', () => {
  test('violates: a relative date in an adopted ledger is flagged', async () => {
    const found = await rulesFor({
      '.personal-config.json': ADOPTED,
      'NOTES.md': '# N\n\nWe fixed this recently.\n',
    });
    expect(found).toContain('relative-dates');
  });

  test('violates: a duplicate step number in an adopted ledger is flagged', async () => {
    const found = await rulesFor({
      '.personal-config.json': ADOPTED,
      'NOTES.md': '# N\n\n**1. One.** Done 2026-09-15.\n\n**1. Two.** Done 2026-09-15.\n',
    });
    expect(found).toContain('step-numbers');
  });

  test('passes: the same ledger written correctly', async () => {
    const found = await rulesFor({
      '.personal-config.json': ADOPTED,
      'NOTES.md': '# N\n\nVerified 2026-09-15.\n\n**1. Opened.** Done 2026-09-15.\n',
    });
    expect(found).not.toContain('relative-dates');
    expect(found).not.toContain('step-numbers');
  });

  test('without the config the same file is not a ledger at all', async () => {
    const found = await rulesFor({ 'NOTES.md': '# N\n\nWe fixed this recently.\n' });
    expect(found).not.toContain('relative-dates');
  });

  test('the default names still classify when a repo keeps both', async () => {
    const found = await rulesFor({
      '.personal-config.json': ADOPTED,
      'HANDOFF.md': '# H\n\nWe fixed this recently.\n',
    });
    expect(found).toContain('relative-dates');
  });
});

describe('§2.3 — DONE cites the adopted ledger', () => {
  const header = '| # | Item | Status | Model | Waits on |\n|---|---|---|---|---|\n';

  test('violates: DONE citing the default name under an adopted one', async () => {
    const found = await rulesFor({
      '.personal-config.json': ADOPTED,
      'NEXT.md': `${header}| 1 | X | \`DONE — HANDOFF 2\` | D | — |\n`,
    });
    expect(found).toContain('board-status');
  });

  test('passes: DONE citing the adopted name', async () => {
    const found = await rulesFor({
      '.personal-config.json': ADOPTED,
      'NEXT.md': `${header}| 1 | X | \`DONE — NOTES 2\` | D | — |\n`,
    });
    expect(found).not.toContain('board-status');
  });
});

describe('§0.2 — the renderer writes the adopted names', () => {
  test('an adopted ledger and board are used as they are', () => {
    const repo = testRepoPlan();
    repo.scan.ledgerDoc = 'NOTES.md';
    repo.scan.boardDoc = 'NEXT.md';
    const ctx = testContext(DEFAULT_ANSWERS, repo);
    expect(ledgerFile(ctx)).toBe('NOTES.md');
    expect(boardFile(ctx)).toBe('NEXT.md');
  });

  test('a repo that has adopted nothing gets the defaults', () => {
    const ctx = testContext(DEFAULT_ANSWERS, testRepoPlan());
    expect(ledgerFile(ctx)).toBe('HANDOFF.md');
    expect(boardFile(ctx)).toBe('PASSOFF.md');
  });
});

describe('§0.2 — discovery adopts what is already there', () => {
  test('a recorded name that exists is adopted, and fixes the profile', async () => {
    const scan = await inRepo(
      { '.personal-config.json': ADOPTED, 'NOTES.md': '# N\n', 'NEXT.md': '# X\n' },
      scanRepo,
    );
    expect(scan.ledgerDoc).toBe('NOTES.md');
    expect(scan.boardDoc).toBe('NEXT.md');
    expect(scan.existingDocs).toContain('NOTES.md');
    expect(scan.impliedProfile).toBe('ledger');
  });

  test('a recorded name that is not on disk is not adopted', async () => {
    const scan = await inRepo({ '.personal-config.json': ADOPTED }, scanRepo);
    expect(scan.ledgerDoc).toBeNull();
    expect(scan.boardDoc).toBeNull();
    expect(scan.impliedProfile).toBeNull();
  });
});
