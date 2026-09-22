import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { copyTo, exists, readJson, readText, writeText } from './disk.ts';
import { backupsDir } from './paths.ts';

export type BackupEntry = { original: string; stored: string };
export type Manifest = { timestamp: string; entries: BackupEntry[] };

/** A backup on disk: where it lives, what it holds, and whether `undo` has already spent it. */
export type Backup = { dir: string; manifest: Manifest; restoredAt: string | null };

/** Written by `restore`, read by `undo`: one ISO line saying when this backup was spent. */
const RESTORED = 'restored-at';

/** `2026-09-15T14-32-07` — sortable, and legal on every filesystem we target. */
export function timestampDir(now = new Date()): string {
  return now.toISOString().replace(/\..+$/, '').replaceAll(':', '-');
}

/**
 * Claims a directory nobody else holds, by creating it rather than by first asking whether the
 * name is free: `mkdir` without `recursive` fails with `EEXIST`, and that failure is atomic
 * where a check-then-write is not.
 *
 * Precision is not the fix. `timestampDir` resolves to the second and two `commitPlan` calls
 * land inside one on their own — `doctor --fix` looping several roots does it every time — but a
 * microsecond stamp collides too under enough concurrency. What a collision cost was a whole
 * backup: the second run wrote its `manifest.json` over the first's, and the first's files sat
 * on disk with nothing naming them and no way for `undo` to reach them (row 39 finding 1,
 * reproduced 2026-09-17).
 *
 * The counter is fixed-width so the names still sort chronologically, which is the whole of how
 * `latestBackup` finds the newest. The loop terminates because every collision is a directory
 * that is already there, and there are finitely many of those.
 */
async function claimDir(stamp: string): Promise<string> {
  await mkdir(backupsDir(), { recursive: true });
  for (let n = 0; ; n += 1) {
    const dir = join(backupsDir(), `${stamp}-${String(n).padStart(3, '0')}`);
    try {
      await mkdir(dir);
      return dir;
    } catch (error) {
      if (!alreadyClaimed(error)) throw error;
    }
  }
}

function alreadyClaimed(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

/**
 * Copies every file that is about to be overwritten into one claimed directory, with a manifest
 * naming where each came from. `undo` reads only the manifest, so a backup with no manifest is
 * inert rather than half-restorable — which is why the manifest is written last.
 */
export async function backupFiles(paths: string[], stamp = timestampDir()): Promise<Manifest> {
  const dir = await claimDir(stamp);
  const entries: BackupEntry[] = [];

  for (const [index, original] of paths.entries()) {
    if (!(await exists(original))) continue;
    const stored = join(dir, 'files', `${index}-${original.replaceAll('/', '_')}`);
    await copyTo(original, stored);
    entries.push({ original, stored });
  }

  const manifest: Manifest = { timestamp: stamp, entries };
  await writeText(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/**
 * The newest backup, or `null` where there is nothing to restore. A directory without a
 * `manifest.json` is not one: `backupFiles` writes the manifest after the copies, so a run
 * interrupted mid-copy leaves a directory `undo` must not treat as restorable.
 *
 * A `manifest.json` that is not a manifest is a third case, and it is refused rather than
 * reported empty — see `asManifest`.
 */
export async function latestBackup(): Promise<Backup | null> {
  const dirs = await readdir(backupsDir()).catch(() => []);
  const newest = dirs.sort().at(-1);
  if (!newest) return null;

  const dir = join(backupsDir(), newest);
  const path = join(dir, 'manifest.json');
  if (!(await exists(path))) return null;
  return {
    dir,
    manifest: asManifest(await readJson(path), path),
    restoredAt: await restoredAt(dir),
  };
}

/**
 * The parsed manifest, narrowed before `undo` acts on it (`docs/conventions-ts.md` T1). This
 * was `as Manifest` until 2026-09-22, and the cast was the load-bearing kind: `runUndo` prints
 * `manifest.timestamp`, counts `manifest.entries` and then hands each entry to `copyTo`, so a
 * file of the wrong shape reached a write. An `entries` of the wrong element type is the worst
 * of them — `copyTo(undefined, undefined)` throws from inside `node:fs` with no mention of the
 * manifest, leaving a person with a failing `undo` and nothing naming the file to delete.
 *
 * Refusing by path is therefore the whole point, and refusing is safe to add: `timestamp` and
 * `entries` have both been required since `Manifest` was introduced in `8947613`, so no
 * manifest this tool has ever written fails here.
 */
function asManifest(parsed: unknown, path: string): Manifest {
  if (!isRecord(parsed)) throw new Error(`${path} is not a backup manifest`);
  if (typeof parsed.timestamp !== 'string') {
    throw new Error(`${path}: "timestamp" is not a string`);
  }
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`${path}: "entries" is not a list`);
  }
  return { timestamp: parsed.timestamp, entries: parsed.entries.map((e) => asEntry(e, path)) };
}

function asEntry(value: unknown, path: string): BackupEntry {
  if (!isRecord(value)) throw new Error(entryProblem(path));
  const { original, stored } = value;
  if (typeof original !== 'string' || typeof stored !== 'string') {
    throw new Error(entryProblem(path));
  }
  return { original, stored };
}

/** One message for every malformed entry: the file to fix is the same either way. */
function entryProblem(path: string): string {
  return `${path}: "entries" holds something that is not a backed-up file`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** When `undo` spent this backup, or `null` while it is still unspent. */
async function restoredAt(dir: string): Promise<string | null> {
  const path = join(dir, RESTORED);
  if (!(await exists(path))) return null;
  const stamp = (await readText(path)).trim();
  return stamp === '' ? 'an earlier run' : stamp;
}

/**
 * One way, and once. Every entry is copied back over whatever is at that path now, and nothing
 * snapshots what was there first — that is the shape of `undo` this tool chose, and
 * `src/commands/undo.ts` is where the choice is written down.
 *
 * The backup is marked spent on the way out, here rather than in the caller, because a restore
 * that leaves no mark is exactly the bug: it is the mark that lets a second `undo` be refused
 * instead of silently reapplying the same files over a person's newer edits.
 */
export async function restore(backup: Backup, now = new Date()): Promise<string[]> {
  const restored: string[] = [];
  for (const entry of backup.manifest.entries) {
    if (!(await exists(entry.stored))) continue;
    await copyTo(entry.stored, entry.original);
    restored.push(entry.original);
  }
  await writeText(join(backup.dir, RESTORED), `${now.toISOString()}\n`);
  return restored;
}
