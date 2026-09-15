import { duplicateSteps, type LedgerStep, ledgerSteps } from '../../lib/ledger.ts';
import type { Finding } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';

/**
 * Two sessions taking the same step number is the failure the "read the file for the next
 * number" rule exists to prevent — and a duplicate is invisible until something cites it.
 *
 * The log itself is parsed by `src/lib/ledger.ts`, which `handoff step` reads through as well,
 * so the number this reports as taken is the number that command refuses to hand out.
 */
export const stepNumbers = {
  id: 'step-numbers',
  standardId: '§2.1',
  appliesTo: (doc: Doc) => doc.kind === 'ledger',
  check(doc: Doc): Finding[] {
    const steps = ledgerSteps(doc.text);
    return [...duplicates(doc, steps), ...gaps(doc, steps)];
  },
};

function duplicates(doc: Doc, steps: LedgerStep[]): Finding[] {
  return duplicateSteps(steps).flatMap((number) => {
    const [first, ...repeats] = steps.filter((step) => step.number === number);
    if (!first) return [];
    return repeats.map((step) =>
      finding(doc, step.line, `step ${number} is already used at line ${first.line}`),
    );
  });
}

function gaps(doc: Doc, steps: LedgerStep[]): Finding[] {
  const sorted = [...new Set(steps.map((s) => s.number))].sort((a, b) => a - b);

  for (const [index, number] of sorted.entries()) {
    if (number !== index + 1) {
      const at = steps.find((s) => s.number === number)?.line ?? 1;
      return [finding(doc, at, `step ${number} is not contiguous — expected ${index + 1}`)];
    }
  }
  return [];
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
