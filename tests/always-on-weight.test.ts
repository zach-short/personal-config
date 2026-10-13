import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ALWAYS_ON_CEILING, alwaysOnWeight } from '../src/doctor/rules/always-on-weight.ts';
import {
  LEDGER_CHAR_CEILING,
  ledgerFoldCeiling,
} from '../src/doctor/rules/ledger-fold-ceiling.ts';
import { kindOf } from '../src/doctor/scan.ts';
import { claudeDir, claudeProjectsDir, claudeRulesDir } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

// Every path below sits under `$HOME`, which `tests/preload.ts` points at a sandbox (X2).
// Only what these tests write is removed: the sandbox is shared by every file in the run.
afterEach(async () => {
  await rm(join(claudeDir(), 'CLAUDE.md'), { force: true });
  await rm(claudeRulesDir(), { recursive: true, force: true });
  await rm(join(claudeDir(), 'projects'), { recursive: true, force: true });
});

async function writeAt(path: string, text: string): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await Bun.write(path, text);
}

async function withRepo<T>(claudeMd: string, run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await tempDir();
  try {
    await Bun.write(join(dir, 'CLAUDE.md'), claudeMd);
    return await run(dir);
  } finally {
    await cleanup(dir);
  }
}

describe('always-on-weight', () => {
  test('flags always-loaded context over the ceiling', async () => {
    await writeAt(join(claudeDir(), 'CLAUDE.md'), 'g'.repeat(ALWAYS_ON_CEILING * 2));
    await writeAt(join(claudeRulesDir(), 'big.md'), 'r'.repeat(ALWAYS_ON_CEILING * 2));
    const found = await withRepo('p'.repeat(100), (dir) => alwaysOnWeight(dir, {}));
    expect(found.map((f) => f.rule)).toEqual(['always-on-weight']);
    expect(found[0]?.message).toContain('big.md');
  });

  test('counts the project memory index when one resolves for the repo', async () => {
    const found = await withRepo('p', async (dir) => {
      await writeAt(
        join(claudeProjectsDir(dir), 'memory', 'MEMORY.md'),
        'm'.repeat(ALWAYS_ON_CEILING * 5),
      );
      return alwaysOnWeight(dir, {});
    });
    expect(found[0]?.message).toContain('MEMORY.md');
  });

  test('passes: a small always-on layer', async () => {
    await writeAt(join(claudeDir(), 'CLAUDE.md'), 'small global file\n');
    const found = await withRepo('# repo\n', (dir) => alwaysOnWeight(dir, {}));
    expect(found).toEqual([]);
  });

  test('passes: a rule scoped with paths: frontmatter is not always loaded', async () => {
    const scoped = `---\npaths: ["**/*.go"]\n---\n${'x'.repeat(ALWAYS_ON_CEILING * 8)}`;
    await writeAt(join(claudeRulesDir(), 'go.md'), scoped);
    const found = await withRepo('# repo\n', (dir) => alwaysOnWeight(dir, {}));
    expect(found).toEqual([]);
  });

  test('passes: the doctor.alwaysOnCeiling answer raises the ceiling', async () => {
    await writeAt(join(claudeDir(), 'CLAUDE.md'), 'g'.repeat(ALWAYS_ON_CEILING * 8));
    const answers = { 'doctor.alwaysOnCeiling': String(ALWAYS_ON_CEILING * 10) };
    const found = await withRepo('# repo\n', (dir) => alwaysOnWeight(dir, answers));
    expect(found).toEqual([]);
  });
});

function ledgerDoc(path: string, text: string) {
  return {
    path,
    kind: kindOf(path),
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
  };
}

describe('ledger-fold-ceiling', () => {
  const rule = ledgerFoldCeiling(undefined);

  test('flags a ledger over the character ceiling', () => {
    const doc = ledgerDoc('HANDOFF.md', `# H\n\n${'x'.repeat(LEDGER_CHAR_CEILING)}`);
    expect(rule.appliesTo(doc)).toBe(true);
    expect(rule.check(doc).map((f) => f.rule)).toEqual(['ledger-fold-ceiling']);
  });

  test('flags a board over the character ceiling', () => {
    const doc = ledgerDoc('PASSOFF.md', `# P\n\n${'x'.repeat(LEDGER_CHAR_CEILING)}`);
    expect(rule.appliesTo(doc)).toBe(true);
    expect(rule.check(doc)).toHaveLength(1);
  });

  test('passes: a ledger under the ceiling', () => {
    expect(rule.check(ledgerDoc('HANDOFF.md', '# H\n\nshort\n'))).toEqual([]);
  });

  test('passes: an override answer raises the ceiling', () => {
    const doc = ledgerDoc('HANDOFF.md', 'x'.repeat(LEDGER_CHAR_CEILING + 10));
    expect(ledgerFoldCeiling(String(LEDGER_CHAR_CEILING * 2)).check(doc)).toEqual([]);
  });

  test('passes: a file that is neither a ledger nor a board is out of scope', () => {
    expect(rule.appliesTo(ledgerDoc('notes.md', 'x'))).toBe(false);
  });
});
