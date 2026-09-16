import { join } from 'node:path';
import { diffAgainstHead } from '../../lib/git.ts';
import type { Finding } from '../../lib/types.ts';
import { type Doc, proseLines } from '../scan.ts';

/** `## Settled`, `### Settled: tokens`, `## Settled — pricing`: the marker is the first word. */
const SETTLED = /^(#{2,6})\s+Settled\b/i;

const HEADING = /^#{1,6}\s/;

/** Stated, dated and naming what it replaces — the word is what makes it findable later. */
const SUPERSESSION = /supersed/i;

/**
 * R8 — never re-litigate a settled decision. Every other rule reads a file; this one reads a
 * diff, because a quiet reversal is invisible in the file it lands in. `git diff HEAD` is the
 * window: staged and unstaged work against the last commit, which is the change about to be
 * handed back. A clean tree, a directory that is not a repository, and a repository with no
 * commit yet all produce nothing, which is the right answer for each.
 *
 * Only a hunk that *removes* a line counts. Adding an entry under Settled is recording a
 * decision, not reopening one, and a rule that flagged it would punish the behaviour it exists
 * to protect.
 *
 * **It cannot see an untracked ledger, by construction.** Under the untracked work profile the
 * ledger is never committed, so no diff of it exists to read — and a machine may ignore it
 * globally besides, as this author's `~/.config/git/ignore` does. R8 stays a reader's rule
 * there; this is the tracked half of it, not the whole.
 */
export async function settledSupersession(root: string, docs: Doc[]): Promise<Finding[]> {
  const diff = await diffAgainstHead(root);
  if (!diff) return [];

  return parseDiff(diff)
    .filter((file) => !file.supersedes)
    .flatMap((file) => {
      const doc = docs.find((candidate) => candidate.path === join(root, file.path));
      return doc && !doc.isTemplate && doc.kind !== 'other' ? findingsIn(doc, file.hunks) : [];
    });
}

function findingsIn(doc: Doc, hunks: Hunk[]): Finding[] {
  const ranges = settledRanges(doc);
  if (ranges.length === 0) return [];

  return hunks
    .filter((hunk) => hunk.removes)
    .map((hunk) => Math.max(hunk.newStart, 1))
    .filter((line) => ranges.some(([start, end]) => line >= start && line <= end))
    .map((line) => ({
      rule: 'settled-supersession',
      standardId: 'R8',
      file: doc.path,
      line,
      message:
        'a Settled entry changed with no supersession in this file — R8 asks for a dated supersession naming what it replaces',
      fixable: false,
    }));
}

/**
 * The section a heading owns: from the heading itself to the line before the next heading of
 * the same level or higher. The heading line is inside the range on purpose — a hunk that
 * deletes the first entry reports the line above it, which is the heading.
 */
function settledRanges(doc: Doc): Array<[number, number]> {
  const headings = proseLines(doc).filter(({ text }) => HEADING.test(text));

  return headings.flatMap(({ text, line }, index) => {
    const level = text.match(SETTLED)?.[1]?.length;
    if (level === undefined) return [];
    const next = headings.slice(index + 1).find((after) => headingLevel(after.text) <= level);
    return [[line, next ? next.line - 1 : doc.lines.length] as [number, number]];
  });
}

function headingLevel(text: string): number {
  return text.match(/^#{1,6}/)?.[0].length ?? 0;
}

type Hunk = { newStart: number; removes: boolean };
type FileDiff = { path: string; hunks: Hunk[]; supersedes: boolean };

/**
 * `--- ` and `+++ ` are headers only before the first `@@` of a file: inside a hunk, a removed
 * `---` horizontal rule is `----` and a removed `-- ` is `--- `, and these docs are full of
 * rules. `inHunk` is what tells the two apart; a prefix test alone cannot.
 */
function parseDiff(text: string): FileDiff[] {
  const reader: Reader = { files: [], file: null, inHunk: false };
  for (const line of text.split('\n')) read(reader, line);
  return reader.files;
}

type Reader = { files: FileDiff[]; file: FileDiff | null; inHunk: boolean };

function read(reader: Reader, line: string): void {
  if (line.startsWith('diff --git ')) {
    reader.file = null;
    reader.inHunk = false;
  } else if (!reader.inHunk && line.startsWith('+++ ')) {
    reader.file = openFile(line);
    if (reader.file) reader.files.push(reader.file);
  } else if (reader.file && line.startsWith('@@')) {
    reader.inHunk = true;
    openHunk(reader.file, line);
  } else if (reader.file && reader.inHunk) {
    record(reader.file, line);
  }
}

/** `/dev/null` is a deletion: the file is gone, so there is no Settled section left to guard. */
function openFile(header: string): FileDiff | null {
  const path = header.slice(4).trim();
  return path === '/dev/null'
    ? null
    : { path: path.replace(/^b\//, ''), hunks: [], supersedes: false };
}

function openHunk(file: FileDiff, header: string): void {
  const start = header.match(/^@@ -\d+(?:,\d+)? \+(\d+)/)?.[1];
  if (start !== undefined) file.hunks.push({ newStart: Number(start), removes: false });
}

function record(file: FileDiff, line: string): void {
  if (line.startsWith('-')) {
    const hunk = file.hunks.at(-1);
    if (hunk) hunk.removes = true;
  } else if (line.startsWith('+') && SUPERSESSION.test(line)) {
    file.supersedes = true;
  }
}
