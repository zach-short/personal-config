import { type Line, proseLines } from './markdown.ts';

/**
 * The ledger's `## Log` (per-item-board `DESIGN.md` D4): one dated line per event, unnumbered,
 * oldest first, in the place the step log was. Read here so `unfolded` and the fold that moves
 * old lines out (Phase 3) agree about which lines are log lines and how old each one is.
 */

/** DIAL-4. The fold's `--log-days` overrides it; `unfolded` reports past it. */
export const LOG_DAYS = 90;

export type LogLine = Line & { date: string };

/** Every `- YYYY-MM-DD …` line under `## Log`, down to the next heading of level two or above. */
export function logLines(markdown: string): LogLine[] {
  const lines = proseLines(markdown);
  const start = lines.findIndex(({ text }) => /^##\s+Log\s*$/.test(text));
  if (start === -1) return [];
  const after = lines.slice(start + 1);
  const end = after.findIndex(({ text }) => /^#{1,2}\s/.test(text));
  return (end === -1 ? after : after.slice(0, end)).flatMap((line) => {
    const date = line.text.match(/^-\s+(\d{4}-\d{2}-\d{2})\b/)?.[1];
    return date === undefined ? [] : [{ ...line, date }];
  });
}

/** Lines dated more than `days` before `today`, both ISO dates; string order is date order. */
export function staleLogLines(markdown: string, today: string, days: number): LogLine[] {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const before = cutoff.toISOString().slice(0, 10);
  return logLines(markdown).filter((line) => line.date < before);
}
