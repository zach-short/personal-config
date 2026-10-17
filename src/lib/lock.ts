import { open, readFile, stat, unlink } from 'node:fs/promises';
import { short } from './ui.ts';

/**
 * The lock around a board claim. Node has no `flock`, so the lock is a file created with
 * `O_EXCL`, which is atomic where a check-then-create is not, holding the creator's pid and the
 * time it was taken. A process killed with its lock in place leaves the file behind, which is
 * why a waiter reads it: a dead pid, or a holder older than `staleMs`, is taken over. A live
 * holder is waited for up to `waitMs` and then refused by name, never skipped, because the write
 * behind the lock is the one two sessions must not both make (two claims of one row both said
 * "Claimed" in 30 of 30 runs on 2026-10-16).
 */
export type LockOptions = { waitMs?: number; staleMs?: number; now?: () => number };

const WAIT_MS = 10_000;
const STALE_MS = 10 * 60 * 1000;
const POLL_MS = 50;
/** A lock file with nothing in it yet belongs to a process between its `open` and its write. */
const EMPTY_GRACE_MS = 5_000;

export async function withLock<T>(
  path: string,
  run: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  await take(path, options);
  try {
    return await run();
  } finally {
    await unlink(path).catch(() => undefined);
  }
}

async function take(path: string, options: LockOptions): Promise<void> {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.waitMs ?? WAIT_MS);
  while (!(await create(path, now()))) {
    const holder = await readHolder(path);
    if (holder === null || isStale(holder, now(), options.staleMs ?? STALE_MS)) {
      // Between this read and the unlink a fresh holder could appear; the window is microseconds
      // wide and opens only after a crash left a stale file behind.
      await unlink(path).catch(() => undefined);
      continue;
    }
    if (now() >= deadline) throw new Error(refusal(path, holder));
    await sleep(POLL_MS);
  }
}

/** `pid` is 0 for a file that holds no pid yet; `at` is then the file's own time. */
type Holder = { pid: number; at: number };

async function create(path: string, nowMs: number): Promise<boolean> {
  try {
    const handle = await open(path, 'wx');
    try {
      await handle.writeFile(`${process.pid}\n${new Date(nowMs).toISOString()}\n`);
    } finally {
      await handle.close();
    }
    return true;
  } catch (error) {
    if (isCode(error, 'EEXIST')) return false;
    throw error;
  }
}

/** Null when the file is gone, or when it never got its pid and is past the grace period. */
async function readHolder(path: string): Promise<Holder | null> {
  const [text, info] = await Promise.all([
    readFile(path, 'utf8').catch(() => null),
    stat(path).catch(() => null),
  ]);
  if (text === null || info === null) return null;
  const [pidLine, atLine] = text.split('\n');
  const pid = Number(pidLine);
  const at = Date.parse(atLine ?? '');
  if (Number.isInteger(pid) && pid > 0 && !Number.isNaN(at)) return { pid, at };
  return Date.now() - info.mtimeMs > EMPTY_GRACE_MS ? null : { pid: 0, at: info.mtimeMs };
}

function isStale(holder: Holder, nowMs: number, staleMs: number): boolean {
  if (holder.pid > 0 && !alive(holder.pid)) return true;
  return nowMs - holder.at > staleMs;
}

/** Signal 0 tests for the process without touching it; EPERM means it exists under another user. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isCode(error, 'EPERM');
  }
}

function refusal(path: string, holder: Holder): string {
  const since = new Date(holder.at).toISOString();
  return `${short(path)} is held by process ${holder.pid} since ${since}: another claim is running here. Wait for it to finish, or remove the file if that process is gone.`;
}

function isCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
