import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { readText } from './disk.ts';

/**
 * Reading the harness's own session transcripts, which is the only way an agent can learn its
 * context size: nothing in context reports it, and the first signal of overrun is auto-
 * compaction, which is already the expensive outcome. The harness writes per-message usage into
 * the transcript, and the newest record's input + cache_creation + cache_read is the size now.
 */
const USAGE_KEYS = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];

/** Transcripts under one project directory, newest first. Empty when the directory is absent. */
export async function transcripts(dir: string): Promise<string[]> {
  const names = await readdir(dir).catch(() => []);
  const paths = names.filter((name) => name.endsWith('.jsonl')).map((name) => join(dir, name));
  const timed = await Promise.all(paths.map(async (path) => ({ path, at: await mtime(path) })));
  return timed.sort((a, b) => b.at - a.at).map((entry) => entry.path);
}

async function mtime(path: string): Promise<number> {
  return stat(path)
    .then((info) => info.mtimeMs)
    .catch(() => 0);
}

/**
 * The sentinel is the only thing that proves a transcript is *this* conversation. Newest-mtime
 * picks the wrong one whenever two sessions share a repo — observed reporting a neighbouring
 * session's 394k as ours — so there is deliberately no fallback here: no match returns null and
 * the caller lists the candidates rather than guessing.
 */
export async function findBySentinel(
  files: string[],
  sentinel: string,
): Promise<string | null> {
  for (const path of files) {
    const text = await readText(path).catch(() => '');
    if (text.includes(sentinel)) return path;
  }
  return null;
}

/** The last usage record in a transcript, summed. Null when the session has not logged one. */
export function contextSize(jsonl: string): number | null {
  let last: Record<string, unknown> | null = null;
  for (const line of jsonl.split('\n')) {
    const usage = usageOf(line);
    if (usage) last = usage;
  }

  if (last === null) return null;
  const record = last;
  return USAGE_KEYS.reduce((sum, key) => sum + numberAt(record, key), 0);
}

/** A transcript is append-only JSONL: one bad line is skipped, never fatal to the read. */
function usageOf(line: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(line);
    const message = isRecord(parsed) ? parsed.message : null;
    const usage = isRecord(message) ? message.usage : null;
    return isRecord(usage) ? usage : null;
  } catch {
    return null;
  }
}

function numberAt(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === 'number' ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
