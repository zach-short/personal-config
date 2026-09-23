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
