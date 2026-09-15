import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { backupFiles, type Manifest } from './backup.ts';
import { diffSummary } from './diff.ts';
import type { PlannedFile } from './types.ts';

export type PlannedChange = {
  file: PlannedFile;
  /** What is on disk now; empty string when the file does not exist. */
  before: string;
  /** What will be on disk after. For merge/append strategies this is the merged result. */
  after: string;
  summary: string;
};

export async function resolvePlan(files: PlannedFile[]): Promise<PlannedChange[]> {
  return Promise.all(files.map(resolveOne));
}

async function resolveOne(file: PlannedFile): Promise<PlannedChange> {
  const handle = Bun.file(file.path);
  const before = (await handle.exists()) ? await handle.text() : '';
  const after = applyStrategy(file, before);
  return { file, before, after, summary: diffSummary(before, after) };
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
    await mkdir(dirname(change.file.path), { recursive: true });
    await Bun.write(change.file.path, change.after);
  }

  return {
    written: real.map((c) => c.file.path),
    skipped: changes.filter((c) => c.before === c.after).map((c) => c.file.path),
    manifest,
  };
}
