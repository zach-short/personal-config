import { randomBytes } from 'node:crypto';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
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
 * A regular file is written to a temp name beside it and renamed over it, so a reader sees the
 * old bytes or the new ones and never a torn file, and two writers' last rename wins whole: two
 * `passoff claim` runs at once lost one row's status in 30 of 30 runs on 2026-10-16 when the
 * board was rewritten in place. A symlink is still written through, because a rename would
 * replace the link with a file. The existing permission bits survive the rename.
 *
 * `mode` is applied by a separate `chmod` rather than `writeFile`'s own `mode` option, which is
 * honoured only when the call *creates* the file: verified 2026-09-18 that `writeFile` with
 * `mode: 0o755` over an existing 0644 file leaves it 0644. Overwriting an already-installed
 * file is the case that most needs the bit, so the option alone would have fixed nothing for
 * anyone who already ran `setup`.
 */
export async function writeText(path: string, text: string, mode?: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const current = await lstat(path).catch(() => null);
  if (current !== null && !current.isFile()) {
    await writeFile(path, text, 'utf8');
    if (mode !== undefined) await chmod(path, mode);
    return;
  }
  await writeByRename(
    path,
    text,
    mode ?? (current === null ? undefined : current.mode & 0o777),
  );
}

async function writeByRename(
  path: string,
  text: string,
  bits: number | undefined,
): Promise<void> {
  const temp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await writeFile(temp, text, 'utf8');
    if (bits !== undefined) await chmod(temp, bits);
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
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

/**
 * Removes a directory only when nothing is in it, and says whether it did. A path that is not a
 * directory, or not there, is left as it is. `rmdir` refuses a non-empty directory on its own, so
 * a file written between the read and the call is kept, not deleted with it.
 */
export async function removeIfEmpty(dir: string): Promise<boolean> {
  const entries = await readdir(dir).catch(() => null);
  if (entries === null || entries.length > 0) return false;
  await rmdir(dir);
  return true;
}
