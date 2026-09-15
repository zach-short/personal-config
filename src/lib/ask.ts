import { join } from 'node:path';
import * as p from '@clack/prompts';
import { repoRoot } from './paths.ts';
import type { AnswerValue, Question } from './types.ts';

export const READ_MORE = '__read_more__';

/**
 * Every phase asks through this interface, never through clack directly. The harness has no
 * TTY, so the only way any of this is testable is if asking is a swappable strategy.
 */
export type Prompter = {
  ask(question: Question, fallback: AnswerValue): Promise<AnswerValue>;
  confirm(message: string, fallback: boolean): Promise<boolean>;
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
    async ask(question, fallback) {
      return askInteractively(question, fallback);
    },
    async confirm(message, fallback) {
      return unwrap<boolean>(await p.confirm({ message, initialValue: fallback }));
    },
  };
}

async function askInteractively(
  question: Question,
  fallback: AnswerValue,
): Promise<AnswerValue> {
  if (question.kind === 'text') return askText(question, fallback);
  if (question.kind === 'confirm') {
    return unwrap<boolean>(
      await p.confirm({ message: question.ask, initialValue: fallback === true }),
    );
  }
  return askChoice(question, fallback);
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
async function askChoice(question: Question, fallback: AnswerValue): Promise<AnswerValue> {
  const options = [
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
  ];

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

    if (!wantsMore(answer)) return answer as AnswerValue;
    p.note(await readMore(question.readMore), `More on: ${question.ask}`);
  }
}

function wantsMore(answer: unknown): boolean {
  return answer === READ_MORE || (Array.isArray(answer) && answer.includes(READ_MORE));
}

export async function readMore(id: string): Promise<string> {
  const file = Bun.file(join(repoRoot(), 'docs', 'choices', `${id}.md`));
  if (!(await file.exists())) return `No long form written yet for "${id}".`;
  return (await file.text()).trim();
}

function unwrap<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Nothing was written.');
    process.exit(0);
  }
  return value as T;
}
