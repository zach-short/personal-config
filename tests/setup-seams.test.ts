/**
 * The two seams `init` needs from `setup` (init-command Phase 1), pinned before `init` exists.
 *
 * `finish` returns how a run ended and leaves the ending to its caller (BD-4), because `init`
 * keeps no checkpoint and must not discard an unfinished `setup` run by reaching its own end
 * (PLAN §0 F10). And `config.json` records the `you` answers the global files were rendered from
 * under `globalAnswers` (D10, BD-10), a record that neither the merge nor the stamp hash reads.
 */
import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { finish } from '../src/commands/setup.ts';
import { parseCli } from '../src/lib/args.ts';
import { configHash, loadConfig, savedUserConfig } from '../src/lib/config.ts';
import { configFile } from '../src/lib/paths.ts';
import { hasCheckpoint, writeCheckpoint } from '../src/lib/resume.ts';
import type { PlannedChange } from '../src/lib/write-plan.ts';
import { renderUserConfig } from '../src/render/user-config.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testContext, withTty } from './helpers.ts';

/** `X2`: `home()` reads `$HOME` on every call, so the checkpoint lands in a home this test owns. */
async function inTempHome<T>(body: () => Promise<T>): Promise<T> {
  const previous = process.env.HOME ?? '';
  const dir = await tempDir('pc-home-');
  process.env.HOME = dir;
  try {
    return await body();
  } finally {
    process.env.HOME = previous;
    await cleanup(dir);
  }
}

/** `finish` reports through `say`; these tests read the outcome and the disk, not the lines. */
async function quietly<T>(run: () => Promise<T>): Promise<T> {
  const original = console.log;
  console.log = () => {};
  try {
    return await run();
  } finally {
    console.log = original;
  }
}

function newFile(path: string, contents: string): PlannedChange {
  return {
    file: { path, contents, label: 'a planned file', strategy: 'overwrite' },
    before: '',
    after: contents,
    summary: '+1 -0',
    guard: 'none',
  };
}

/** The same file, already on disk with these bytes: the plan an unchanged re-run makes. */
function currentFile(path: string, contents: string): PlannedChange {
  return { ...newFile(path, contents), before: contents, summary: '+0 -0' };
}

describe('finish leaves the ending to its caller (BD-4, F10)', () => {
  /**
   * `written` and `already-current` are the two endings `retiresCheckpoint` retires. At
   * `0214402`, `finish` ended through `endRun` and deleted `run.json` on both, so an `init` that
   * called it would throw away a `setup` run the person had left half answered.
   */
  test('a run that writes its files keeps the checkpoint on disk', async () => {
    await inTempHome(async () => {
      const dir = await tempDir('pc-seam-');
      try {
        await writeCheckpoint([{ id: 'work-kind', value: 'code' }]);
        const doc = join(dir, 'AGENTS.md');
        const ended = await quietly(() =>
          withTty(false, () =>
            finish(parseCli(['setup', '--yes']), [newFile(doc, 'x\n')], {
              ask: async () => '',
              confirm: async (_message, fallback) => fallback,
              pick: async (scans) => scans,
            }),
          ),
        );

        expect(ended).toBe('written');
        expect(existsSync(doc)).toBe(true);
        expect(hasCheckpoint()).toBe(true);
      } finally {
        await cleanup(dir);
      }
    });
  });

  test('a run with nothing to write keeps it too', async () => {
    await inTempHome(async () => {
      const dir = await tempDir('pc-seam-');
      try {
        await writeCheckpoint([{ id: 'work-kind', value: 'code' }]);
        const plan = [currentFile(join(dir, 'AGENTS.md'), 'x\n')];
        const ended = await quietly(() =>
          withTty(false, () =>
            finish(parseCli(['setup', '--yes']), plan, {
              ask: async () => '',
              confirm: async (_message, fallback) => fallback,
              pick: async (scans) => scans,
            }),
          ),
        );

        expect(ended).toBe('already-current');
        expect(hasCheckpoint()).toBe(true);
      } finally {
        await cleanup(dir);
      }
    });
  });
});

describe('config.json records the answers the global files came from (D10)', () => {
  const ANSWERS = {
    ...DEFAULT_ANSWERS,
    workKind: 'non-code',
    configWeight: 'light',
    usesGit: 'no',
    outputStyle: 'proactive',
    chatStyle: 'none',
    writeDoc: 'yes',
    writeDocCheck: 'every',
  };

  function written(): Record<string, unknown> {
    const file = renderUserConfig(testContext(ANSWERS))[0];
    if (!file) throw new Error('renderUserConfig planned nothing');
    return JSON.parse(file.contents) as Record<string, unknown>;
  }

  test('globalAnswers holds the track and the four answers `answers` does not', () => {
    const record = written().globalAnswers as Record<string, unknown>;
    expect(record.workKind).toBe('non-code');
    expect(record.configWeight).toBe('light');
    expect(record.usesGit).toBe('no');
    expect(record.outputStyle).toBe('proactive');
    expect(record.chatStyle).toBe('none');
    expect(record.writeDoc).toBe('yes');
    expect(record.writeDocCheck).toBe('every');
    expect(record.commitPolicy).toBe('print-blocks');
  });

  test('it holds no answer from outside the `you` phase', () => {
    const keys = Object.keys(written().globalAnswers as Record<string, unknown>);
    expect(keys.filter((key) => key.startsWith('practices.'))).toEqual([]);
    expect(keys).not.toContain('workProfile');
    expect(keys).not.toContain('trackMode');
    expect(keys).not.toContain('mode');
  });

  test('`answers` is unchanged by it: the track is still not saved as a default', () => {
    const answers = written().answers as Record<string, unknown>;
    expect(answers.workKind).toBeUndefined();
    expect(answers.outputStyle).toBeUndefined();
  });

  test('read back, it is in the saved layer and in neither the merge nor the hash', async () => {
    const body = written();
    await Bun.write(configFile(), `${JSON.stringify(body, null, 2)}\n`);
    try {
      const saved = await savedUserConfig();
      expect(saved.globalAnswers?.workKind).toBe('non-code');

      const merged = await loadConfig(parseCli(['setup']), null);
      expect(merged.answers.workKind).not.toBe('non-code');
      expect(merged.answers.chatStyle).toBe('ste');
      expect('globalAnswers' in merged).toBe(false);

      const { globalAnswers: _record, ...withoutRecord } = body;
      await Bun.write(configFile(), JSON.stringify(withoutRecord));
      expect(await configHash(await loadConfig(parseCli(['setup']), null))).toBe(
        await configHash(merged),
      );
    } finally {
      await Bun.write(configFile(), '{}');
    }
  });

  test('a config.json written before the key existed still loads, with no record', async () => {
    await Bun.write(
      configFile(),
      JSON.stringify({ answers: { commitPolicy: 'agent-commits' } }),
    );
    try {
      const saved = await savedUserConfig();
      expect(saved.globalAnswers).toBeUndefined();
      const merged = await loadConfig(parseCli(['setup']), null);
      expect(merged.answers.commitPolicy).toBe('agent-commits');
    } finally {
      await Bun.write(configFile(), '{}');
    }
  });

  test('a malformed record is refused by name and field', async () => {
    await Bun.write(configFile(), JSON.stringify({ globalAnswers: { workKind: 3 } }));
    try {
      await expect(savedUserConfig()).rejects.toThrow(
        '"globalAnswers.workKind" is not a string',
      );
    } finally {
      await Bun.write(configFile(), '{}');
    }
  });
});
