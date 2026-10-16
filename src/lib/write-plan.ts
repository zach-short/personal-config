import { rm } from 'node:fs/promises';
import { backupFiles, type Manifest } from './backup.ts';
import { diffSummary } from './diff.ts';
import { exists, modeOf, readText, setMode, writeText } from './disk.ts';
import { isOurs, markAdapted, readStamp, sameButForStampDate } from './stamp.ts';
import type { PlannedFile } from './types.ts';

export type PlannedChange = {
  file: PlannedFile;
  /** What is on disk now; empty string when the file does not exist. */
  before: string;
  /** What will be on disk after. For merge/append strategies this is the merged result. */
  after: string;
  summary: string;
  /**
   * Why nothing is written, where the stamp guard refused it; `none` everywhere else. Two
   * refusals, named apart because the way out of each differs: a file with no stamp is generated
   * fresh only if deleted, and a file marked `adapted` is the repo's own until its owner removes
   * the word.
   */
  guard: 'none' | 'no-stamp' | 'adapted';
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

export async function resolvePlan(files: PlannedFile[]): Promise<PlannedChange[]> {
  return Promise.all(files.map(resolveOne));
}

async function resolveOne(file: PlannedFile): Promise<PlannedChange> {
  const before = (await exists(file.path)) ? await readText(file.path) : '';
  const guard = stampGuard(file, before);
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
 * refused all three, and `passoff claim` would never mark a board again.
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
  if (file.strategy === 'mark-adapted') return 'none';
  if (!isOurs(file.contents)) return 'none';
  const stamp = readStamp(before);
  if (stamp === null) return 'no-stamp';
  return stamp.adapted ? 'adapted' : 'none';
}

function applyStrategy(file: PlannedFile, before: string): string {
  if (file.strategy === 'overwrite') return file.contents;
  if (file.strategy === 'append-lines') return appendMissingLines(before, file.contents);
  if (file.strategy === 'mark-adapted') return markAdapted(before, adaptedLine(file));
  return mergeJson(before, file.contents);
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
