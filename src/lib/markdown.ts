/**
 * The two structural reads of a markdown file that more than one caller needs: which lines are
 * prose rather than code, and where one numbered item's section starts and ends.
 *
 * They live here rather than in each caller because a `doctor` rule and a command have to agree
 * about which line is which. A rule that skips a fenced block while a command does not is a rule
 * citing a `file:line` the command cannot find.
 */

export type Line = { text: string; line: number };

/** 1-based, numbered by position in the original file, so a finding can cite `file:line`. */
export function eachLine(markdown: string): Line[] {
  return markdown.split('\n').map((text, index) => ({ text, line: index + 1 }));
}

/** Lines inside fenced blocks are code, and most rules — and both parsers — are about prose. */
export function proseLines(markdown: string): Line[] {
  let fenced = false;
  return eachLine(markdown).filter(({ text }) => {
    if (text.trimStart().startsWith('```')) {
      fenced = !fenced;
      return false;
    }
    return !fenced;
  });
}

export type Section = {
  heading: string;
  /** 1-based line of the heading itself, so `start + 1` is the first line of the body. */
  start: number;
  /** 1-based line of the last body line. */
  end: number;
  body: string;
};

/**
 * One numbered item's own section: `### 5. Title` down to the next heading of any level.
 *
 * `[.):]` because a board is written by hand and `5.`, `5)` and `5:` are all in use. Headings
 * inside fenced blocks are deliberately not skipped — a prompt quoting a heading in a fence is
 * rarer than a prompt carrying `#### SCOPE` outside one, and this is the search §2.1's "dated
 * paragraph under the board" already used before it moved here.
 */
export function numberedSection(markdown: string, number: string): Section | null {
  const lines = markdown.split('\n');
  const heading = new RegExp(`^#{2,4}\\s*${escaped(number.trim())}[.):]`);
  const start = lines.findIndex((text) => heading.test(text));
  if (start === -1) return null;

  const after = lines.slice(start + 1);
  const next = after.findIndex((text) => /^#{1,4}\s/.test(text));
  const body = next === -1 ? after : after.slice(0, next);
  return {
    heading: lines[start] ?? '',
    start: start + 1,
    end: start + body.length + 1,
    body: body.join('\n'),
  };
}

/** An item number is a cell someone typed, not a pattern: `1.5` must not compile to one. */
export function escaped(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One heading's *whole* block: the heading line down to the next heading at the same or a
 * higher level, and nothing shallower in between ends it.
 *
 * This is the difference between reading an item and lifting one out. `numberedSection` stops
 * at the next heading of any level, which is right for a reader — `passoff next` wants the
 * prompt, not the `#### SCOPE` filed under it. It is wrong for a fold: board item 5 carries
 * `#### SCOPE — written 2026-09-15` inside its section (`PASSOFF.md:493`, the one nested
 * heading on that board), and a fold built on `numberedSection` would cut the prompt out from
 * above it and leave the scope stranded under the next item's heading.
 */
export function headingBlock(markdown: string, number: string): Section | null {
  const lines = markdown.split('\n');
  const opener = new RegExp(`^(#{2,4})\\s*${escaped(number.trim())}[.):]`);
  const start = lines.findIndex((text) => opener.test(text));
  if (start === -1) return null;

  const level = (lines[start]?.match(/^#+/)?.[0] ?? '###').length;
  const after = lines.slice(start + 1);
  const next = after.findIndex((text) => isHeadingAtOrAbove(text, level));
  const body = next === -1 ? after : after.slice(0, next);
  return {
    heading: lines[start] ?? '',
    start: start + 1,
    end: start + body.length + 1,
    body: body.join('\n'),
  };
}

function isHeadingAtOrAbove(text: string, level: number): boolean {
  const hashes = text.match(/^(#{1,6})\s/)?.[1];
  return hashes !== undefined && hashes.length <= level;
}
