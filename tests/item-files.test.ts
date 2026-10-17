import { describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { itemFiles } from '../src/doctor/rules/item-files.ts';
import type { Doc } from '../src/doctor/scan.ts';
import { loadItemContext, nextFreeItem } from '../src/lib/items.ts';
import { testConfig } from './helpers.ts';
import { FIXTURE_BOARD, FIXTURE_ITEMS, type ItemRepo, makeItemRepo } from './item-fixture.ts';

/** The fixture's board without item 15's left-behind section, so the clean case is clean. */
const CLEAN_BOARD = FIXTURE_BOARD.replace(/### 15\.[\s\S]*$/, '');

async function boardDoc(repo: ItemRepo): Promise<Doc> {
  const path = join(repo.dir, 'PASSOFF.md');
  const text = await Bun.file(path).text();
  return {
    path,
    kind: 'board',
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
    itemsDir: repo.itemsDir,
  };
}

/** The rule as `doctor` builds it for this repo, run on its board. */
async function messages(repo: ItemRepo): Promise<string[]> {
  const rule = itemFiles(await loadItemContext(repo.dir, 'passoff'));
  const doc = await boardDoc(repo);
  return rule.appliesTo(doc) ? rule.check(doc).map((f) => f.message) : [];
}

async function withRepo(run: (repo: ItemRepo) => Promise<void>, board = CLEAN_BOARD) {
  const repo = await makeItemRepo();
  try {
    await Bun.write(join(repo.dir, 'PASSOFF.md'), board);
    await run(repo);
  } finally {
    await repo.done();
  }
}

describe('D11 — the table and the folder agree', () => {
  test('passes: the fixture, with every number in one place', async () => {
    await withRepo(async (repo) => expect(await messages(repo)).toEqual([]));
  });

  test('violates: a number with a file and a section — the section is left behind (D12)', async () => {
    await withRepo(async (repo) => {
      expect(await messages(repo)).toEqual([expect.stringContaining('item 15 has a file')]);
    }, FIXTURE_BOARD);
  });

  test('violates: a file whose number has no row', async () => {
    await withRepo(async (repo) => {
      await Bun.write(join(repo.itemsDir, '20-a-stray.md'), '# 20. A stray\n');
      expect(await messages(repo)).toEqual(['item 20 has a file and no row on the board']);
    });
  });

  test('violates: two files for one number, reported on the one not read', async () => {
    await withRepo(async (repo) => {
      await Bun.write(join(repo.itemsDir, '1-another-copy.md'), '# 1. Another copy\n');
      const found = await messages(repo);
      expect(found).toHaveLength(1);
      expect(found[0]).toContain('item 1 already has a file, 1-another-copy.md');
    });
  });

  test('violates: a heading that names another item, and a file with no heading', async () => {
    await withRepo(async (repo) => {
      const split = FIXTURE_ITEMS['1.5'];
      if (!split) throw new Error('fixture has no item 1.5');
      await Bun.write(join(repo.itemsDir, split.name), '# 15. Split the first thing\n');
      await Bun.write(join(repo.itemsDir, FIXTURE_ITEMS['1']?.name ?? ''), 'No heading.\n');
      expect(await messages(repo)).toEqual([
        expect.stringContaining('the first line must be `# 1. <Title>`'),
        'the heading says item 15 and the name says item 1.5',
      ]);
    });
  });

  test('violates: a name outside `<n>-<slug>.md`, reported for that alone', async () => {
    await withRepo(async (repo) => {
      await Bun.write(join(repo.itemsDir, 'Notes on 3.md'), '# 3. Notes\n');
      expect(await messages(repo)).toEqual([expect.stringContaining('`<n>-<slug>.md`')]);
    });
  });

  test('violates: an open row with neither a file nor a section', async () => {
    const board = CLEAN_BOARD.replace(
      '| 15 |',
      '| 16 | Nothing written yet | `OPEN` | Opus 5.5 | E | nothing | `src/e.ts` |\n| 15 |',
    );
    await withRepo(async (repo) => {
      expect(await messages(repo)).toEqual(['item 16 has no file and no section']);
    }, board);
  });

  test('passes: a 1.x repo, which has no folder, is not this rule’s to read (D12)', async () => {
    await withRepo(async (repo) => {
      await rm(repo.itemsDir, { recursive: true });
      expect(await messages(repo)).toEqual([]);
    }, FIXTURE_BOARD);
  });
});

describe('D16 — a number is never reused', () => {
  test('violates: a row whose number the archive already holds', async () => {
    await withRepo(async (repo) => {
      await Bun.write(join(repo.archiveItems, '10-an-older-item.md'), '# 10. An older item\n');
      expect(await messages(repo)).toEqual([
        expect.stringContaining('item 10 is already in the archive'),
      ]);
    });
  });

  /** A `COMMITTED` row whose file is archived is the record itself, as a `DONE` one is (D2). */
  test('passes: a COMMITTED row whose file is in the archive, with no live file or section', async () => {
    const board = CLEAN_BOARD.replace(
      '`DONE` — 2026-10-15',
      '`COMMITTED, 2026-10-15, a1b2c3d`',
    );
    await withRepo(async (repo) => expect(await messages(repo)).toEqual([]), board);
  });

  test('the next free number is the highest of the rows, the live files and the archive', () => {
    const live = [{ name: '30-live.md', text: '' }];
    const archived = [{ name: '41-closed.md', text: '' }];
    expect(nextFreeItem(['1', '1.5', '15'], [], [])).toBe(16);
    expect(nextFreeItem(['1', '1.5', '15'], live, [])).toBe(31);
    expect(nextFreeItem(['1', '1.5', '15'], live, archived)).toBe(42);
    expect(nextFreeItem(['2.5'], [], [])).toBe(3);
    expect(nextFreeItem([], [], [])).toBe(1);
  });
});

/**
 * A board below the root is checked against the archive beside it, not the root's. This is
 * `examples/PASSOFF.md` under `.` on 2026-10-16: the fold put items 1 to 91 in this repo's
 * archive, and rows 1 to 5 of the fictional board were reported as reused.
 */
describe('D16 — a nested board is checked against its own archive', () => {
  /** A fictional repo inside the fixture repo, with item 7 open: 7 is in the outer archive. */
  async function nestedBoard(repo: ItemRepo): Promise<string> {
    const dir = join(repo.dir, 'examples');
    await Bun.write(
      join(dir, 'PASSOFF.md'),
      '# Board\n\n| # | Task | Status | Model | Lane | Waits on | Files it owns |\n|---|---|---|---|---|---|---|\n| 7 | A fictional item | `OPEN` | Opus 5.5 | A | nothing | `src/x.ts` |\n',
    );
    await Bun.write(join(dir, 'passoff', '7-a-fictional-item.md'), '# 7. A fictional item\n');
    return dir;
  }

  async function reuseFindings(repo: ItemRepo): Promise<string[]> {
    const report = await runDoctorOn(repo.dir, {
      standardVersion: '1.0.0',
      config: testConfig(),
    });
    return report.findings
      .filter((f) => f.rule === 'item-files' && f.message.includes('already in the archive'))
      .map((f) => `${f.file.slice(repo.dir.length + 1)}: ${f.message}`);
  }

  test('passes: its number is in the outer root’s archive and not its own', async () => {
    await withRepo(async (repo) => {
      await nestedBoard(repo);
      expect(await reuseFindings(repo)).toEqual([]);
    });
  });

  test('violates: its number is in the archive its own config names', async () => {
    await withRepo(async (repo) => {
      const dir = await nestedBoard(repo);
      const archive = join(dir, 'archive');
      await Bun.write(
        join(dir, '.personal-config.json'),
        `${JSON.stringify({ archiveHome: archive })}\n`,
      );
      await Bun.write(join(archive, 'passoff', '7-an-older-item.md'), '# 7. An older item\n');
      expect(await reuseFindings(repo)).toEqual([
        'examples/PASSOFF.md: item 7 is already in the archive — a number is never reused (D16)',
      ]);
    });
  });

  test('violates: the root’s own board, in the same tree, still reads the root’s archive', async () => {
    await withRepo(async (repo) => {
      await nestedBoard(repo);
      await Bun.write(join(repo.archiveItems, '10-an-older-item.md'), '# 10. An older item\n');
      expect(await reuseFindings(repo)).toEqual([
        'PASSOFF.md: item 10 is already in the archive — a number is never reused (D16)',
      ]);
    });
  });
});
