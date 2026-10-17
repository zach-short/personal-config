import { rm } from 'node:fs/promises';
import { backupFiles, type Manifest } from './backup.ts';
import { diffSummary } from './diff.ts';
import { exists, modeOf, readText, setMode, writeText } from './disk.ts';
import { isOurs, markAdapted, readStamp, sameButForStampDate } from './stamp.ts';
import type { PlannedFile, Prune } from './types.ts';

export type PlannedChange = {
  file: PlannedFile;
  /** What is on disk now; empty string when the file does not exist. */
  before: string;
  /** What will be on disk after. For merge/append strategies this is the merged result. */
  after: string;
  summary: string;
  /**
   * Why nothing is written, where a guard refused it; `none` everywhere else. Named apart
   * because the way out of each differs: a file with no stamp is generated fresh only if
   * deleted, and a file marked `adapted` is the repo's own until its owner removes the word.
   * `kept` is a seed that is now a record (`replace: 'never'`), and `edited` is a file that no
   * longer matches what this tool renders at its stamp (`replace: 'if-unedited'`).
   */
  guard: 'none' | 'no-stamp' | 'adapted' | 'kept' | 'edited';
  /**
   * Permission bits to set once the bytes are down, absent where the file already carries them.
   * Present is the whole signal: a change with identical contents and a `chmod` is still work,
   * which is how a re-run repairs a hook installed before this existed.
   */
  chmod?: number;
  /**
   * Present and true is the whole signal, as for `chmod`: `commitPlan` deletes this file instead
   * of writing it (per-item-board `DESIGN.md` D14). Only `resolveRemoval` sets it, and only for a
   * file that is there to delete. `after` is `''`, so the preview's diff is every line removed.
   */
  remove?: true;
};

/**
 * A planned removal (D14). It goes through the plan for the reason every write does: the preview
 * names it, `commitPlan` backs it up before anything is deleted, and `undo` copies it back. A
 * fold's item file is often in an untracked folder, so that backup is the only copy git does not
 * hold.
 *
 * No stamp guard: the guard asks whether this tool may *replace* a file's contents, and a removal
 * replaces nothing. The caller has already proved the bytes are elsewhere (the fold's read-back).
 * A path with no file behind it plans nothing, so a re-run after a removal is a no-op.
 */
export async function resolveRemoval(path: string, label: string): Promise<PlannedChange> {
  const file: PlannedFile = { path, contents: '', label, strategy: 'overwrite' };
  if (!(await exists(path))) {
    return { file, before: '', after: '', guard: 'none', summary: 'already absent' };
  }
  const before = await readText(path);
  const lines = before === '' ? 0 : before.replace(/\n$/, '').split('\n').length;
  return {
    file,
    before,
    after: '',
    guard: 'none',
    summary: `removed, ${lines} lines`,
    remove: true,
  };
}

/**
 * A global file a `setup` run no longer renders, planned for removal only where this tool wrote
 * it (setup-global-leftovers BD-4). The test is the stamp guard's: a stamp not marked `adapted`.
 * A file with no stamp is the person's, and one marked `adapted` was taken back on purpose, so
 * either returns null and is not named in the preview at all, as an absent file is.
 */
export async function resolveLeftover(
  path: string,
  label: string,
): Promise<PlannedChange | null> {
  if (!(await exists(path))) return null;
  const stamp = readStamp(await readText(path));
  if (stamp === null || stamp.adapted) return null;
  return resolveRemoval(path, label);
}

/**
 * What this tool renders at a path as of the stamp already on disk there, from the answers the
 * repo held before this run, or null where no render lands at that path. It is `doctor`'s
 * re-render (`src/doctor/rerender.ts`), so the record guard and the drift rule agree by sharing
 * one answer. A caller with nothing to compare against passes none, and every `if-unedited` file
 * that differs from its new render is then refused: the safe reading of "cannot tell".
 */
export type PriorRender = (path: string, before: string) => string | null;

export async function resolvePlan(
  files: PlannedFile[],
  prior: PriorRender = () => null,
): Promise<PlannedChange[]> {
  return Promise.all(files.map((file) => resolveOne(file, prior)));
}

async function resolveOne(file: PlannedFile, prior: PriorRender): Promise<PlannedChange> {
  const before = (await exists(file.path)) ? await readText(file.path) : '';
  const stamped = stampGuard(file, before);
  const guard = stamped === 'none' ? recordGuard(file, before, prior) : stamped;
  const rendered = guard === 'none' ? applyStrategy(file, before) : before;
  // What is on disk wins a date-only difference, rather than the render winning it. The bytes
  // are the same either way; the stamp date is the one field they disagree about, and the
  // truthful value is when the file last actually changed, not when a run last looked at it.
  const after = sameButForStampDate(before, rendered) ? before : rendered;
  const chmod = guard === 'none' ? await pendingMode(file) : undefined;
  return { file, before, after, guard, chmod, summary: diffSummary(before, after) };
}

/**
 * The mode to set, or undefined where there is nothing to set. Read off the disk rather than
 * assumed from whether the file is new, because the case that matters most is the one where
 * nothing else changes: a hook installed by an older version has the right bytes and the wrong
 * bits, so a plan that only compared contents would call it current and leave it unrunnable.
 *
 * Exact equality, not "executable enough": the mode of a generated file is this tool's to own,
 * the same way its bytes are. Someone who tightens a hook to 0700 gets it set back to 0755 on
 * the next run — visibly, in the preview — and the ways to take a generated file back for good
 * are still the documented ones: marking its stamp `adapted`, or deleting the line.
 *
 * Nothing calls this for a stamp-guarded file. A file we have refused to write is a file we
 * have refused to touch, and changing its bits would be exactly the write the guard declined.
 */
async function pendingMode(file: PlannedFile): Promise<number | undefined> {
  if (file.mode === undefined) return undefined;
  return (await modeOf(file.path)) === file.mode ? undefined : file.mode;
}

/**
 * Whether this change does anything — the one definition of "a file to write", so the preview,
 * the confirm count and the commit cannot disagree about it. A mode is on the near side of that
 * line: setting it is a write to the filesystem, and it goes through the same confirm.
 */
export function willWrite(change: PlannedChange): boolean {
  return change.before !== change.after || change.chmod !== undefined || change.remove === true;
}

/**
 * The stamp guard. Not the *ownership* guard, which is about somebody else's `origin` remote and
 * is settled before a file is ever planned: this one is per file. A stamp is the only record
 * that this tool wrote something, so a file already on disk without one is not ours to replace
 * and the write is refused rather than backed up and done anyway.
 *
 * It asks whether *we* claim the path, not which strategy we would use, because the two answers
 * differ. A merge into `settings.json`, a line appended to an ignore file and an in-place
 * `edit()` of a board all land in files a person owns — and all three read what is there and
 * keep it, so none claims authorship and none is guarded. Keying on the strategy would have
 * refused all three, and `passoff claim` would never mark a board again. The edit is told apart
 * by `inPlace`, not by its contents: those are the file itself, stamp included, so the content
 * test alone called an adapted board ours and refused the claim's one changed cell (2026-10-16).
 *
 * A *stamped* file is written even where a person has edited it. Nothing in the stamp records
 * the bytes we wrote, so an edit to a generated file leaves no trace this can read; that
 * overwrite is backed up and `personal-config undo` restores it. A stamp marked `adapted` is how
 * a generated file is taken back for good while keeping its provenance readable — which is what
 * Part 0 adaptation does to the documents it rewrites (stamp-provenance `DESIGN.md` D1) — and
 * deleting the line still takes it back too, at the cost of `doctor` never seeing it again.
 *
 * `mark-adapted` is admitted before the content test because its contents *is* a stamp line and
 * the file it lands on has none: the one write allowed to add a stamp to a file this tool never
 * produced. It keeps every byte and adds the provenance the owner asked `doctor --fix` for, so it
 * claims nothing — the same reason the merge and the append are not guarded (D3).
 *
 * This one keys on *content* on purpose, unlike `onDiskNow` below, which had to stop. An empty
 * file carries no stamp and no bytes to lose, and refusing it would make `touch` a way to block
 * a generated file for good — a second, undocumented spelling of the one deliberate way out.
 */
function stampGuard(file: PlannedFile, before: string): PlannedChange['guard'] {
  if (before.length === 0) return 'none';
  if (file.strategy === 'mark-adapted' || file.inPlace === true) return 'none';
  if (!isOurs(file.contents)) return 'none';
  const stamp = readStamp(before);
  if (stamp === null) return 'no-stamp';
  return stamp.adapted ? 'adapted' : 'none';
}

/**
 * The record guard, asked only of a file the stamp guard admitted (record-overwrite,
 * 2026-10-16). The stamp guard asks whether this tool wrote a file; this asks whether the file
 * is still what it wrote. A stamp is written once and survives every later edit, because
 * `handoff`, `passoff` and `archive` change their files through `edit()`, which adds none. So a
 * ledger with 2,598 lines of steps still carried its first stamp, and `init` replaced it with a
 * 67-line template on 2026-10-16, in five repos at once. The backup and `undo` were there; the
 * preview showing `−2598` was there; neither stopped a `--yes` run across 27 folders.
 *
 * `never` keeps any file with bytes in it, so a seed is written once. `if-unedited` replaces only
 * a file that matches `prior`, the render at its own stamp, or that still holds the mark only an
 * unadapted copy has. Exported for `doctor`, whose drift finding must say what a re-run will do.
 */
export function recordGuard(
  file: PlannedFile,
  before: string,
  prior: PriorRender,
): PlannedChange['guard'] {
  if (before.length === 0 || file.replace === undefined) return 'none';
  // Current but for its date: a refusal here would name a write that changes nothing.
  if (sameButForStampDate(before, file.contents)) return 'none';
  if (file.replace === 'never') return 'kept';
  return unedited(file, before, prior) ? 'none' : 'edited';
}

/**
 * The comparison with `prior` is exact: it renders at the file's own stamp date, so the stamp
 * line and every dated line in the body agree.
 */
function unedited(file: PlannedFile, before: string, prior: PriorRender): boolean {
  if (file.unadaptedMark !== undefined && holdsLine(before, file.unadaptedMark)) return true;
  return prior(file.path, before) === before;
}

/**
 * A whole line, not a substring. The standard's Appendix A names `{{WORKTREE_SETUP}}` inline in
 * its table and keeps it there after Part 0 (its "Placeholders" paragraph says an adapted copy
 * has `{{` hits only in that table), so a substring test would call every adapted standard
 * unadapted and replace it: the bug this work exists to close.
 */
function holdsLine(text: string, line: string): boolean {
  return text.split('\n').some((candidate) => candidate.trim() === line);
}

function applyStrategy(file: PlannedFile, before: string): string {
  if (file.strategy === 'overwrite') return file.contents;
  if (file.strategy === 'append-lines') return appendMissingLines(before, file.contents);
  if (file.strategy === 'mark-adapted') return markAdapted(before, adaptedLine(file));
  const merged = mergeJson(before, file.contents);
  return file.prune === undefined || file.prune.length === 0
    ? merged
    : pruneJson(merged, file.prune);
}

/**
 * The bound on what `mark-adapted` can put into a file: its contents must be one adapted stamp
 * line, or the strategy would be a way to prepend anything to a file the guard has just waved
 * through. A caller that gets here with anything else is a bug, and the throw names the path.
 */
function adaptedLine(file: PlannedFile): string {
  if (readStamp(file.contents)?.adapted !== true) {
    throw new Error(`mark-adapted needs an adapted stamp line as its contents: ${file.path}`);
  }
  return file.contents;
}

/** Ignore files: add only the lines that are not already there, and never reorder. */
function appendMissingLines(before: string, additions: string): string {
  const existing = new Set(before.split('\n').map((l) => l.trim()));
  const missing = additions.split('\n').filter((l) => l.trim() && !existing.has(l.trim()));
  if (missing.length === 0) return before;
  const base = before.length === 0 || before.endsWith('\n') ? before : `${before}\n`;
  return `${base}${missing.join('\n')}\n`;
}

/**
 * `settings.json`: a recursive merge where arrays concatenate without duplicating. Hooks are
 * arrays, and a blind overwrite here would delete whatever the user already runs on session
 * start — which is exactly the failure the confirm-and-backup rule exists to prevent.
 */
function mergeJson(before: string, additions: string): string {
  const base = before.trim() ? (JSON.parse(before) as unknown) : {};
  const merged = mergeValues(base, JSON.parse(additions) as unknown);
  return `${JSON.stringify(merged, null, 2)}\n`;
}

function mergeValues(base: unknown, next: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(next)) return mergeArrays(base, next);
  if (isRecord(base) && isRecord(next)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(next)) {
      out[key] = key in base ? mergeValues(base[key], value) : value;
    }
    return out;
  }
  return next;
}

function mergeArrays(base: unknown[], next: unknown[]): unknown[] {
  const seen = new Set(base.map((item) => JSON.stringify(item)));
  return [...base, ...next.filter((item) => !seen.has(JSON.stringify(item)))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The second step of a pruning `merge-json` write (setup-hook-leftovers BD-4, BD-5). It runs on
 * the merged text, so `mergeJson` stays the add-only merge the ceiling's `settings.local.json`
 * also uses. Each item goes from the array at its path wherever `sameJson` matches it, and a
 * container this prune emptied goes with it. An array that was empty before stays: no item can
 * match in it, so nothing here touches it.
 */
function pruneJson(merged: string, prune: Prune[]): string {
  const root: unknown = JSON.parse(merged);
  for (const { at, item } of prune) pruneOne(root, at, item);
  return `${JSON.stringify(root, null, 2)}\n`;
}

function pruneOne(root: unknown, at: string[], item: unknown): void {
  const chain = containersAlong(root, at);
  const parent = chain.at(-1);
  const key = at.at(-1);
  if (parent === undefined || key === undefined) return;
  const list = parent[key];
  if (!Array.isArray(list)) return;
  const kept = list.filter((entry) => !sameJson(entry, item));
  if (kept.length === list.length) return;
  parent[key] = kept;
  dropEmptied(chain, at);
}

/** The records along `at`, from the root to the one holding the last key; short where one is missing. */
function containersAlong(root: unknown, at: string[]): Record<string, unknown>[] {
  const chain: Record<string, unknown>[] = [];
  let node = root;
  for (const key of at) {
    if (!isRecord(node)) return [];
    chain.push(node);
    node = node[key];
  }
  return chain;
}

/** Deletes each emptied value, from the array up, stopping at the first that is not empty. */
function dropEmptied(chain: Record<string, unknown>[], at: string[]): void {
  for (let depth = chain.length - 1; depth >= 0; depth--) {
    const holder = chain[depth];
    const key = at[depth];
    if (holder === undefined || key === undefined) return;
    const value = holder[key];
    const empty = Array.isArray(value)
      ? value.length === 0
      : isRecord(value) && Object.keys(value).length === 0;
    if (!empty) return;
    delete holder[key];
  }
}

/**
 * Deep equality for parsed JSON, with the order of an object's keys ignored and the order of an
 * array kept (setup-hook-leftovers D2). An entry a person or another tool rewrote with its keys in
 * another order is the same entry, where `JSON.stringify` equality would miss it.
 */
export function sameJson(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** `written` includes every removed path; `removed` names those alone. */
export type WriteResult = {
  written: string[];
  skipped: string[];
  removed: string[];
  manifest: Manifest | null;
};

/** Nothing here runs until the batch has been confirmed; `--dry-run` never reaches it. */
export async function commitPlan(changes: PlannedChange[]): Promise<WriteResult> {
  const real = changes.filter(willWrite);
  const moved = await movedSince(real);
  if (moved.length > 0) throw new Error(movedNote(moved));
  // A mode-only change is deliberately not backed up: the bytes are identical, so a copy of them
  // restores nothing, and `restore` copies over a file that already exists — which leaves that
  // file's bits alone anyway. There is nothing here for `undo` to put back.
  const overwritten = await onDiskNow(
    real.filter((c) => c.before !== c.after || c.remove === true),
  );
  // Every backup is taken here, before the loop below writes or deletes anything (D14).
  const manifest = overwritten.length > 0 ? await backupFiles(overwritten) : null;

  for (const change of real) await apply(change, manifest);

  return {
    written: real.map((c) => c.file.path),
    skipped: changes.filter((c) => !willWrite(c)).map((c) => c.file.path),
    removed: real.filter((c) => c.remove === true).map((c) => c.file.path),
    manifest,
  };
}

async function apply(change: PlannedChange, manifest: Manifest | null): Promise<void> {
  if (change.remove === true) return removeBackedUp(change.file.path, manifest);
  if (change.before !== change.after) {
    await writeText(change.file.path, change.after, change.chmod);
  } else if (change.chmod !== undefined) {
    await setMode(change.file.path, change.chmod);
  }
}

/**
 * A delete happens only with its own backup in hand. `onDiskNow` and `backupFiles` each ask the
 * disk again, so a file that appeared or vanished in between can leave a path out of the
 * manifest; an overwrite then loses at worst what `undo` could not restore anyway, but a delete
 * would lose the only copy. So the manifest is checked here and a missing entry throws, before
 * anything is deleted.
 *
 * `rm` with `force`, from `node:fs/promises` directly: a file already gone is the removal done,
 * and `disk.ts` has no delete because nothing before D14 deleted a file.
 */
async function removeBackedUp(path: string, manifest: Manifest | null): Promise<void> {
  const held = manifest?.entries.some((entry) => entry.original === path) === true;
  if (!held && (await exists(path))) {
    throw new Error(`refusing to remove ${path}: it is not in this run's backup`);
  }
  await rm(path, { force: true });
}

/**
 * The paths whose bytes are no longer the ones the plan was resolved from. Each `after` is the
 * file as it was read with this run's edit applied, so writing it over a file another session
 * changed in between replaces that session's edit, and the run still reports success. Item 105's
 * audit found it on a ledger an autopilot run was appending to while the migration's confirm sat
 * open. Every file is read again here, before any backup or write, and one that moved, appeared
 * or vanished stops the whole batch, so nothing in it is half written.
 */
async function movedSince(real: PlannedChange[]): Promise<string[]> {
  const checked = await Promise.all(
    real.map(async (c) => {
      const now = (await exists(c.file.path)) ? await readText(c.file.path) : '';
      return now === c.before ? null : c.file.path;
    }),
  );
  return checked.filter((path): path is string => path !== null);
}

function movedNote(paths: string[]): string {
  return [
    `${paths.length} file(s) changed on disk after this run read them: ${paths.join(', ')}.`,
    'Nothing in this batch was written. Run it again, so it plans from what is there now.',
  ].join('\n');
}

/**
 * Which of these paths has a file behind it to lose — asked of the disk, here, in the moment
 * before the writes. Two of row 39's four findings were the one line this replaced
 * (`overwritten = real.filter((c) => c.before.length > 0)`, 2026-09-17).
 *
 * *Existence and content are separate facts.* That gate read a fact about content and answered
 * with it a question about existence, and the two part company for a file that is there and
 * empty: `resolveOne` gives an absent path and a zero-byte one the same `''`, so a pre-existing
 * empty file was overwritten with no backup and no manifest entry, and `undo` afterwards
 * described it as a file this tool had created new.
 *
 * *And the answer goes stale.* The set used to be fixed in `resolveOne`, before the preview was
 * printed and the confirm opened. A file created while that prompt sat open — another session in
 * the same checkout, which is this repo's own working norm, or an editor writing a file out — was
 * overwritten minutes later against a set decided without it. Asking again costs one `stat` per
 * planned file and closes the window to the width of the write loop.
 */
async function onDiskNow(real: PlannedChange[]): Promise<string[]> {
  const checked = await Promise.all(
    real.map(async (c) => ((await exists(c.file.path)) ? c.file.path : null)),
  );
  return checked.filter((path): path is string => path !== null);
}
