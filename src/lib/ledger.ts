import { proseLines } from './markdown.ts';

/**
 * The ledger's step log (§2.1), parsed once for everyone who reads it.
 *
 * Same reason as the board's parser: `doctor`'s step-number rule and the `handoff` command must
 * agree about what counts as a step. If they do not, the command hands out a number the rule
 * already considers taken — which is the exact failure "read the file for the next number"
 * exists to prevent, reintroduced by the tool that automates it.
 */

/**
 * A step heading, in every shape a hand-written log uses: `**12. Built it.** …`, `**12.** Built
 * it …` where the bold stops after the number, the same line indented, and a list-item step
 * `- **12. Built it.**`. They are one kind of thing, and reading only the first made a duplicate
 * written in any of the other three invisible — to `doctor`, and to the `nextFreeStep` that
 * `handoff step` hands out, which would then be a number the log had already taken.
 */
const STEP = /^\s*(?:[-*+]\s+)?\*\*(\d+)\.(?:\*\*)?\s/;

/** `**12. Built it.**` — the bold closes after the title, so the bold carries it. */
const BOLD_TITLE = /^\s*(?:[-*+]\s+)?\*\*(?:\d+)\.\s+(.*?)\*\*/;

/** `**12.** Built it. Done …` — the bold closed early, so the title is the sentence after it. */
const PLAIN_TITLE = /^\s*(?:[-*+]\s+)?\*\*(?:\d+)\.\*\*\s+([^.]*\.?)/;

export type LedgerStep = { number: number; line: number; title: string };

export function ledgerSteps(markdown: string): LedgerStep[] {
  return proseLines(markdown)
    .map(({ text, line }) => ({
      line,
      number: Number(text.match(STEP)?.[1] ?? Number.NaN),
      title: titleOf(text),
    }))
    .filter((step) => Number.isFinite(step.number));
}

function titleOf(text: string): string {
  return (text.match(BOLD_TITLE)?.[1] ?? text.match(PLAIN_TITLE)?.[1] ?? '').trim();
}

/**
 * The next number nothing has taken — `max + 1`, never the first hole. A hole means two sessions
 * already disagreed about this file, and handing the hole out makes a second writer's step land
 * before a first writer's in a log whose whole promise is that it is append-only.
 */
export function nextFreeStep(steps: LedgerStep[]): number {
  return steps.reduce((highest, step) => Math.max(highest, step.number), 0) + 1;
}

/** Numbers below the highest that no step uses — `doctor`'s non-contiguity finding, in advance. */
export function missingSteps(steps: LedgerStep[]): number[] {
  const taken = new Set(steps.map((step) => step.number));
  const highest = steps.reduce((max, step) => Math.max(max, step.number), 0);
  const missing: number[] = [];
  for (let number = 1; number < highest; number += 1) {
    if (!taken.has(number)) missing.push(number);
  }
  return missing;
}

export function duplicateSteps(steps: LedgerStep[]): number[] {
  const seen = new Set<number>();
  const twice = new Set<number>();
  for (const step of steps) {
    if (seen.has(step.number)) twice.add(step.number);
    seen.add(step.number);
  }
  return [...twice];
}
