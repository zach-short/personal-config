import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { writeText } from '../src/lib/disk.ts';
import { type StampParts, sameButForStampDate, withStamp } from '../src/lib/stamp.ts';
import type { PlannedFile } from '../src/lib/types.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { cleanup, tempDir } from './helpers.ts';

const MONDAY: StampParts = {
  version: '0.2.6',
  date: '2026-09-16',
  configHash: 'abcd1234',
  standardVersion: '1.0.3',
  adapted: false,
};

const TUESDAY: StampParts = { ...MONDAY, date: '2026-09-17' };

const BODY = '# Router\n\nRead the ledger first.\n';

function generated(path: string, body: string, stamp: StampParts): PlannedFile {
  return { path, contents: withStamp(body, stamp), label: 'test', strategy: 'overwrite' };
}

describe('a stamp-date-only difference is not a change', () => {
  test('two renderings of the same body differ only by the date', () => {
    expect(sameButForStampDate(withStamp(BODY, MONDAY), withStamp(BODY, TUESDAY))).toBe(true);
  });

  /**
   * The case the whole fix exists for, asserted end to end rather than on the helper: yesterday's
   * file is on disk, today's run renders the same body, and the plan has to report it unchanged.
   */
  test('a re-run on a later day writes nothing and takes no backup', async () => {
    const dir = await tempDir();
    try {
      const path = join(dir, 'CLAUDE.md');
      await writeText(path, withStamp(BODY, MONDAY));

      const changes = await resolvePlan([generated(path, BODY, TUESDAY)]);
      expect(changes[0]?.summary).toBe('unchanged');

      const result = await commitPlan(changes);
      expect(result.written).toEqual([]);
      expect(result.skipped).toEqual([path]);
      // No files written means nothing to lose, so there is no backup directory to restore from.
      expect(result.manifest).toBeNull();
    } finally {
      await cleanup(dir);
    }
  });

  test('the file on disk keeps the date it was actually written', async () => {
    const dir = await tempDir();
    try {
      const path = join(dir, 'CLAUDE.md');
      await writeText(path, withStamp(BODY, MONDAY));
      await commitPlan(await resolvePlan([generated(path, BODY, TUESDAY)]));
      expect(await Bun.file(path).text()).toContain('2026-09-16');
    } finally {
      await cleanup(dir);
    }
  });
});

/**
 * The negative cases are this fix's real failure mode. Forgiving one field too many would make a
 * file keep a stamp claiming answers that no longer produced it — and `doctor`'s stamp-drift rule
 * reads exactly that field, so it would go on passing while reading a stale value.
 */
describe('everything else in the stamp is still a change', () => {
  test('a moved config hash is a change, though the body is identical', async () => {
    const dir = await tempDir();
    try {
      const path = join(dir, 'CLAUDE.md');
      await writeText(path, withStamp(BODY, MONDAY));

      const answered = { ...TUESDAY, configHash: '99998888' };
      const changes = await resolvePlan([generated(path, BODY, answered)]);
      expect(changes[0]?.summary).not.toBe('unchanged');

      const result = await commitPlan(changes);
      expect(result.written).toEqual([path]);
      expect(await Bun.file(path).text()).toContain('99998888');
    } finally {
      await cleanup(dir);
    }
  });

  test('a moved version and a moved standard version are both changes', () => {
    const upgraded = { ...TUESDAY, version: '0.3.0' };
    const restandardised = { ...TUESDAY, standardVersion: '1.1.0' };
    expect(sameButForStampDate(withStamp(BODY, MONDAY), withStamp(BODY, upgraded))).toBe(false);
    expect(sameButForStampDate(withStamp(BODY, MONDAY), withStamp(BODY, restandardised))).toBe(
      false,
    );
  });

  test('a changed body on the same day is a change', () => {
    const edited = `${BODY}\nAnd the board second.\n`;
    expect(sameButForStampDate(withStamp(BODY, MONDAY), withStamp(edited, MONDAY))).toBe(false);
  });

  /** An absent file has no stamp to compare and must never be mistaken for an unchanged one. */
  test('a new file is a change', async () => {
    const dir = await tempDir();
    try {
      const path = join(dir, 'CLAUDE.md');
      expect(sameButForStampDate('', withStamp(BODY, TUESDAY))).toBe(false);
      const result = await commitPlan(await resolvePlan([generated(path, BODY, TUESDAY)]));
      expect(result.written).toEqual([path]);
    } finally {
      await cleanup(dir);
    }
  });
});
