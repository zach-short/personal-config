import { proseLines } from './markdown.ts';

/**
 * The ledger's step log (§2.1), parsed once for everyone who reads it.
 *
 * Same reason as the board's parser: `doctor`'s step-number rule and the `handoff` command must
 * agree about what counts as a step. If they do not, the command hands out a number the rule
 * already considers taken — which is the exact failure "read the file for the next number"
 * exists to prevent, reintroduced by the tool that automates it.
 */

/** `**12. Built the thing.** Done 2026-09-15, …` — the step log's one shape. */
const STEP = /^\*\*(\d+)\.\s/;
const TITLED = /^\*\*(\d+)\.\s+(.*?)\*\*/;

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
  return (text.match(TITLED)?.[2] ?? '').trim();
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
