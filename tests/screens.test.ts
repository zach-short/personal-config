import { describe, expect, test } from 'bun:test';
import {
  frame,
  type HomeView,
  heading,
  homeScreen,
  painter,
  panelInner,
  RAIL_WIDTH,
  rail,
  sizeOf,
  stripAnsi,
  toneFor,
  visibleWidth,
  wrap,
} from '../src/lib/screens.ts';

const STEPS = [
  'About you',
  'Where your repos are',
  'Pick repos',
  'Each repo',
  'Practices',
  'Review',
  'Write',
  'Done',
];

const plain = painter('plain');
const dark = painter('dark');

function home(overrides: Partial<HomeView> = {}): HomeView {
  return {
    configPath: '~/.config/personal-config/config.json',
    summary: [
      ['Saved answers', '31'],
      ['Models', 'claude-fable-5-1, claude-opus-5-5'],
    ],
    error: null,
    menu: ['Check this folder', 'Run setup again', 'Quit'],
    cursor: 0,
    ...overrides,
  };
}

function setupFrame(columns: number, rows: number, paint = plain): string {
  const inner = panelInner(columns, true);
  return frame(paint, {
    view: 'setup',
    where: '~/Projects/demo',
    columns,
    rows,
    edge: 'ink',
    hints: [['enter', 'next']],
    steps: { labels: STEPS, current: 2 },
    body: [heading(paint, 'Pick repos', 3, 7, inner)],
  });
}

describe('rail', () => {
  test('marks done steps filled, the current one lit and later ones hollow', () => {
    const marks = rail(plain, STEPS, 2)
      .filter((line) => /[⬢⬡✖]/.test(line))
      .map((line) => line.trim().slice(0, 1));
    expect(marks).toEqual(['⬢', '⬢', '⬢', '⬡', '⬡', '⬡', '⬡', '⬡']);
  });

  test('shows every plain label whole (D5)', () => {
    const text = rail(plain, STEPS, 0).join('\n');
    for (const label of STEPS) expect(text).toContain(label);
  });

  test('a failed current step is a cross', () => {
    const lines = rail(plain, STEPS, 6, true);
    expect(lines.find((line) => line.includes('Write'))).toContain('✖');
  });
});

describe('frame', () => {
  test('puts the step counter in the panel corner', () => {
    expect(setupFrame(80, 24)).toMatch(/Pick repos\s+step 3 of 7/);
  });

  test('fits 80 columns with color on, and the rail beside the panel', () => {
    const text = setupFrame(80, 24, dark);
    for (const line of text.split('\n')) expect(visibleWidth(line)).toBeLessThanOrEqual(80);
    expect(stripAnsi(text)).toContain('About you');
  });

  test('centers itself on a wider terminal', () => {
    const lines = setupFrame(120, 30).split('\n');
    // The block is the rail, two columns, then the panel; its left edge is the rail's.
    const box = lines.find((line) => line.includes('╭')) ?? '';
    const left = box.indexOf('╭') - RAIL_WIDTH - 2;
    const right = 120 - visibleWidth(box);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  test('drops the rail below 24 rows (BD-10)', () => {
    expect(setupFrame(80, 20)).not.toContain('About you');
  });
});

describe('home screen', () => {
  test('shows the summary and points at the chosen entry', () => {
    const text = homeScreen(plain, home({ cursor: 1 }), { columns: 80, rows: 24 }, '~/x');
    expect(text).toContain('You are set up');
    expect(text).toContain('Saved answers');
    expect(text).toContain('› Run setup again');
    expect(text).toContain('⬢ personal-config · home');
  });

  test('a config that does not load shows the error panel and no summary', () => {
    const text = homeScreen(
      plain,
      home({ error: 'Unexpected token } in JSON at position 3', menu: ['Quit'] }),
      { columns: 80, rows: 24 },
      '~/x',
    );
    expect(text).toContain('✖ Your saved answers do not load');
    expect(text).toContain('Unexpected token');
    expect(text).toContain('This screen never rewrites it.');
    expect(text).not.toContain('Saved answers');
  });

  test('every line fits 80 columns', () => {
    const text = homeScreen(
      dark,
      home(),
      { columns: 80, rows: 24 },
      '~/a/very/long/path'.repeat(9),
    );
    for (const line of text.split('\n')) expect(visibleWidth(line)).toBeLessThanOrEqual(80);
  });
});

describe('helpers', () => {
  test('wrap breaks at spaces and splits a word longer than the line', () => {
    expect(wrap('one two three', 7)).toEqual(['one two', 'three']);
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  test('sizeOf treats a reported 0 as unknown', () => {
    expect(sizeOf(0, 0)).toEqual({ columns: 80, rows: 24 });
    expect(sizeOf(undefined, undefined)).toEqual({ columns: 80, rows: 24 });
    expect(sizeOf(120, 40)).toEqual({ columns: 120, rows: 40 });
  });

  test('toneFor reads NO_COLOR and COLORFGBG', () => {
    expect(toneFor({ NO_COLOR: '1' })).toBe('plain');
    expect(toneFor({ COLORFGBG: '0;15' })).toBe('light');
    expect(toneFor({ COLORFGBG: '15;0' })).toBe('dark');
    expect(toneFor({})).toBe('dark');
  });
});
