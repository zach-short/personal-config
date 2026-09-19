import { chmod, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
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

/**
 * The permission bits alone, or null where there is nothing to read them from. Masked to
 * `0o777` because `stat().mode` carries the file type in its high bits, and a caller comparing
 * it against a plain `0o755` would never match.
 */
export async function modeOf(path: string): Promise<number | null> {
  return stat(path)
    .then((entry) => entry.mode & 0o777)
    .catch(() => null);
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
 *
 * `mode` is applied by a separate `chmod` rather than `writeFile`'s own `mode` option, which is
 * honoured only when the call *creates* the file: verified 2026-09-18 that `writeFile` with
 * `mode: 0o755` over an existing 0644 file leaves it 0644. Overwriting an already-installed
 * file is the case that most needs the bit, so the option alone would have fixed nothing for
 * anyone who already ran `setup`.
 */
export async function writeText(path: string, text: string, mode?: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, 'utf8');
  if (mode !== undefined) await chmod(path, mode);
}

/** Sets permission bits on a file that already holds the right bytes — see `writeText`. */
export async function setMode(path: string, mode: number): Promise<void> {
  await chmod(path, mode);
}

/** `Bun.write(dest, Bun.file(src))` — a copy, not a read-then-write, so bytes are never decoded. */
export async function copyTo(from: string, to: string): Promise<void> {
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}
