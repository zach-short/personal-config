import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { backupsDir } from './paths.ts';

export type BackupEntry = { original: string; stored: string };
export type Manifest = { timestamp: string; entries: BackupEntry[] };

/** `2026-09-15T14-32-07` — sortable, and legal on every filesystem we target. */
export function timestampDir(now = new Date()): string {
  return now.toISOString().replace(/\..+$/, '').replaceAll(':', '-');
}

/**
 * Copies every file that is about to be overwritten into one timestamped directory, with a
 * manifest naming where each came from. `undo` reads only the manifest, so a backup with no
 * manifest is inert rather than half-restorable.
 */
export async function backupFiles(paths: string[], stamp = timestampDir()): Promise<Manifest> {
  const dir = join(backupsDir(), stamp);
  const entries: BackupEntry[] = [];

  for (const [index, original] of paths.entries()) {
    if (!(await Bun.file(original).exists())) continue;
    const stored = join(dir, 'files', `${index}-${original.replaceAll('/', '_')}`);
    await mkdir(dirname(stored), { recursive: true });
    await Bun.write(stored, Bun.file(original));
    entries.push({ original, stored });
  }

  const manifest: Manifest = { timestamp: stamp, entries };
  await mkdir(dir, { recursive: true });
  await Bun.write(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function latestManifest(): Promise<Manifest | null> {
  const dirs = await readdir(backupsDir()).catch(() => []);
  const newest = dirs.sort().at(-1);
  if (!newest) return null;
  const file = Bun.file(join(backupsDir(), newest, 'manifest.json'));
  return (await file.exists()) ? ((await file.json()) as Manifest) : null;
}

export async function restore(manifest: Manifest): Promise<string[]> {
  const restored: string[] = [];
  for (const entry of manifest.entries) {
    if (!(await Bun.file(entry.stored).exists())) continue;
    await mkdir(dirname(entry.original), { recursive: true });
    await Bun.write(entry.original, Bun.file(entry.stored));
    restored.push(entry.original);
  }
  return restored;
}
