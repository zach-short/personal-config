/**
 * The version a package claims and the version its changelog documents, held together.
 *
 * Nothing coupled them before 2026-09-17: `package.json` said `0.2.6`, and the only thing making
 * `CHANGELOG.md`'s top heading say `0.2.6` too was somebody remembering. Three releases went out
 * with a `README.md` catalog stamp wrong on all three of its facts for the same reason.
 *
 * **The two version lines are not coupled to each other, and this file does not couple them.**
 * `package.json` versions the CLI; `standard/VERSION` versions the working standard the CLI
 * renders, and `CHANGELOG.md`'s own header says so. They move independently, so they get one
 * check each — a single check spanning both would assert a rule the repo rejects.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { readText } from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';

/**
 * The version a changelog documents at its top, from its text. Pure, so the mismatch case can be
 * driven from a fixture: reading only the real files would mean this never fires until the day
 * it fires in CI, which is a check nobody has seen work.
 *
 * `[Unreleased]` is accepted and skipped rather than rejected. Accumulating changes under it and
 * renaming at the cut is a legitimate discipline, and the released version is then the heading
 * below it — encoding only the other discipline would make this test the thing that decides
 * which one the repo uses, which is not a test's call.
 */
function documentedVersion(changelogText: string): string {
  const headings = changelogText
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.replace(/^##\s+/, '').split(/\s+/)[0] ?? '');

  const top = headings[0];
  if (top === undefined) throw new Error('no "## " version heading at all');
  return /^\[?unreleased\]?$/i.test(top) ? (headings[1] ?? '') : top;
}

async function repoText(...parts: string[]): Promise<string> {
  return readText(join(repoRoot(), ...parts));
}

describe('what the parser reads', () => {
  test('the top heading, when it names a version', () => {
    expect(documentedVersion('# Changelog\n\n## 0.2.6 — 2026-09-17\n\n### Added\n')).toBe(
      '0.2.6',
    );
  });

  test('the heading below [Unreleased], when the top one is that', () => {
    expect(documentedVersion('## [Unreleased]\n\n## 0.3.0 — 2026-09-18\n')).toBe('0.3.0');
    expect(documentedVersion('## Unreleased\n\n## 0.3.0 — 2026-09-18\n')).toBe('0.3.0');
  });

  test('a changelog with no version heading is an error, not an empty string', () => {
    expect(() => documentedVersion('# Changelog\n\nnothing yet\n')).toThrow();
  });
});

describe('the CLI version and its changelog', () => {
  test('package.json names the version the changelog documents', async () => {
    const pkg = JSON.parse(await repoText('package.json')) as { version: string };
    expect(documentedVersion(await repoText('CHANGELOG.md'))).toBe(pkg.version);
  });

  /** The violating half of the pair: the shape this is here to refuse. */
  test('a changelog documenting a different version is caught', () => {
    expect(documentedVersion('## 0.9.9 — 2026-09-17\n')).not.toBe('0.2.6');
  });
});

describe('the standard version and its changelog', () => {
  test('standard/VERSION names the version standard/CHANGELOG.md documents', async () => {
    const declared = (await repoText('standard', 'VERSION')).trim();
    expect(documentedVersion(await repoText('standard', 'CHANGELOG.md'))).toBe(declared);
  });

  /**
   * `src/lib/stamp.ts` writes this into every generated file and `doctor` compares against it,
   * so a `VERSION` carrying a stray `v` or a second line would put that spelling into every
   * stamp on disk before anything noticed.
   */
  test('standard/VERSION is a bare version, with no v and no decoration', async () => {
    expect((await repoText('standard', 'VERSION')).trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
