import { describe, expect, test } from 'bun:test';
import { join, relative } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { cleanup, tempDir, testConfig } from './helpers.ts';

const EXPECTATION = { standardVersion: '1.0.0', config: testConfig() };

/** Same scratch tree HANDOFF 16 hit the bug on: an index citing the folder it indexes, plus an
 * in-tree doc citing the same name from outside the archive. */
async function scratchArchive(): Promise<string> {
  const dir = await tempDir();
  await Bun.write(
    join(dir, 'archive/INDEX.md'),
    '# archive — index\n\n- **week-grid/** ✅ — cites `week-grid`. Closed 2026-09-14.\n',
  );
  await Bun.write(join(dir, 'archive/week-grid/NOTES.md'), 'x\n');
  await Bun.write(join(dir, 'HANDOFF.md'), '# H\n\nSee `week-grid` for the old approach.\n');
  return dir;
}

async function rulesFor(root: string): Promise<string[]> {
  const report = await runDoctorOn(root, EXPECTATION);
  return report.findings.map((f) => f.rule);
}

describe('§7 — archived citations answer the same regardless of root spelling', () => {
  test('an archive index citing its own folder is not a finding, root spelled absolutely', async () => {
    const dir = await scratchArchive();
    try {
      expect(await rulesFor(join(dir, 'archive'))).not.toContain('archived-citations');
    } finally {
      await cleanup(dir);
    }
  });

  test('same tree, root spelled relatively, is still not a finding', async () => {
    const dir = await scratchArchive();
    try {
      const relativeRoot = relative(process.cwd(), join(dir, 'archive'));
      expect(await rulesFor(relativeRoot)).not.toContain('archived-citations');
    } finally {
      await cleanup(dir);
    }
  });

  test('an in-tree doc citing the same name is a finding, root spelled absolutely', async () => {
    const dir = await scratchArchive();
    try {
      expect(await rulesFor(dir)).toContain('archived-citations');
    } finally {
      await cleanup(dir);
    }
  });

  test('same tree, root spelled relatively, is still a finding', async () => {
    const dir = await scratchArchive();
    try {
      const relativeRoot = relative(process.cwd(), dir);
      expect(await rulesFor(relativeRoot)).toContain('archived-citations');
    } finally {
      await cleanup(dir);
    }
  });
});

/**
 * Per-item-board D15. Closed item files land in the archive's items folder, which mirrors the
 * live one; counted as a moved name, it made every live mention of the word a finding (G36).
 */
async function archiveWithItems(config?: unknown): Promise<string> {
  const dir = await tempDir();
  if (config !== undefined) {
    await Bun.write(join(dir, '.personal-config.json'), `${JSON.stringify(config)}\n`);
  }
  await Bun.write(
    join(dir, 'archive/INDEX.md'),
    '# archive — index\n\n## Closed\n\n- **passoff/7-old.md** ✅ - item 7, closed 2026-10-15.\n- **tasks/** ✅ - closed 2026-10-15.\n',
  );
  await Bun.write(join(dir, 'archive/passoff/7-old.md'), '# 7. Old\n');
  await Bun.write(join(dir, 'archive/tasks/NOTES.md'), 'x\n');
  await Bun.write(join(dir, 'HANDOFF.md'), '# H\n\nRun personal-config passoff next.\n');
  await Bun.write(join(dir, 'NOTES.md'), '# N\n\nThe tasks folder.\n');
  return dir;
}

async function citedNames(root: string): Promise<string[]> {
  const report = await runDoctorOn(root, EXPECTATION);
  return report.findings
    .filter((f) => f.rule === 'archived-citations')
    .map((f) => f.message.match(/`([^`]+)`/)?.[1] ?? '');
}

describe('per-item-board D15 — the archive items folder is not a moved name', () => {
  test('passes: a live mention of the word `passoff` is not a finding', async () => {
    const dir = await archiveWithItems();
    try {
      expect(await citedNames(dir)).not.toContain('passoff');
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: a real moved folder in the same archive is still a finding', async () => {
    const dir = await archiveWithItems();
    try {
      expect(await citedNames(dir)).toContain('tasks');
    } finally {
      await cleanup(dir);
    }
  });

  test('the skip follows the configured folder, not the word `passoff`', async () => {
    const dir = await archiveWithItems({ itemsDir: 'tasks' });
    try {
      const names = await citedNames(dir);
      expect(names).not.toContain('tasks');
      expect(names).toContain('passoff');
    } finally {
      await cleanup(dir);
    }
  });
});
