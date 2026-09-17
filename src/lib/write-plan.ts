import { backupFiles, type Manifest } from './backup.ts';
import { diffSummary } from './diff.ts';
import { exists, readText, writeText } from './disk.ts';
import { isOurs } from './stamp.ts';
import type { PlannedFile } from './types.ts';

export type PlannedChange = {
  file: PlannedFile;
  /** What is on disk now; empty string when the file does not exist. */
  before: string;
  /** What will be on disk after. For merge/append strategies this is the merged result. */
  after: string;
  summary: string;
  /** Why nothing is written, where the stamp guard refused it; `none` everywhere else. */
  guard: 'none' | 'no-stamp';
};

export async function resolvePlan(files: PlannedFile[]): Promise<PlannedChange[]> {
  return Promise.all(files.map(resolveOne));
}

async function resolveOne(file: PlannedFile): Promise<PlannedChange> {
  const before = (await exists(file.path)) ? await readText(file.path) : '';
  const guard = stampGuard(file, before);
  const after = guard === 'none' ? applyStrategy(file, before) : before;
  return { file, before, after, guard, summary: diffSummary(before, after) };
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
 * overwrite is backed up and `personal-config undo` restores it. Deleting the stamp line is how
 * a generated file is taken back for good — which is what Part 0 adaptation does to the
 * documents it rewrites.
 */
function stampGuard(file: PlannedFile, before: string): PlannedChange['guard'] {
  if (before.length === 0) return 'none';
  if (!isOurs(file.contents)) return 'none';
  return isOurs(before) ? 'none' : 'no-stamp';
}

function applyStrategy(file: PlannedFile, before: string): string {
  if (file.strategy === 'overwrite') return file.contents;
  if (file.strategy === 'append-lines') return appendMissingLines(before, file.contents);
  return mergeJson(before, file.contents);
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

export type WriteResult = { written: string[]; skipped: string[]; manifest: Manifest | null };

/** Nothing here runs until the batch has been confirmed; `--dry-run` never reaches it. */
export async function commitPlan(changes: PlannedChange[]): Promise<WriteResult> {
  const real = changes.filter((c) => c.before !== c.after);
  const overwritten = real.filter((c) => c.before.length > 0).map((c) => c.file.path);
  const manifest = overwritten.length > 0 ? await backupFiles(overwritten) : null;

  for (const change of real) {
    await writeText(change.file.path, change.after);
  }

  return {
    written: real.map((c) => c.file.path),
    skipped: changes.filter((c) => c.before === c.after).map((c) => c.file.path),
    manifest,
  };
}
