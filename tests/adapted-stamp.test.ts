/**
 * The adapted state (stamp-provenance `DESIGN.md` D1): one trailing word on the stamp line that
 * withdraws the tool's permission to overwrite while keeping every provenance field readable.
 * The two readers are the whole surface (G2): the guard in `write-plan.ts` must refuse the file,
 * and the drift rule must go on reporting it — the pair board row 68's "done when" asks for by
 * name. The last block here is that pair, with the plain half beside it so the marker is shown
 * to be the one thing that makes the difference.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { stampDrift } from '../src/doctor/rules/stamp-drift.ts';
import { kindOf } from '../src/doctor/scan.ts';
import { readText, writeText } from '../src/lib/disk.ts';
import {
  markAdapted,
  readStamp,
  type StampParts,
  sameButForStampDate,
  stampLine,
  withStamp,
} from '../src/lib/stamp.ts';
import type { PlannedFile } from '../src/lib/types.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { cleanup, tempDir, testConfig } from './helpers.ts';

const PLAIN: StampParts = {
  version: '0.5.0',
  date: '2026-09-23',
  configHash: 'abcd1234',
  standardVersion: '1.0.0',
  adapted: false,
};
const ADAPTED: StampParts = { ...PLAIN, adapted: true };
const BODY = "# A document Part 0 rewrote\n\nEvery word here is the repo's own.\n";

function doc(path: string, text: string) {
  return {
    path,
    kind: kindOf(path),
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
  };
}

function generated(path: string, body: string, stamp: StampParts): PlannedFile {
  return { path, contents: withStamp(body, stamp), label: 'test', strategy: 'overwrite' };
}

describe('the stamp line, with and without the marker', () => {
  test('the marker is written last and read back as `adapted`', () => {
    const line = stampLine(ADAPTED);
    expect(line).toBe(
      '<!-- personal-config v0.5.0 · 2026-09-23 · config abcd1234 · standard v1.0.0 · adapted -->',
    );
    expect(readStamp(line)).toEqual(ADAPTED);
    expect(readStamp(stampLine(PLAIN))).toEqual(PLAIN);
  });

  test('in the `#` spelling too, which has no closing marker to anchor on', () => {
    const line = stampLine(ADAPTED, 'sh');
    expect(line.endsWith(' · adapted')).toBe(true);
    expect(readStamp(line)?.adapted).toBe(true);
    expect(readStamp(stampLine(PLAIN, 'sh'))?.adapted).toBe(false);
  });

  /** H4: a new field must not reach the date, or every re-run rewrites every file again. */
  test('two adapted renderings that differ only by date are the same file', () => {
    const monday = withStamp(BODY, ADAPTED);
    const tuesday = withStamp(BODY, { ...ADAPTED, date: '2026-09-24' });
    expect(sameButForStampDate(monday, tuesday)).toBe(true);
    // The marker is a provenance claim, and a difference in one is never forgiven.
    expect(sameButForStampDate(monday, withStamp(BODY, PLAIN))).toBe(false);
  });

  /**
   * D1's deciding fact (G8), pinned against the pattern 0.5.0 shipped rather than reasoned
   * about: an older CLI must see *no stamp* on an adapted file — and so leave it alone — rather
   * than parse the provenance and overwrite the one file it must not touch. The literal below is
   * `STAMP_PATTERN` at commit `52898d1` (`git show 52898d1:src/lib/stamp.ts`), the last release
   * before the marker existed.
   */
  test('the 0.5.0 reader rejects an adapted line outright, in both spellings', () => {
    const shipped =
      /personal-config v(\S+) · (\d{4}-\d{2}-\d{2}) · config ([0-9a-f]{8}) · standard v(\S+?)\s*(?:-->)?$/m;
    expect(shipped.test(stampLine(PLAIN))).toBe(true);
    expect(shipped.test(stampLine(PLAIN, 'sh'))).toBe(true);
    expect(shipped.test(stampLine(ADAPTED))).toBe(false);
    expect(shipped.test(stampLine(ADAPTED, 'sh'))).toBe(false);
  });
});

describe('markAdapted — the three states a file can start in', () => {
  test('a plain stamp gains the marker in place and keeps every field', () => {
    const marked = markAdapted(withStamp(BODY, PLAIN), stampLine(ADAPTED));
    expect(readStamp(marked)).toEqual(ADAPTED);
    expect(marked.slice(marked.indexOf('\n') + 1)).toBe(BODY);
  });

  test('a stamp already marked comes back byte-identical', () => {
    const text = withStamp(BODY, ADAPTED);
    expect(markAdapted(text, stampLine(ADAPTED))).toBe(text);
  });

  test('no stamp at all gets the line the caller rendered, above everything else', () => {
    expect(markAdapted(BODY, stampLine(ADAPTED))).toBe(`${stampLine(ADAPTED)}\n${BODY}`);
  });

  test('a plain stamp keeps its own fields rather than taking the line offered', () => {
    const offered = stampLine({
      ...ADAPTED,
      configHash: '00000000',
      standardVersion: 'unknown',
    });
    expect(readStamp(markAdapted(withStamp(BODY, PLAIN), offered))).toEqual(ADAPTED);
  });
});

describe('an adapted file is refused by the guard and still reported by the drift rule', () => {
  test('the guard: nothing is written, nothing is backed up, and the plan says why', async () => {
    const dir = await tempDir('pc-adapted-');
    try {
      const target = join(dir, 'docs', 'AGENT-PRACTICES.md');
      const onDisk = withStamp(BODY, ADAPTED);
      await writeText(target, onDisk);

      const fresh = generated(target, '# freshly rendered boilerplate\n', {
        ...PLAIN,
        standardVersion: '1.2.0',
      });
      const changes = await resolvePlan([fresh]);
      expect(changes[0]?.guard).toBe('adapted');
      expect(changes[0]?.after).toBe(onDisk);

      const result = await commitPlan(changes);
      expect(result.written).toEqual([]);
      expect(result.manifest).toBeNull();
      expect(await readText(target)).toBe(onDisk);
    } finally {
      await cleanup(dir);
    }
  });

  test('the drift rule: a standard behind the installed one is an advisory, needing no render and no config', () => {
    const text = withStamp(BODY, ADAPTED);
    const findings = stampDrift(doc('docs/AGENT-PRACTICES.md', text), {
      standardVersion: '1.2.0',
      rendered: null,
      configured: false,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.advisory).toBe(true);
    expect(findings[0]?.message).toContain('adapted from standard v1.0.0');
    expect(findings[0]?.message).toContain('`setup` will not touch');
  });

  test('the drift rule: an adapted file at the installed standard is silent, and a render is never consulted', () => {
    const text = withStamp(BODY, ADAPTED);
    // A render that differs — as it always would for an adapted file — must not become a finding.
    const findings = stampDrift(doc('x.md', text), {
      standardVersion: '1.0.0',
      rendered: 'something else entirely',
      configured: true,
    });
    expect(findings).toEqual([]);
  });

  test('the drift rule: an adapted stamp naming no version keeps asking for one', () => {
    const text = withStamp(BODY, { ...ADAPTED, standardVersion: 'unknown' });
    const findings = stampDrift(doc('x.md', text), {
      standardVersion: '1.2.0',
      rendered: null,
      configured: false,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.advisory).toBe(true);
    expect(findings[0]?.message).toContain('does not name');
  });

  test('end to end: doctor reports the lag in a tree with no config, and nothing fails', async () => {
    const dir = await tempDir('pc-adapted-');
    try {
      await writeText(join(dir, 'docs', 'AGENT-PRACTICES.md'), withStamp(BODY, ADAPTED));
      const report = await runDoctorOn(dir, { standardVersion: '1.2.0', config: testConfig() });
      const drift = report.findings.filter((f) => f.rule === 'stamp-drift');
      expect(drift).toHaveLength(1);
      expect(drift[0]?.advisory).toBe(true);
      expect(report.findings.filter((f) => !f.advisory)).toEqual([]);
    } finally {
      await cleanup(dir);
    }
  });

  /** The plain half of the pair: same file, no marker — written, and its lag is not advisory. */
  test('the same file with a plain stamp is written, and its lag fails the run', async () => {
    const dir = await tempDir('pc-adapted-');
    try {
      const target = join(dir, 'docs', 'AGENT-PRACTICES.md');
      await writeText(target, withStamp(BODY, PLAIN));
      const changes = await resolvePlan([generated(target, '# freshly rendered\n', PLAIN)]);
      expect(changes[0]?.guard).toBe('none');

      const findings = stampDrift(doc(target, withStamp(BODY, PLAIN)), {
        standardVersion: '1.2.0',
        rendered: null,
        configured: true,
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]?.advisory).toBeUndefined();
    } finally {
      await cleanup(dir);
    }
  });
});
