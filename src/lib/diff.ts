/**
 * A deliberately small diff: trim the shared head and tail, print what is left. It is enough
 * to answer the only question the preview has to answer — "what is this about to change in a
 * file I already have?" — without a diff library.
 */

export type DiffLine = { kind: ' ' | '-' | '+'; text: string };

export function diffLines(before: string, after: string): DiffLine[] {
  const oldLines = before.length === 0 ? [] : before.split('\n');
  const newLines = after.split('\n');

  let head = 0;
  while (
    head < oldLines.length &&
    head < newLines.length &&
    oldLines[head] === newLines[head]
  ) {
    head += 1;
  }

  let tail = 0;
  while (
    tail < oldLines.length - head &&
    tail < newLines.length - head &&
    oldLines[oldLines.length - 1 - tail] === newLines[newLines.length - 1 - tail]
  ) {
    tail += 1;
  }

  return [
    ...oldLines
      .slice(head, oldLines.length - tail)
      .map((text) => ({ kind: '-' as const, text })),
    ...newLines
      .slice(head, newLines.length - tail)
      .map((text) => ({ kind: '+' as const, text })),
  ];
}

export function diffSummary(before: string, after: string): string {
  if (before.length === 0) return `new file, ${countLines(after)} lines`;
  if (before === after) return 'unchanged';
  const lines = diffLines(before, after);
  const removed = lines.filter((l) => l.kind === '-').length;
  const added = lines.filter((l) => l.kind === '+').length;
  return `+${added} −${removed}`;
}

function countLines(text: string): number {
  return text.split('\n').filter((_, index, all) => index < all.length - 1 || all[index] !== '')
    .length;
}
