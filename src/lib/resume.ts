import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { today } from './date.ts';
import { configDir } from './paths.ts';
import type { AnswerValue } from './types.ts';
import { version } from './version.ts';

/** One thing the person settled, in the order they settled it. */
export type ResumeEntry = { id: string; value: AnswerValue };

/** An unfinished run's answers, as they sit on disk between an interruption and the next run. */
export type Checkpoint = { version: string; date: string; entries: ResumeEntry[] };

/** What `setup` found when it looked for an unfinished run. */
export type ResumeOffer =
  | { kind: 'none' }
  | { kind: 'stale'; version: string }
  | { kind: 'ready'; checkpoint: Checkpoint };

/**
 * `~/.config/personal-config/run.json` — beside the saved config and nothing like it. The
 * saved config is what a person decided to keep; this is what they had typed when the terminal
 * went away, written to be deleted, the way `.git/MERGE_MSG` is. Keeping them in one file
 * would mean an abandoned run's half-answers outranking a profile on every later run.
 */
export function checkpointFile(): string {
  return join(configDir(), 'run.json');
}

/**
 * A checkpoint written by a different build is discarded rather than replayed. The question
 * catalog ships with the build, so an id that meant one thing in one version may be missing or
 * mean something else in the next, and an answer replayed into the wrong question is worse
 * than a question asked twice.
 */
export async function readCheckpoint(): Promise<ResumeOffer> {
  const file = Bun.file(checkpointFile());
  if (!(await file.exists())) return { kind: 'none' };

  const checkpoint = parseCheckpoint(await file.json().catch(() => null));
  if (checkpoint === null || checkpoint.entries.length === 0) return { kind: 'none' };
  if (checkpoint.version !== (await version())) {
    return { kind: 'stale', version: checkpoint.version };
  }
  return { kind: 'ready', checkpoint };
}

/**
 * Written after every single answer, because the failure this exists for is a `Ctrl+C` between
 * two questions. A failed write is swallowed: an unwritable `~/.config` costs the person their
 * recovery file, which is bad, but ending a wizard they are twenty questions into is worse.
 */
export async function writeCheckpoint(entries: ResumeEntry[]): Promise<void> {
  const checkpoint: Checkpoint = { version: await version(), date: today(), entries };
  try {
    await mkdir(configDir(), { recursive: true });
    await Bun.write(checkpointFile(), `${JSON.stringify(checkpoint, null, 2)}\n`);
  } catch {
    // Nothing to report it to — the caller is between two questions and the run goes on.
  }
}

/** Called once a run has written its files: those answers are properly on disk now. */
export async function clearCheckpoint(): Promise<void> {
  await rm(checkpointFile(), { force: true });
}

/** How a `setup` run ended — the only thing the retirement rule below needs to know. */
export type RunOutcome = 'written' | 'already-current' | 'dry-run' | 'declined';

/**
 * Which endings retire the checkpoint. A run that reached its end has nothing left to pick up,
 * and "already current" is such an ending even though it wrote nothing — offering to resume it
 * would name a run the person actually finished.
 *
 * The other two keep it on purpose. A dry run is a preview the person is expected to run again
 * for real, and a declined preview is the one case where the answers behind the decline are
 * exactly the ones they would hate to re-type.
 */
export function retiresCheckpoint(outcome: RunOutcome): boolean {
  return outcome === 'written' || outcome === 'already-current';
}

/**
 * Synchronous because its one caller is the `Ctrl+C` path, which prints and exits where it
 * stands. The file only exists once an answer has been recorded, so its presence is the whole
 * test of whether "your answers are saved" is a true thing to print.
 */
export function hasCheckpoint(): boolean {
  return existsSync(checkpointFile());
}

/** What the resume offer shows before it is accepted. */
export function describeCheckpoint(checkpoint: Checkpoint): string {
  return `${checkpoint.entries.length} answer(s), last saved ${checkpoint.date}`;
}

/** Replays a previous run's answers, then records this run's, one answer at a time. */
export type AnswerTape = {
  /**
   * The next recorded entry while it is still the one this run is asking for, `null` from the
   * moment the two part company. Pass a `value` for something that was not a question — then
   * it has to match too, because the point of recording it was to notice when it changed.
   */
  replayed(id: string, value?: AnswerValue): ResumeEntry | null;
  record(entry: ResumeEntry): Promise<void>;
};

/**
 * Replay is positional and stops at the first thing that does not match — a question in a
 * different place, or a repo set the person picked differently this time. It has to be: the
 * per-repo questions are asked once per repo under the same ids, so a tape read out of step
 * would answer one repo's questions with another's and never say so. Stopping early only
 * costs the person questions they were going to be asked anyway.
 */
export function answerTape(replay: ResumeEntry[]): AnswerTape {
  const kept: ResumeEntry[] = [];
  let replaying = replay.length > 0;

  return {
    replayed(id, value) {
      const next = replaying ? replay[kept.length] : undefined;
      if (
        next !== undefined &&
        next.id === id &&
        (value === undefined || next.value === value)
      ) {
        kept.push(next);
        return next;
      }
      replaying = false;
      return null;
    },
    async record(entry) {
      kept.push(entry);
      await writeCheckpoint(kept);
    },
  };
}

function parseCheckpoint(parsed: unknown): Checkpoint | null {
  if (!isRecord(parsed) || !Array.isArray(parsed.entries)) return null;
  const entries: unknown[] = parsed.entries;
  // One unreadable entry rejects the file: dropping it would shift every later answer by one.
  if (!entries.every(isEntry)) return null;
  return {
    version: typeof parsed.version === 'string' ? parsed.version : '',
    date: typeof parsed.date === 'string' ? parsed.date : '',
    entries,
  };
}

function isEntry(value: unknown): value is ResumeEntry {
  return isRecord(value) && typeof value.id === 'string' && isAnswerValue(value.value);
}

function isAnswerValue(value: unknown): value is AnswerValue {
  if (Array.isArray(value)) return value.every((item) => typeof item === 'string');
  return typeof value === 'string' || typeof value === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
