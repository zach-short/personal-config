import { type Line, proseLines } from './markdown.ts';

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
const BOLD_STEP = /^\s*(?:[-*+]\s+)?\*\*(\d+)\.(?:\*\*)?\s/;

/**
 * `12. **Built it.** …` — the number outside the bold, as a top-level ordered-list item. A
 * ledger written this way puts each step's body in the item's indented continuation lines.
 */
const LIST_STEP = /^ {0,3}(\d+)\.\s+\*\*/;

/** `**12. Built it.**` — the bold closes after the title, so the bold carries it. */
const BOLD_TITLE = /^\s*(?:[-*+]\s+)?\*\*(?:\d+)\.\s+(.*?)\*\*/;

/** `**12.** Built it. Done …` — the bold closed early, so the title is the sentence after it. */
const PLAIN_TITLE = /^\s*(?:[-*+]\s+)?\*\*(?:\d+)\.\*\*\s+([^.]*\.?)/;

/** `12. **Built it.**` — the list form's title is the bold that opens the item. */
const LIST_TITLE = /^ {0,3}\d+\.\s+\*\*(.*?)\*\*/;

/** Which of the two heading families a log is written in. See `stepForm`. */
export type StepForm = 'bold' | 'list';

export type LedgerStep = { number: number; line: number; title: string; form: StepForm };

export function ledgerSteps(markdown: string): LedgerStep[] {
  const lines = proseLines(markdown);
  const nested = insideListItems(lines);
  const form = stepForm(lines, nested);
  const pattern = form === 'list' ? LIST_STEP : BOLD_STEP;
  return lines
    .filter(({ line }) => !nested.has(line))
    .map(({ text, line }) => ({
      line,
      number: Number(text.match(pattern)?.[1] ?? Number.NaN),
      title: titleOf(text, form),
      form,
    }))
    .filter((step) => Number.isFinite(step.number));
}

/**
 * A log is read in one form, never both, because each form is ambiguous only in the presence of
 * the other. `1. **Thing.**` is an ordinary numbered list in most bold-form ledgers — invariants,
 * settled answers, a review's findings inside a step — and reading it as a step there reports
 * duplicates that are not. In a list-form ledger, `**15. Thing.**` indented under step 42 is a
 * sub-item of that step, and reading it as a step reports a gap that is not one.
 *
 * Bold wins a mix: a bold heading standing outside any list item cannot be an ordinary list, while
 * a numbered bold list item can. So the list form is the steps only when no bold step stands on
 * its own. The cost is a hand-written log that genuinely mixes the two; its list-form steps stay
 * invisible, exactly as every list-form step was before this form was read at all — and its
 * bold steps then start past 1, which `doctor`'s contiguity check reports, so a mix is loud.
 */
function stepForm(lines: Line[], nested: Set<number>): StepForm {
  const bold = lines.some(({ text, line }) => BOLD_STEP.test(text) && !nested.has(line));
  const list = lines.some(({ text }) => LIST_STEP.test(text));
  return list && !bold ? 'list' : 'bold';
}

/**
 * Lines in a list-form item's body: the blank and indented lines until something unindented.
 * Nothing in here is a step in either form — it is that item's own content.
 */
function insideListItems(lines: Line[]): Set<number> {
  const inside = new Set<number>();
  let open = false;
  for (const { text, line } of lines) {
    if (LIST_STEP.test(text)) {
      open = true;
      continue;
    }
    if (text.trim() !== '' && !/^\s/.test(text)) open = false;
    if (open) inside.add(line);
  }
  return inside;
}

function titleOf(text: string, form: StepForm): string {
  const title =
    form === 'list'
      ? text.match(LIST_TITLE)?.[1]
      : (text.match(BOLD_TITLE)?.[1] ?? text.match(PLAIN_TITLE)?.[1]);
  return (title ?? '').trim();
}

/** A step heading in the log's own form, so a line this tool writes never flips the form. */
export function stepHeading(form: StepForm, number: number, title: string): string {
  return form === 'list' ? `${number}. **${title}**` : `**${number}. ${title}**`;
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
