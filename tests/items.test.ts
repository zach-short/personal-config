import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  findItem,
  type ItemEntry,
  itemFileName,
  itemText,
  listItems,
  listItemsSync,
  SLUG_MAX,
  slugOf,
} from '../src/lib/items.ts';
import { cleanup, tempDir } from './helpers.ts';
import { FIXTURE_BOARD, FIXTURE_ITEMS, makeItemRepo } from './item-fixture.ts';

const LISTING: ItemEntry[] = Object.values(FIXTURE_ITEMS);

describe('D7 — the slug and the file name', () => {
  test('lowercases, joins every run of other characters with one hyphen, trims', () => {
    expect(slugOf('Build the item reader and the `item` doc kind')).toBe(
      'build-the-item-reader-and-the-item-doc-kind',
    );
    expect(slugOf('  --Re-measure: Part 5!!  ')).toBe('re-measure-part-5');
  });

  test('a long title is cut at a hyphen, never mid-word, and fits the limit', () => {
    const title = 'Move every board reader and rule onto item files in one phase';
    const slug = slugOf(title);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug).toBe('move-every-board-reader-and-rule-onto-item-files');
    expect(slug.endsWith('-')).toBe(false);
  });

  test('a slug of exactly the limit is kept whole', () => {
    const exact = 'a'.repeat(SLUG_MAX - 2).concat(' b');
    expect(slugOf(exact)).toHaveLength(SLUG_MAX);
  });

  test('one word longer than the limit has no hyphen to cut at, so it is cut where it stands', () => {
    expect(slugOf('x'.repeat(60))).toBe('x'.repeat(SLUG_MAX));
  });

  test('a title with only punctuation still gets a name in the `<n>-<slug>.md` shape', () => {
    expect(slugOf('?!… — ``')).toBe('item');
    expect(itemFileName('4', '???')).toBe('4-item.md');
  });

  test('the number is the `#` cell verbatim, `1.5` included', () => {
    expect(itemFileName(' 1.5 ', 'Split the first thing')).toBe('1.5-split-the-first-thing.md');
  });
});

describe('D11 — finding an item keys on the leading `<n>-` only', () => {
  test('`1` finds its own file, not `15-…` or `1.5-…`', () => {
    expect(findItem(LISTING, '1')?.name).toBe('1-write-the-first-thing.md');
  });

  test('`1.5` and `15` each find their own', () => {
    expect(findItem(LISTING, '1.5')?.name).toBe('1.5-split-the-first-thing.md');
    expect(findItem(LISTING, '15')?.name).toBe('15-settle-the-question.md');
  });

  test('`10` has no file, and a folder of `1…` names does not hand it one', () => {
    expect(findItem(LISTING, '10')).toBeNull();
  });

  test('`5` does not find `15-…`: the key is anchored at the start of the name', () => {
    expect(findItem(LISTING, '5')).toBeNull();
  });

  test('a non-markdown file with the right prefix is not an item', () => {
    expect(findItem([{ name: '3-notes.txt', text: '' }], '3')).toBeNull();
  });
});

describe('D12 — the file wins, and a 1.x board still reads', () => {
  test('a number with both a file and a section reads the file', () => {
    const found = itemText(LISTING, FIXTURE_BOARD, '15');
    expect(found).toEqual({
      from: 'file',
      name: '15-settle-the-question.md',
      text: FIXTURE_ITEMS['15']?.text ?? '',
    });
  });

  test('a number with only a section reads the section, heading first', () => {
    const found = itemText(LISTING, FIXTURE_BOARD, '10');
    expect(found?.from).toBe('section');
    expect(found?.text.startsWith('### 10. Keep the old shape\n')).toBe(true);
    expect(found?.text).toContain('The section a 1.x board keeps');
    expect(found?.text).not.toContain('### 15.');
  });

  test('a 1.x repo, with no folder at all, reads every section as before', () => {
    expect(itemText([], FIXTURE_BOARD, '15')?.from).toBe('section');
  });

  test('a number with neither is null', () => {
    expect(itemText(LISTING, FIXTURE_BOARD, '99')).toBeNull();
  });
});

describe('D11 — the two loaders', () => {
  test('both read the fixture folder to the same listing, in name order', async () => {
    const repo = await makeItemRepo();
    try {
      const sync = listItemsSync(repo.itemsDir);
      expect(await listItems(repo.itemsDir)).toEqual(sync);
      expect(sync.map((entry) => entry.name)).toEqual([
        '1-write-the-first-thing.md',
        '1.5-split-the-first-thing.md',
        '15-settle-the-question.md',
      ]);
    } finally {
      await repo.done();
    }
  });

  test('an absent folder is an empty listing, not an error, for both', async () => {
    const dir = await tempDir();
    try {
      expect(listItemsSync(join(dir, 'passoff'))).toEqual([]);
      expect(await listItems(join(dir, 'passoff'))).toEqual([]);
    } finally {
      await cleanup(dir);
    }
  });

  test('only markdown files directly inside are listed', async () => {
    const dir = await tempDir();
    try {
      await Bun.write(join(dir, 'passoff/2-two.md'), '# 2. Two\n');
      await Bun.write(join(dir, 'passoff/notes.txt'), 'x\n');
      await Bun.write(join(dir, 'passoff/nested/3-three.md'), '# 3. Three\n');
      const names = listItemsSync(join(dir, 'passoff')).map((entry) => entry.name);
      expect(names).toEqual(['2-two.md']);
    } finally {
      await cleanup(dir);
    }
  });
});
