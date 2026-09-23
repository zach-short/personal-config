/**
 * The one version ordering in `src/` (upgrade-command `DESIGN.md` D4), pinned at the boundaries
 * a string compare or a naive split gets wrong. The drift rule and `upgrade` both stand on it, so
 * the rule's two sides of the `1.10.0`/`1.9.0` boundary are pinned here too — that is the proof
 * it was rewired rather than left holding a copy.
 */
import { describe, expect, test } from 'bun:test';
import { stampDrift } from '../src/doctor/rules/stamp-drift.ts';
import type { Doc } from '../src/doctor/scan.ts';
import { compareVersions, isOlder, parseVersion, versionsBetween } from '../src/lib/semver.ts';
import { stampLine } from '../src/lib/stamp.ts';

describe('parseVersion', () => {
  test('reads one to three whole numbers, a missing part as zero, a leading v allowed', () => {
    expect(parseVersion('1.2.0')).toEqual([1, 2, 0]);
    expect(parseVersion('1.10')).toEqual([1, 10, 0]);
    expect(parseVersion('2')).toEqual([2, 0, 0]);
    expect(parseVersion('v1.0.2')).toEqual([1, 0, 2]);
  });

  test('refuses anything else rather than guessing where it orders', () => {
    for (const text of ['unknown', '', '1.2.x', '1.2.3.4', '1.2.0-rc.1', '1..2', 'v']) {
      expect(parseVersion(text)).toBeNull();
    }
  });
});

describe('compareVersions', () => {
  test('1.10.0 is newer than 1.9.0 — the boundary a string compare gets backwards', () => {
    expect('1.10.0' < '1.9.0').toBe(true);
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(isOlder('1.9.0', '1.10.0')).toBe(true);
    expect(isOlder('1.10.0', '1.9.0')).toBe(false);
  });

  test('each part outranks everything to its right', () => {
    expect(isOlder('1.99.99', '2.0.0')).toBe(true);
    expect(isOlder('1.0.99', '1.1.0')).toBe(true);
    expect(isOlder('0.9.9', '1.0.0')).toBe(true);
  });

  test('equal, including a hand-typed short form beside the long one (H6)', () => {
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(isOlder('1.0.0', '1.0.0')).toBe(false);
  });

  test('null, not zero, where either side cannot be read — and so never older', () => {
    expect(compareVersions('unknown', '1.2.0')).toBeNull();
    expect(compareVersions('1.2.0', 'unknown')).toBeNull();
    expect(isOlder('unknown', '1.2.0')).toBe(false);
  });
});

describe('versionsBetween', () => {
  const all = ['1.0.0', '1.0.2', '1.9.0', '1.10.0', '1.2.0', '2.0.0', 'unknown'];

  test('after `from`, up to and including `to`, newest first', () => {
    expect(versionsBetween(all, '1.0.2', '1.10.0')).toEqual(['1.10.0', '1.9.0', '1.2.0']);
  });

  test('nothing between a version and itself', () => {
    expect(versionsBetween(all, '1.10.0', '1.10.0')).toEqual([]);
  });

  test('nothing when `from` is ahead of `to`', () => {
    expect(versionsBetween(all, '2.0.0', '1.0.0')).toEqual([]);
  });
});

describe('the drift rule, on the shared comparator', () => {
  function adaptedDoc(standardVersion: string): Doc {
    const text = `${stampLine({
      version: '0.5.0',
      date: '2026-09-23',
      configHash: '00000000',
      standardVersion,
      adapted: true,
    })}\n# Standard\n`;
    return {
      path: 'docs/AGENT-PRACTICES.md',
      kind: 'standard',
      text,
      lines: text.split('\n'),
      isTemplate: false,
      ledgerStem: 'HANDOFF',
    };
  }

  const expectation = (installed: string) => ({
    standardVersion: installed,
    rendered: null,
    configured: false,
  });

  test('violates: adapted from 1.9.0 with 1.10.0 installed reports a lag', () => {
    const findings = stampDrift(adaptedDoc('1.9.0'), expectation('1.10.0'));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('`personal-config upgrade`');
  });

  test('passes: adapted from 1.10.0 with 1.9.0 installed is not behind', () => {
    expect(stampDrift(adaptedDoc('1.10.0'), expectation('1.9.0'))).toEqual([]);
  });
});
