import { readdirSync, readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readText } from './disk.ts';
import { insideGit } from './git.ts';
import { numberedSection } from './markdown.ts';
import { expandHome } from './paths.ts';
import { readArchiveHome, readLedgerFrozenAt } from './repo-config.ts';

/**
 * The one place that finds a board item's text (per-item-board `DESIGN.md` D11). A 2.0.0 board
 * keeps each item in its own file, `<itemsDir>/<n>-<slug>.md`; a 1.x board keeps it as a
 * numbered section under the table (D12). Every reader goes through `itemText`, so `passoff
 * next`, `board-status` and `unfolded` cannot disagree about which text is item 15's.
 *
 * Everything here except the two loaders is pure over a listing it is handed, so it is tested
 * by calling it.
 */

/** One markdown file directly inside an items folder. */
export type ItemEntry = { name: string; text: string };

/** Where an item's text came from: its own file wins over a board section (D12). */
export type ItemText =
  | { from: 'file'; name: string; text: string }
  | { from: 'section'; text: string };

/**
 * DIAL-5. A constant and not config: a slug is derived once, when the file is created, and
 * never regenerated, so changing the length later renames nothing and a repo has nothing to tune.
 */
export const SLUG_MAX = 48;

/**
 * A title with no letters or digits at all (`???`) still gets a file whose name keeps the
 * `<n>-<slug>.md` shape, because every reader keys on that shape's leading `<n>-`.
 */
const EMPTY_SLUG = 'item';

/** D7: lowercased, every run outside `a-z0-9` one hyphen, trimmed, cut at a hyphen. */
export function slugOf(title: string): string {
  const full = title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
  if (full === '') return EMPTY_SLUG;
  return cutAtHyphen(full, SLUG_MAX);
}

/** A single word longer than the limit has no hyphen to cut at, so it is cut where it stands. */
function cutAtHyphen(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  if (slug[max] === '-') return slug.slice(0, max);
  const lastHyphen = slug.lastIndexOf('-', max);
  return lastHyphen > 0 ? slug.slice(0, lastHyphen) : slug.slice(0, max);
}

/** `<n>` is the `#` cell verbatim, `1.5` included (D7). */
export function itemFileName(number: string, title: string): string {
  return `${number.trim()}-${slugOf(title)}.md`;
}

/**
 * Keyed on the leading `<n>-` and nothing looser: a bare prefix match would make item `1` find
 * `15-…` and `1.5-…`, which is the hazard the plan names for this phase.
 */
export function isItemFor(name: string, number: string): boolean {
  return name.startsWith(`${number.trim()}-`) && name.endsWith('.md');
}

/**
 * The first file for this number, in name order. Two files for one number is a finding for
 * `item-files`, not a choice for a reader to make silently, so the reader stays deterministic.
 */
export function findItem(listing: ItemEntry[], number: string): ItemEntry | null {
  const sorted = [...listing].sort((a, b) => a.name.localeCompare(b.name));
  return sorted.find((entry) => isItemFor(entry.name, number)) ?? null;
}

/**
 * The item's own file when it has one, otherwise its section on the board (D12). A section is
 * returned with its heading, so both shapes start with the `# <n>.` line a reader prints.
 */
export function itemText(listing: ItemEntry[], board: string, number: string): ItemText | null {
  const file = findItem(listing, number);
  if (file) return { from: 'file', name: file.name, text: file.text };
  const section = numberedSection(board, number);
  if (!section) return null;
  return { from: 'section', text: `${section.heading}\n${section.body}` };
}

/**
 * The text below the item's `# <n>.` line, from either shape. A rule that looks for a word in the
 * item must not find it in the title: a row titled "Replace the parser" satisfied `SUPERSEDED`
 * by existing, and the heading repeats that title.
 */
export function itemBody(item: ItemText): string {
  const lines = item.text.split('\n');
  return /^#{1,4}\s/.test(lines[0] ?? '') ? lines.slice(1).join('\n') : item.text;
}

/** D7's name: `<n>-<slug>.md`, where `<n>` may carry one decimal part, as `1.5` does. */
const ITEM_NAME = /^(\d+(?:\.\d+)?)-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

export function isItemName(name: string): boolean {
  return ITEM_NAME.test(name);
}

/** The `<n>` a name starts with, or null where it starts with no number and a hyphen. */
export function itemNumberOf(name: string): string | null {
  return name.match(/^(\d+(?:\.\d+)?)-/)?.[1] ?? null;
}

/** The number in a file's `# <n>.` first line, or null where the first line is not that. */
export function headingNumberOf(text: string): string | null {
  return text.match(/^#\s+(\d+(?:\.\d+)?)[.):]/)?.[1] ?? null;
}

/**
 * D16: a number is never reused, and a closed row leaves the table at the fold, so the board
 * alone no longer knows every number taken. The highest of the rows, the live files and the
 * archived files, plus one. A decimal item (`1.5`) counts as its whole part.
 */
export function nextFreeItem(rows: string[], live: ItemEntry[], archived: ItemEntry[]): number {
  const taken = [
    ...rows,
    ...[...live, ...archived].map((entry) => itemNumberOf(entry.name) ?? ''),
  ].map((number) => Math.floor(Number.parseFloat(number)));
  return Math.max(0, ...taken.filter(Number.isFinite)) + 1;
}

/**
 * Whether the repo has moved to item files (D12). Read from the folder on disk, not from the
 * config: `itemsDir` always has a default, and a 1.x repo has no folder (G53). Also the check
 * for an archive home, since `exists` in `disk.ts` answers for regular files only.
 */
export function hasItemsFolder(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** Sync because every doctor rule's `check` is. An absent folder is a 1.x repo, not an error. */
export function listItemsSync(dir: string): ItemEntry[] {
  let names: string[];
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  return names.sort().map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
}

/** The commands' loader: the same listing as `listItemsSync`, read asynchronously. */
export async function listItems(dir: string): Promise<ItemEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    names.map(async (name) => ({ name, text: await readText(join(dir, name)) })),
  );
}

/**
 * What a board's rules need beyond the board itself, read once per root because `check` is
 * handed one doc. `archived` is null where the archive cannot be read (no `archiveHome`, or a
 * home this machine does not have), and null means "cannot verify", never "the record is
 * missing" (D2). `git` is whether a `.git` sits at or above the root, which decides whether a
 * `DONE` row may fold (`isFoldable`).
 */
export type ItemContext = {
  archived: ItemEntry[] | null;
  ledgerFrozenAt: number | null;
  git: boolean;
};

/**
 * A 1.x repo as every rule read it before item files: no archive to consult, no frozen log. It
 * claims git because that is the safe guess: a `DONE` item stays live until it is `COMMITTED`.
 */
export const UNMIGRATED: ItemContext = { archived: null, ledgerFrozenAt: null, git: true };

export async function loadItemContext(root: string, itemsName: string): Promise<ItemContext> {
  const ledgerFrozenAt = await readLedgerFrozenAt(root);
  const git = await insideGit(root);
  const home = await readArchiveHome(root);
  if (home === null || !hasItemsFolder(expandHome(home)))
    return { archived: null, ledgerFrozenAt, git };
  return { archived: await listItems(join(expandHome(home), itemsName)), ledgerFrozenAt, git };
}
