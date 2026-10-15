import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, tempDir } from './helpers.ts';

/**
 * One repo every item reader is tested against (per-item-board `PLAN.md` BD-3). D11's promise is
 * that `passoff next`, `board-status` and `unfolded` agree on every item, and the only proof of
 * that is the same board, folder and archive read by all of them. It lives here and not under
 * `tests/fixtures/`, which is generated and ignored.
 *
 * The numbers are chosen to trip a prefix match: `1`, `1.5`, `10` and `15` all start with `1`.
 * Item 10 has a board section and no file, which is the 1.x fallback (D12); item 15 has both, and
 * the file must win. Item 7 is closed: its file is in the archive's items folder only.
 */

export const FIXTURE_BOARD = `# Board

| # | Task | Status | Model | Lane | Waits on | Files it owns |
|---|---|---|---|---|---|---|
| 1 | Write the first thing | \`OPEN\` | Opus 5.5 | A | nothing | \`src/a.ts\` |
| 1.5 | Split the first thing | \`OPEN\` | Opus 5.5 | A | item 1 | \`src/a.ts\` |
| 7 | Close the old thing | \`DONE\` — 2026-10-15 | Opus 5.5 | B | nothing | \`src/b.ts\` |
| 10 | Keep the old shape | \`HELD\` | Opus 5.5 | C | item 1 | \`src/c.ts\` |
| 15 | Settle the question | \`OPEN\` | Opus 5.5 | D | nothing | \`src/d.ts\` |

### 10. Keep the old shape

The section a 1.x board keeps under its table.

### 15. Settle the question

The section that was left behind when the file was written.
`;

/** Each live item file's name and text, keyed by item number. */
export const FIXTURE_ITEMS: Record<string, { name: string; text: string }> = {
  '1': {
    name: '1-write-the-first-thing.md',
    text: '# 1. Write the first thing\n\nThe first item file.\n',
  },
  '1.5': {
    name: '1.5-split-the-first-thing.md',
    text: '# 1.5. Split the first thing\n\nThe item between 1 and 2.\n',
  },
  '15': {
    name: '15-settle-the-question.md',
    text: '# 15. Settle the question\n\nThe file, which wins over the section.\n',
  },
};

export const FIXTURE_ARCHIVED_ITEM = {
  name: '7-close-the-old-thing.md',
  text: '# 7. Close the old thing\n\n## Close-out, 2026-10-15\n\nDone 2026-10-15.\n',
};

export type ItemRepo = {
  /** The repo root: board, config and `passoff/`. */
  dir: string;
  /** The live items folder. */
  itemsDir: string;
  /** The archive home the repo's config names. */
  archive: string;
  /** The archive's items folder, where closed item files go (D6). */
  archiveItems: string;
  /** Removes the repo and its archive together. */
  done: () => Promise<void>;
};

/**
 * Repo and archive under one temp parent, so one cleanup removes both.
 *
 * `git` gives the repo an empty `.git` folder, which is what `insideGit` looks for, so a `DONE`
 * item stays live as it does in a repo (standard 2.1.1). It is not a repository git can read, so
 * `board-status` still reads a `COMMITTED` hash as "cannot verify". Without it the root is a
 * folder with no git, where `DONE` is final and folds.
 */
export async function makeItemRepo({ git = true }: { git?: boolean } = {}): Promise<ItemRepo> {
  const parent = await tempDir('pc-items-');
  const dir = join(parent, 'repo');
  const archive = join(parent, 'archive');
  const itemsDir = join(dir, 'passoff');
  const archiveItems = join(archive, 'passoff');

  await Bun.write(join(dir, 'PASSOFF.md'), FIXTURE_BOARD);
  await Bun.write(
    join(dir, '.personal-config.json'),
    `${JSON.stringify({ archiveHome: archive })}\n`,
  );
  for (const item of Object.values(FIXTURE_ITEMS)) {
    await Bun.write(join(itemsDir, item.name), item.text);
  }
  await Bun.write(
    join(archive, 'INDEX.md'),
    `# archive — index\n\n## Closed\n\n- **passoff/${FIXTURE_ARCHIVED_ITEM.name}** ✅ - item 7, closed 2026-10-15.\n`,
  );
  await Bun.write(join(archiveItems, FIXTURE_ARCHIVED_ITEM.name), FIXTURE_ARCHIVED_ITEM.text);
  if (git) await mkdir(join(dir, '.git'));

  return { dir, itemsDir, archive, archiveItems, done: () => cleanup(parent) };
}
