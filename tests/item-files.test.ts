import { describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { itemFiles } from '../src/doctor/rules/item-files.ts';
import type { Doc } from '../src/doctor/scan.ts';
import { loadItemContext, nextFreeItem } from '../src/lib/items.ts';
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
