/**
 * One line added to an archive's `INDEX.md`, under its Closed section.
 *
 * Shared because two commands write into the same file and §8.2 is unforgiving about it: an
 * index line pointing at something that is not there is worse than no line at all. Two copies
 * of this insert would drift in exactly the way that produces one — `archive` filing under a
 * heading `fold` appends past the end of.
 */
export function withIndexLine(text: string, entry: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => /^##\s+closed\b/i.test(line));
  if (start === -1) return `${text.replace(/\n+$/, '')}\n\n${entry}\n`;

  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => /^##\s/.test(line));
  const end = next === -1 ? lines.length : start + 1 + next;
  const head = lines.slice(0, end);
  while (head.length > start + 1 && (head.at(-1) ?? '').trim() === '') head.pop();
  return `${[...head, entry, ...lines.slice(end)].join('\n').replace(/\n+$/, '')}\n`;
}
