/**
 * The full-screen frame a bare `personal-config` draws (bare-command-home D1, D4). Every function
 * here turns a state and a width into text and touches no terminal: the harness has no TTY, so
 * these strings are the only part of the screens a test can read. `@clack/core` prompts call
 * them from `render()` and redraw the result in place on every key.
 */

export type Tone = 'dark' | 'light' | 'plain';

type Pair = readonly [light: string, dark: string];

/** `wk`'s Bioluminescent set, defined once (D4), as light and dark hex pairs. */
const PALETTE = {
  green: ['#12a37a', '#54f0b0'],
  amber: ['#c98a12', '#ffc65c'],
  rose: ['#d64570', '#ff6f91'],
  slate: ['#8aa3a8', '#6d8a92'],
  blue: ['#2f7fd1', '#6ab8ff'],
  mist: ['#b6cccf', '#34525a'],
  hubFill: ['#0b3036', '#0b2b33'],
  ink: ['#8ff5e8', '#5ef2e0'],
  muted: ['#4d7a80', '#6fa5ad'],
  rule: ['#b6cccf', '#2a4a52'],
} as const satisfies Record<string, Pair>;

export type Color = keyof typeof PALETTE;
export type Paint = Record<Color, (text: string) => string> & {
  bold: (text: string) => string;
  brand: (text: string) => string;
};

/** 24, not `wk`'s 20: D3's longest label is 20 columns behind a 4-column mark (D5). */
export const RAIL_WIDTH = 24;
export const PANEL_MAX = 64;
export const PANEL_MIN = 36;
/** Below either, the frame drops the rail (D4, BD-10). */
export const MIN_COLUMNS = 80;
export const MIN_ROWS = 24;

export function painter(tone: Tone): Paint {
  const paint = Object.fromEntries(
    Object.entries(PALETTE).map(([name, pair]) => [name, colorer(tone, pair)]),
  ) as Record<Color, (text: string) => string>;
  const bold = tone === 'plain' ? (t: string) => t : (t: string) => `\x1b[1m${t}\x1b[22m`;
  return { ...paint, bold, brand: (t) => bold(paint.ink(t)) };
}

function colorer(tone: Tone, pair: Pair): (text: string) => string {
  if (tone === 'plain') return (text) => text;
  const [r, g, b] = rgb(tone === 'light' ? pair[0] : pair[1]);
  return (text) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * `wk` asks lipgloss, which asks the terminal for its background. Nothing here can, so the guess
 * is `COLORFGBG`'s background field (7 and 15 are the light ones), dark when it is unset because
 * most terminals are, and no color at all under `NO_COLOR` (https://no-color.org).
 */
export function toneFor(env: Record<string, string | undefined>): Tone {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 'plain';
  const background = env.COLORFGBG?.split(';').at(-1);
  return background === '7' || background === '15' ? 'light' : 'dark';
}

/**
 * Columns a line takes once its color codes are gone. Every glyph the frame draws (`⬢`, `│`,
 * `›`, the box corners) is one column wide, so a code-point count is exact for it; a person's
 * own text with wide characters may overrun by a column, and `fit` clips it.
 */
export function visibleWidth(text: string): number {
  return [...stripAnsi(text)].length;
}

export function stripAnsi(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the escape is the thing matched.
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

export function clip(text: string, width: number): string {
  const chars = [...text];
  if (width <= 0) return '';
  return chars.length <= width ? text : `${chars.slice(0, width - 1).join('')}…`;
}

/** A line that would overrun loses its color rather than the frame its shape. */
function fit(line: string, width: number): string {
  if (visibleWidth(line) <= width) return padEnd(line, width);
  return padEnd(clip(stripAnsi(line), width), width);
}

function padEnd(text: string, width: number): string {
  return text + ' '.repeat(Math.max(width - visibleWidth(text), 0));
}

/** Plain prose folded to a width, breaking at spaces and splitting a word longer than a line. */
export function wrap(text: string, width: number): string[] {
  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => pieces(word, width));
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last !== undefined && visibleWidth(`${last} ${word}`) <= width) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else lines.push(word);
  }
  return lines;
}

function pieces(word: string, width: number): string[] {
  const chars = [...word];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += width) out.push(chars.slice(i, i + width).join(''));
  return out;
}

/**
 * The size to draw at, from what the terminal reports, with 0 read as unknown. This alone does
 * not make a 0-column terminal usable: `@clack/core` still wraps at the reported 0. The bare
 * command does not draw the frame there at all (`interactive()` in `src/cli.ts`).
 */
export function sizeOf(columns?: number, rows?: number): { columns: number; rows: number } {
  return { columns: columns || 80, rows: rows || 24 };
}

export function showsRail(columns: number, rows: number): boolean {
  return columns >= MIN_COLUMNS && rows >= MIN_ROWS;
}

/** The panel's text width: its outer width less two border and four padding columns. */
export function panelInner(columns: number, withRail: boolean): number {
  const room = columns - 4 - (withRail ? RAIL_WIDTH + 2 : 0);
  return Math.max(Math.min(PANEL_MAX, room), PANEL_MIN) - 6;
}

export type View = 'setup' | 'home' | 'global' | 'profile';

/** Brand on the left, the working folder on the right, a rule under both. */
export function header(paint: Paint, view: View, where: string, columns: number): string[] {
  const left = `${paint.brand('⬢ personal-config')}${paint.muted(` · ${view}`)}`;
  const room = Math.max(columns - visibleWidth(left) - 4, 0);
  const right = paint.muted(clip(where, room));
  const gap = Math.max(columns - visibleWidth(left) - visibleWidth(right) - 2, 1);
  return [` ${left}${' '.repeat(gap)}${right}`, paint.rule('─'.repeat(columns))];
}

/**
 * The steps, each a filled hex once done, a lit hex while current and a hollow one after, joined
 * by a line that turns green behind the person. A failed current step is a red cross.
 */
export function rail(paint: Paint, steps: string[], current: number, failed = false): string[] {
  const lines = [''];
  steps.forEach((step, index) => {
    lines.push(
      padEnd(
        ` ${railMark(paint, index, current, failed)}  ${railLabel(paint, step, index, current, failed)}`,
        RAIL_WIDTH,
      ),
    );
    if (index < steps.length - 1) {
      const join = index < current ? paint.green : paint.rule;
      lines.push(padEnd(` ${join('│')}`, RAIL_WIDTH));
    }
  });
  return lines;
}

function railMark(paint: Paint, index: number, current: number, failed: boolean): string {
  if (index === current && failed) return paint.rose('✖');
  if (index < current) return paint.green('⬢');
  if (index === current) return paint.ink('⬢');
  return paint.rule('⬡');
}

function railLabel(
  paint: Paint,
  step: string,
  index: number,
  current: number,
  failed: boolean,
): string {
  const label = clip(step, RAIL_WIDTH - 4);
  if (index === current) return failed ? paint.rose(label) : paint.brand(label);
  return index < current ? paint.muted(label) : paint.rule(label);
}

/** A rounded box with one row and two columns of padding; `rows` keeps its height steady. */
export function panel(
  paint: Paint,
  body: string[],
  inner: number,
  edge: Color,
  rows = 0,
): string[] {
  const side = paint[edge]('│');
  const blank = `${side}${' '.repeat(inner + 4)}${side}`;
  const filled = [...body, ...Array<string>(Math.max(rows - body.length, 0)).fill('')];
  return [
    paint[edge](`╭${'─'.repeat(inner + 4)}╮`),
    blank,
    ...filled.map((line) => `${side}  ${fit(line, inner)}  ${side}`),
    blank,
    paint[edge](`╰${'─'.repeat(inner + 4)}╯`),
  ];
}

/** A step's title with its place in the run in the panel's top right. */
export function heading(
  paint: Paint,
  title: string,
  n: number,
  of: number,
  inner: number,
): string {
  const count = paint.muted(`step ${n} of ${of}`);
  const gap = Math.max(inner - visibleWidth(title) - visibleWidth(count), 1);
  return `${paint.bold(title)}${' '.repeat(gap)}${count}`;
}

export function choices(paint: Paint, items: string[], cursor: number): string[] {
  return items.map((item, index) =>
    index === cursor ? `${paint.ink('›')} ${paint.brand(item)}` : `  ${paint.muted(item)}`,
  );
}

export type Hint = readonly [key: string, does: string];

export function keyHints(paint: Paint, hints: readonly Hint[]): string {
  return hints
    .map(([key, does]) => `${paint.brand(key)}${paint.muted(` ${does}`)}`)
    .join(paint.rule('  ·  '));
}

export type FrameSpec = {
  view: View;
  where: string;
  columns: number;
  rows: number;
  body: string[];
  edge: Color;
  hints: readonly Hint[];
  steps?: { labels: string[]; current: number; failed?: boolean };
};

/** The whole screen: header, then the rail beside the panel (or the panel alone), then the keys. */
export function frame(paint: Paint, spec: FrameSpec): string {
  const withRail = spec.steps !== undefined && showsRail(spec.columns, spec.rows);
  const inner = panelInner(spec.columns, withRail);
  const railLines =
    withRail && spec.steps
      ? rail(paint, spec.steps.labels, spec.steps.current, spec.steps.failed)
      : [];
  // A little taller than the rail, so the box keeps its size from step to step.
  const box = panel(paint, spec.body, inner, spec.edge, Math.max(railLines.length - 3, 0));
  const block = withRail ? beside(railLines, box) : box;
  return [
    ...header(paint, spec.view, spec.where, spec.columns),
    '',
    ...center(block, spec.columns),
    '',
    ...center([keyHints(paint, spec.hints)], spec.columns),
  ].join('\n');
}

function beside(left: string[], right: string[]): string[] {
  const rows = Math.max(left.length, right.length);
  return Array.from(
    { length: rows },
    (_, i) => `${padEnd(left[i] ?? '', RAIL_WIDTH)}  ${right[i] ?? ''}`,
  );
}

/** Centers the block as one piece, so the rail and the panel keep their columns. */
function center(lines: string[], columns: number): string[] {
  const width = Math.max(...lines.map(visibleWidth));
  const left = Math.max(Math.floor((columns - width) / 2), 0);
  return lines.map((line) => (line === '' ? line : `${' '.repeat(left)}${line}`));
}

export type HomeView = {
  configPath: string;
  summary: ReadonlyArray<readonly [label: string, value: string]>;
  error: string | null;
  menu: string[];
  cursor: number;
};

const SUMMARY_LABEL = 16;

/** The home panel's text: the title, then the summary or the load error, then the menu. */
export function homeBody(paint: Paint, view: HomeView, inner: number): string[] {
  const top = [paint.bold('You are set up'), paint.muted(clip(view.configPath, inner)), ''];
  const middle =
    view.error === null
      ? summaryLines(paint, view, inner)
      : errorLines(paint, view.error, inner);
  return [...top, ...middle, '', ...choices(paint, view.menu, view.cursor)];
}

function summaryLines(paint: Paint, view: HomeView, inner: number): string[] {
  return view.summary.map(
    ([label, value]) =>
      `${paint.muted(padEnd(label, SUMMARY_LABEL))}${clip(value, inner - SUMMARY_LABEL)}`,
  );
}

/** A saved config that does not parse: said in red, and never rewritten (D2). */
export function errorLines(paint: Paint, message: string, inner: number): string[] {
  return [
    paint.bold(paint.rose('✖ Your saved answers do not load')),
    ...wrap(message, inner),
    '',
    ...wrap('Fix the file by hand. This screen never rewrites it.', inner).map(paint.muted),
  ];
}

export const HOME_HINTS: readonly Hint[] = [
  ['↑/↓', 'choose'],
  ['enter', 'select'],
  ['ctrl+c', 'quit'],
];

export function homeScreen(
  paint: Paint,
  view: HomeView,
  size: { columns: number; rows: number },
  where: string,
): string {
  const inner = panelInner(size.columns, false);
  return frame(paint, {
    view: 'home',
    where,
    ...size,
    body: homeBody(paint, view, inner),
    edge: view.error === null ? 'ink' : 'rose',
    hints: HOME_HINTS,
  });
}
