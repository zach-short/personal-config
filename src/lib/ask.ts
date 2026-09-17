import { join } from 'node:path';
import * as p from '@clack/prompts';
import { exists, readText } from './disk.ts';
import { repoRoot } from './paths.ts';
import { answerTape, hasCheckpoint, type ResumeEntry } from './resume.ts';
import type { AnswerValue, Question } from './types.ts';

export const READ_MORE = '__read_more__';

/**
 * Picked instead of an answer: leave this question unanswered and re-ask the previous one.
 * A sentinel rather than a thrown control flow because `READ_MORE` already established the
 * shape, and because the phase runner is the only thing that knows what "previous" means.
 */
export const BACK = '__back__';

/**
 * Every phase asks through this interface, never through clack directly. The harness has no
 * TTY, so the only way any of this is testable is if asking is a swappable strategy.
 */
export type Prompter = {
  /**
   * `canGoBack` is the runner's answer to "is there a question behind this one?", and the only
   * thing that puts `← back` in the list. Asking is not allowed to work it out for itself: a
   * phase's first question has nothing behind it, and neither does a question reached by an
   * `only`/`skip` filter that left it alone in the run.
   */
  ask(question: Question, fallback: AnswerValue, canGoBack?: boolean): Promise<AnswerValue>;
  confirm(message: string, fallback: boolean): Promise<boolean>;
  /**
   * Records something the run settled that was not a question — today, which repos were
   * picked. A prompter that keeps no record of the run leaves it undefined.
   */
  mark?(id: string, value: string): Promise<void>;
};

/** Non-interactive: takes the merged-config default, or a scripted answer in tests. */
export function defaultsPrompter(scripted: Record<string, AnswerValue> = {}): Prompter {
  return {
    async ask(question, fallback) {
      return scripted[question.id] ?? fallback;
    },
    async confirm(_message, fallback) {
      return fallback;
    },
  };
}

export function clackPrompter(): Prompter {
  return {
    async ask(question, fallback, canGoBack = false) {
      return askInteractively(question, fallback, canGoBack);
    },
    async confirm(message, fallback) {
      return unwrap<boolean>(await p.confirm({ message, initialValue: fallback }));
    },
  };
}

/**
 * Wraps any prompter so an interrupted run can be picked up. Every answer is written to the
 * checkpoint as it is given, and a previous run's answers are handed back without asking —
 * which is what makes `Ctrl+C` on question twenty cost one question instead of twenty.
 *
 * It is a decorator rather than a branch inside `clackPrompter` so that what is replayed is
 * exactly what was asked: the phases cannot tell the difference, and a test can drive the same
 * tape through `defaultsPrompter` with no terminal in sight.
 */
export function checkpointing(inner: Prompter, replay: ResumeEntry[] = []): Prompter {
  const tape = answerTape(replay);

  return {
    async ask(question, fallback, canGoBack) {
      const replayed = tape.replayed(question.id);
      if (replayed !== null) return replayed.value;
      const value = await inner.ask(question, fallback, canGoBack);
      // `BACK` is not an answer to this question, and recording it would put a sentinel in the
      // tape where a value belongs. What it is, to the checkpoint, is the previous answer
      // becoming provisional again.
      if (value === BACK) {
        await tape.rewind();
        return BACK;
      }
      await tape.record({ id: question.id, value });
      return value;
    },
    async confirm(message, fallback) {
      return inner.confirm(message, fallback);
    },
    async mark(id, value) {
      if (tape.replayed(id, value) !== null) return;
      await tape.record({ id, value });
    },
  };
}

/**
 * `text` and `confirm` questions carry no option list, so there is nowhere to put `← back` and
 * they do not offer it. They are still reachable *as* a destination — stepping back from the
 * next `select` lands on one — so the gap is that a chain ending in free text cannot be left
 * backwards, not that a typed answer is uncorrectable.
 */
async function askInteractively(
  question: Question,
  fallback: AnswerValue,
  canGoBack: boolean,
): Promise<AnswerValue> {
  if (question.kind === 'text') return askText(question, fallback);
  if (question.kind === 'confirm') {
    return unwrap<boolean>(
      await p.confirm({ message: question.ask, initialValue: fallback === true }),
    );
  }
  return askChoice(question, fallback, canGoBack);
}

async function askText(question: Question, fallback: AnswerValue): Promise<AnswerValue> {
  const answer = unwrap<string>(
    await p.text({
      message: question.ask,
      placeholder: question.placeholder ?? '',
      initialValue: typeof fallback === 'string' ? fallback : '',
    }),
  );
  return answer as string;
}

/** The `Read more…` loop: print the long form, then ask the same question again. */
async function askChoice(
  question: Question,
  fallback: AnswerValue,
  canGoBack: boolean,
): Promise<AnswerValue> {
  const options = choiceOptions(question, canGoBack);

  for (;;) {
    const answer =
      question.kind === 'multiselect'
        ? unwrap(await p.multiselect({ message: question.ask, options, required: false }))
        : unwrap(
            await p.select({
              message: question.ask,
              options,
              initialValue: typeof fallback === 'string' ? fallback : options[0]?.value,
            }),
          );

    // Leaving beats reading: a multiselect can carry both sentinels at once, and the person who
    // ticked `← back` has said they are on the wrong question.
    if (wantsBack(answer)) return BACK;
    if (!wantsMore(answer)) return answer as AnswerValue;
    p.note(await readMore(question.readMore), `More on: ${question.ask}`);
  }
}

/** Exported for the test that checks which questions offer the way out, and which cannot. */
export function choiceOptions(
  question: Question,
  canGoBack: boolean,
): Array<{ value: string; label: string; hint: string }> {
  return [
    ...(question.options ?? []).map((o) => ({
      value: o.value,
      label: o.recommended ? `${o.label}  (recommended)` : o.label,
      hint: o.example,
    })),
    {
      value: READ_MORE,
      label: 'Read more…',
      hint: 'what each option means, and how to undo it',
    },
    ...(canGoBack
      ? [{ value: BACK, label: '← back', hint: 'change the answer before this one' }]
      : []),
  ];
}

function wantsMore(answer: unknown): boolean {
  return answer === READ_MORE || (Array.isArray(answer) && answer.includes(READ_MORE));
}

function wantsBack(answer: unknown): boolean {
  return answer === BACK || (Array.isArray(answer) && answer.includes(BACK));
}

export async function readMore(id: string): Promise<string> {
  const path = join(repoRoot(), 'docs', 'choices', `${id}.md`);
  if (!(await exists(path))) return `No long form written yet for "${id}".`;
  return (await readText(path)).trim();
}

function unwrap<T>(value: T | symbol): T {
  if (p.isCancel(value)) cancelRun();
  return value as T;
}

/**
 * The one place a cancelled prompt leaves, so every prompt tells the person the same true thing
 * about what survives. `setup`'s repo picker is not a `Question` and so cannot reach `unwrap`;
 * it printed the bare "Nothing was written." until 2026-09-15 even though the whole `you` phase
 * was already on disk behind it. Exported so there is one message rather than two.
 */
export function cancelRun(): never {
  p.cancel(cancelMessage());
  process.exit(0);
}

/**
 * "Nothing was written" was the whole truth until 2026-09-15: answers lived in memory only, so
 * a cancel on question twenty of thirty threw away the first nineteen as well as the files.
 * It is still the truth about the files; the second sentence is what changed.
 */
export function cancelMessage(): string {
  if (!hasCheckpoint()) return 'Nothing was written.';
  return [
    'Nothing was written. Your answers so far are saved —',
    'run `personal-config setup` again to pick up where you left off.',
  ].join(' ');
}

/**
 * The confirm in front of a write a command makes on its own — `passoff claim`, `archive` —
 * rather than at the end of a wizard. In a terminal it asks; with no TTY there is nobody to ask,
 * so the preview printed above it is the whole contract and the write goes ahead, which is what
 * lets the harness and the test suite drive these commands at all. `--force` skips it the way it
 * does for `setup`.
 */
export async function confirmWrite(message: string, force: boolean): Promise<boolean> {
  if (force || process.stdout.isTTY !== true) return true;
  return clackPrompter().confirm(message, true);
}
