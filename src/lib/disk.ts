import { randomBytes } from 'node:crypto';
import type { Dirent, Stats } from 'node:fs';
import * as fs from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Every disk read and write in this tool goes through here, because the published bin runs on
 * Node and `Bun.file` / `Bun.write` do not exist there. One module means the next runtime change
 * is one file's problem rather than the 44 call sites this replaced.
 *
 * It is also the only file that imports `node:fs/promises`, and it lets one call run at a time
 * (`inTurn`). Bun 1.2.9 on macOS loses the completion of an `fs.promises` call when another is in
 * flight: the promise never settles, the event loop stays alive, and the process never exits.
 * `fold migrate` hung 1 run in about 2,500 this way, from a `Promise.all` over two `stat` calls
 * in `fold`'s own code, and a 14-line script that does nothing but `Promise.all` over `stat` and
 * `readFile` hung 4 in 3,000 and 49 in 24,000; the same calls awaited one at a time hung 0 in
 * 12,000 (board item 131, 2026-10-17). A 50 ms timer does not free it: the loop keeps running.
 * `bun test` showed it as a 30 s timeout in a test that spawns `fold`, and a second failure
 * blamed on the next test. Nothing else in `src/` may import `node:fs/promises`
 * (`tests/disk-in-turn.test.ts` fails on it), because one overlapping call from any file is
 * enough.
 */

let tail: Promise<void> = Promise.resolve();

/**
 * Runs `call` after every earlier call here has settled, so no two `fs.promises` calls overlap
 * even where a caller starts them together with `Promise.all`. A call that rejects goes to its
 * own caller and does not hold up the next. `call` must not wait on another `inTurn`: it would
 * wait for itself.
 */
export function inTurn<T>(call: () => Promise<T>): Promise<T> {
  const mine = tail.then(call);
  tail = mine.then(
    () => undefined,
    () => undefined,
  );
  return mine;
}

export function stat(path: string): Promise<Stats> {
  return inTurn(() => fs.stat(path));
}

function lstat(path: string): Promise<Stats> {
  return inTurn(() => fs.lstat(path));
}

export function readdir(path: string): Promise<string[]>;
export function readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
export function readdir(
  path: string,
  options?: { withFileTypes: true },
): Promise<string[] | Dirent[]> {
  return inTurn<string[] | Dirent[]>(() =>
    options === undefined ? fs.readdir(path) : fs.readdir(path, options),
  );
}

/** The bytes, undecoded: a read-back that compares bytes must not go through a string. */
export function readBytes(path: string): Promise<Buffer> {
  return inTurn(() => fs.readFile(path));
}

export function mkdir(
  path: string,
  options?: { recursive: true },
): Promise<string | undefined> {
  return inTurn(() => fs.mkdir(path, options));
}

export function rename(from: string, to: string): Promise<void> {
  return inTurn(() => fs.rename(from, to));
}

export function rm(path: string, options: { force: true }): Promise<void> {
  return inTurn(() => fs.rm(path, options));
}

export function unlink(path: string): Promise<void> {
  return inTurn(() => fs.unlink(path));
}

export function realpath(path: string): Promise<string> {
  return inTurn(() => fs.realpath(path));
}

function rmdir(path: string): Promise<void> {
  return inTurn(() => fs.rmdir(path));
}

function chmod(path: string, mode: number): Promise<void> {
  return inTurn(() => fs.chmod(path, mode));
}

function copyFile(from: string, to: string): Promise<void> {
  return inTurn(() => fs.copyFile(from, to));
}

function writeFile(path: string, text: string): Promise<void> {
  return inTurn(() => fs.writeFile(path, text, 'utf8'));
}

/**
 * Creates the file and writes `text`, and rejects with `EEXIST` when the path is already there.
 * The create is atomic where a check and then a write is not, which is what a lock file needs.
 */
export function writeNew(path: string, text: string): Promise<void> {
  return inTurn(() => fs.writeFile(path, text, { encoding: 'utf8', flag: 'wx' }));
}

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
  return inTurn(() => fs.readFile(path, 'utf8'));
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
    await writeFile(path, text);
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
    await writeFile(temp, text);
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
