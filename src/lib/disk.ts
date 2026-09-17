import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Every disk read and write in this tool goes through here, because the published bin runs on
 * Node and `Bun.file` / `Bun.write` do not exist there. One module means the next runtime change
 * is one file's problem rather than the 44 call sites this replaced.
 */

/**
 * A *regular file* at this path — deliberately false for a directory, which is what
 * `Bun.file().exists()` answered (verified 2026-09-16: `Bun.file('<a dir>').exists()` → `false`).
 * `discover.ts` probes directories separately on the strength of that, and `isGitRepo` tells a
 * `.git` directory from a `.git` file by it; a version that said `true` for directories would
 * change both without failing a gate.
 */
export async function exists(path: string): Promise<boolean> {
  return stat(path)
    .then((entry) => entry.isFile())
    .catch(() => false);
}

/** Rejects when the path is not there, as `Bun.file().text()` did — callers catch where they mean to. */
export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readText(path)) as unknown;
}

/**
 * Parent directories are created, because `Bun.write` created them (verified 2026-09-16) and
 * `catalog.ts` and `resume.ts` wrote through it without a `mkdir` of their own.
 */
export async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, 'utf8');
}

/** `Bun.write(dest, Bun.file(src))` — a copy, not a read-then-write, so bytes are never decoded. */
export async function copyTo(from: string, to: string): Promise<void> {
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}
