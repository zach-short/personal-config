import type { Finding } from '../../lib/types.ts';
import { type Doc, proseLines } from '../scan.ts';

const STEP = /^\*\*(\d+)\.\s/;

/**
 * Two sessions taking the same step number is the failure the "read the file for the next
 * number" rule exists to prevent — and a duplicate is invisible until something cites it.
 */
export const stepNumbers = {
  id: 'step-numbers',
  standardId: '§2.1',
  appliesTo: (doc: Doc) => doc.kind === 'ledger',
  check(doc: Doc): Finding[] {
    const steps = proseLines(doc)
      .map(({ text, line }) => ({ line, number: Number(text.match(STEP)?.[1] ?? Number.NaN) }))
      .filter((s) => Number.isFinite(s.number));

    return [...duplicates(doc, steps), ...gaps(doc, steps)];
  },
};

type Step = { line: number; number: number };

function duplicates(doc: Doc, steps: Step[]): Finding[] {
  const seen = new Map<number, number>();
  const findings: Finding[] = [];

  for (const step of steps) {
    const first = seen.get(step.number);
    if (first !== undefined) {
      findings.push(
        finding(doc, step.line, `step ${step.number} is already used at line ${first}`),
      );
    } else {
      seen.set(step.number, step.line);
    }
  }
  return findings;
}

function gaps(doc: Doc, steps: Step[]): Finding[] {
  const sorted = [...new Set(steps.map((s) => s.number))].sort((a, b) => a - b);
  const findings: Finding[] = [];

  for (const [index, number] of sorted.entries()) {
    const expected = index + 1;
    if (number !== expected) {
      const at = steps.find((s) => s.number === number)?.line ?? 1;
      findings.push(
        finding(doc, at, `step ${number} is not contiguous — expected ${expected}`),
      );
      break;
    }
  }
  return findings;
}

function finding(doc: Doc, line: number, message: string): Finding {
  return {
    rule: 'step-numbers',
    standardId: '§2.1',
    file: doc.path,
    line,
    message,
    fixable: false,
  };
}
