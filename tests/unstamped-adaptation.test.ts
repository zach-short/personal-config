/**
 * The migration for repos already adapted under §0.8 (stamp-provenance `DESIGN.md` D3): a file
 * carrying §0.7's header and no stamp is reported, and `doctor --fix` gives it an adapted stamp
 * at the standard version its own preamble names — `unknown` where it names none (DIAL-6). H2
 * is the hazard: the header is agent-written prose, so the fixtures below are the two shapes the
 * real adaptations this was scoped against actually open with, reduced to their first lines,
 * plus the boilerplate's own version line.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import {
  adaptationFix,
  adaptedStandardVersion,
  unstampedAdaptation,
} from '../src/doctor/rules/unstamped-adaptation.ts';
import { kindOf } from '../src/doctor/scan.ts';
import { readText, writeText } from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { readStamp, type StampParts, withStamp } from '../src/lib/stamp.ts';
import { cleanup, tempDir, testConfig } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

const PLAIN: StampParts = {
  version: '0.5.0',
  date: '2026-09-23',
  configHash: 'abcd1234',
  standardVersion: '1.0.2',
  adapted: false,
};

/** One real shape: the bold closes on the header line, and the version line follows. */
const CLOSED_BOLD = [
  '# Agent working standard — leaflet',
  '',
  '**Adapted to this repo 2026-09-14, solo mode.**',
  '',
  '**Standard: personal-config `standard/AGENT-PRACTICES.boilerplate.md` v1.0.2 — adapted, not identical.**',
  '',
  '# Part 1 — The rules that hold everywhere',
  '',
  'R1 holds.',
  '',
].join('\n');

/** The other real shape: the bold closes mid-sentence and the preamble runs on. */
const RUN_ON = [
  '# Agent working standard — leaflet',
  '',
  '**Adapted to this repo 2026-09-14, solo mode**, from the portable standard; Bun 1.2.9 builds',
  'this repo, and nothing below Part 1 is the preamble.',
  '',
  '**Standard version: 1.1.0**',
  '',
  '# Part 1 — The rules that hold everywhere',
  '',
].join('\n');

/** A header with no version anywhere above Part 1; the one below it is not the preamble's. */
const NO_VERSION = [
  '# Agent working standard — leaflet',
  '',
  '**Adapted to this repo 2026-09-14, solo mode.**',
  '',
  '# Part 1 — The rules that hold everywhere',
  '',
  'A rule cites the standard v9.9.9 by number, which says nothing about this file.',
  '',
].join('\n');

function doc(text: string, path = 'docs/AGENT-PRACTICES.md') {
  return {
    path,
    kind: kindOf(path),
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
  };
}

describe('the rule — X1: a fixture that violates it and one that passes', () => {
  test("violates: §0.7's header with no stamp, at the header's line, marked fixable", () => {
    const findings = unstampedAdaptation.check(doc(CLOSED_BOLD));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(3);
    expect(findings[0]?.fixable).toBe(true);
    expect(findings[0]?.message).toContain('from standard v1.0.2');
  });

  test('passes: the same file once it carries a stamp, plain or adapted', () => {
    expect(unstampedAdaptation.check(doc(withStamp(CLOSED_BOLD, PLAIN)))).toEqual([]);
    const adapted = withStamp(CLOSED_BOLD, { ...PLAIN, adapted: true });
    expect(unstampedAdaptation.check(doc(adapted))).toEqual([]);
  });

  test("passes: no header — the boilerplate's own 'not yet' line is not one", () => {
    expect(
      unstampedAdaptation.check(doc('# x\n\n**Adapted: not yet — run Part 0.**\n')),
    ).toEqual([]);
  });

  test("passes: the header quoted mid-line, as Part 0's own instruction quotes it", () => {
    const prompt =
      '- **0.7 — Stamp.** Change the header to `**Adapted to this repo <date>, solo mode.**`\n';
    expect(unstampedAdaptation.check(doc(prompt, 'PART0-PROMPT.md'))).toEqual([]);
  });

  test('the header names no version: still reported, and the message says so', () => {
    expect(unstampedAdaptation.check(doc(NO_VERSION))[0]?.message).toContain('does not name');
  });
});

describe('the version the preamble names (DIAL-6)', () => {
  test('the adapted copies` `boilerplate.md` v1.0.2 form', () => {
    expect(adaptedStandardVersion(CLOSED_BOLD)).toBe('1.0.2');
  });

  test("the boilerplate's own `Standard version:` form, past a runtime version in the way", () => {
    expect(adaptedStandardVersion(RUN_ON)).toBe('1.1.0');
  });

  test('`unknown` when nothing above Part 1 names one', () => {
    expect(adaptedStandardVersion(NO_VERSION)).toBe('unknown');
  });

  test('a bare number beside the word is not a version', () => {
    const text = '**Adapted to this repo 2026-09-14.** The standard is 1.2.0 pages long.\n';
    expect(adaptedStandardVersion(text)).toBe('unknown');
  });
});

describe('the fix', () => {
  test('plans one adapted stamp line at the named version, with a hash that claims nothing', () => {
    const at = { version: '0.6.0', date: '2026-09-23' };
    const file = adaptationFix('/x/docs/AGENT-PRACTICES.md', CLOSED_BOLD, at);
    expect(file.strategy).toBe('mark-adapted');
    expect(readStamp(file.contents)).toEqual({
      version: '0.6.0',
      date: '2026-09-23',
      configHash: '00000000',
      standardVersion: '1.0.2',
      adapted: true,
    });
  });

  test('names `unknown` where the preamble names nothing', () => {
    const at = { version: '0.6.0', date: '2026-09-23' };
    const file = adaptationFix('/x.md', NO_VERSION, at);
    expect(readStamp(file.contents)?.standardVersion).toBe('unknown');
  });

  test('reaches the scan through runDoctorOn, in a tree with no config', async () => {
    const dir = await tempDir('pc-migrate-');
    try {
      await writeText(join(dir, 'docs', 'AGENT-PRACTICES.md'), CLOSED_BOLD);
      const report = await runDoctorOn(dir, { standardVersion: '1.2.0', config: testConfig() });
      expect(report.findings.map((f) => f.rule)).toEqual(['unstamped-adaptation']);
    } finally {
      await cleanup(dir);
    }
  });
});

/** The real bin with its own `$HOME`, the way `doctor-fix.test.ts` runs it. */
async function run(cwd: string, args: string[]) {
  const home = await tempDir('pc-home-');
  try {
    const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
      cwd,
      env: { ...process.env, HOME: home },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    return { code: await proc.exited, stdout };
  } finally {
    await cleanup(home);
  }
}

describe('doctor --fix, end to end', () => {
  test('writes the stamp above everything, keeps every other byte, and the next run is advisory-only with exit 0', async () => {
    const dir = await tempDir('pc-migrate-');
    try {
      const target = join(dir, 'docs', 'AGENT-PRACTICES.md');
      await writeText(target, CLOSED_BOLD);

      const before = await run(dir, ['doctor', '.']);
      expect(before.code).toBe(1);
      expect(before.stdout).toContain('unstamped-adaptation');

      const fix = await run(dir, ['doctor', '.', '--fix']);
      expect(fix.stdout).toContain('fixed 1');
      expect(fix.stdout).toContain('(adapted stamp)');
      expect(fix.code).toBe(0);

      const after = await readText(target);
      expect(readStamp(after)?.adapted).toBe(true);
      expect(readStamp(after)?.standardVersion).toBe('1.0.2');
      expect(after.slice(after.indexOf('\n') + 1)).toBe(CLOSED_BOLD);

      // The fix is only real if the rule stops firing — and what replaces it is D4's advisory:
      // reported, counted, and not an exit code, because v1.0.2 is behind the installed standard.
      const second = await run(dir, ['doctor', '.']);
      expect(second.code).toBe(0);
      expect(second.stdout).not.toContain('unstamped-adaptation');
      expect(second.stdout).toContain('adapted from standard v1.0.2');
      expect(second.stdout).toContain('(advisory)');
      expect(second.stdout).toContain('nothing failing; 1 advisory');
    } finally {
      await cleanup(dir);
    }
  });

  test('--dry-run says what it would stamp and writes nothing', async () => {
    const dir = await tempDir('pc-migrate-');
    try {
      const target = join(dir, 'docs', 'AGENT-PRACTICES.md');
      await writeText(target, CLOSED_BOLD);
      const result = await run(dir, ['doctor', '.', '--fix', '--dry-run']);
      expect(result.stdout).toContain('(adapted stamp), but --dry-run writes nothing');
      expect(result.code).toBe(1);
      expect(await readText(target)).toBe(CLOSED_BOLD);
    } finally {
      await cleanup(dir);
    }
  });

  test('a header naming no version is stamped `unknown`, and the next run keeps asking for it', async () => {
    const dir = await tempDir('pc-migrate-');
    try {
      const target = join(dir, 'docs', 'AGENT-PRACTICES.md');
      await writeText(target, NO_VERSION);
      await run(dir, ['doctor', '.', '--fix']);
      expect(readStamp(await readText(target))?.standardVersion).toBe('unknown');

      const second = await run(dir, ['doctor', '.']);
      expect(second.code).toBe(0);
      expect(second.stdout).toContain('does not name');
      expect(second.stdout).toContain('(advisory)');
    } finally {
      await cleanup(dir);
    }
  });
});
