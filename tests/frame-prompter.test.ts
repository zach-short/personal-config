/**
 * The frame's prompters, driven through streams with key bytes (bare-command-home Phase 2). What
 * a person sees is asserted as text; that it redraws in place in a real terminal is the owner's
 * walk, because the harness has no TTY.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { BACK } from '../src/lib/ask.ts';
import { framePrompters } from '../src/lib/frame.ts';
import type { Question } from '../src/lib/types.ts';
import { say, setSink } from '../src/lib/ui.ts';
import { always, drive, inTurn, KEY } from './frame-driver.ts';
import { testScan } from './helpers.ts';

afterEach(() => setSink(null));

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'example',
    phase: 'you',
    kind: 'select',
    ask: 'How do you like it?',
    options: [
      { value: 'first', label: 'First', example: 'the first way' },
      { value: 'second', label: 'Second', example: 'the second way', recommended: true },
    ],
    readMore: 'no-such-long-form',
    configKey: 'example',
    ...overrides,
  };
}

describe('a select', () => {
  test('enter takes the default, and the screen is the step on the rail', async () => {
    const { io, screens } = drive(always(KEY.enter));
    const frame = framePrompters(io);
    expect(await frame.ask.ask(question(), 'second')).toBe('second');
    const screen = screens[0] ?? '';
    expect(screen).toContain('⬢ personal-config · setup');
    expect(screen).toContain('About you');
    expect(screen).toContain('step 1 of 8');
    expect(screen).toContain('How do you like it?');
    expect(screen).toContain('› Second  (recommended)');
    expect(screen).toContain('the second way');
    expect(screen).toContain('enter next');
  });

  test('down then enter takes the next option', async () => {
    const { io } = drive(always(`${KEY.down}${KEY.enter}`));
    expect(await framePrompters(io).ask.ask(question(), 'first')).toBe('second');
  });

  test('← back is offered only when the runner says so, and answers BACK', async () => {
    const without = drive(always(KEY.enter));
    await framePrompters(without.io).ask.ask(question(), 'first', false);
    expect(without.screens[0]).not.toContain('← back');

    // Up from the first option wraps to the last, which is `← back`.
    const { io, screens } = drive(always(`${KEY.up}${KEY.enter}`));
    expect(await framePrompters(io).ask.ask(question(), 'first', true)).toBe(BACK);
    expect(screens[0]).toContain('← back');
  });

  test('Read more… opens the long form and comes back to the same question', async () => {
    // Read more is the last option with no back: up from the first lands on it.
    const { io, screens } = drive(inTurn(`${KEY.up}${KEY.enter}`, KEY.enter, KEY.enter));
    expect(await framePrompters(io).ask.ask(question(), 'first')).toBe('first');
    expect(screens).toHaveLength(3);
    expect(screens[1]).toContain('More on: How do you like it?');
    expect(screens[1]).toContain('No long form written yet for "no-such-long-form".');
    expect(screens[1]).toContain('enter back to the question');
    expect(screens[2]).toContain('How do you like it?');
  });
});

describe('the other kinds', () => {
  const multi = question({ kind: 'multiselect' });

  test('a multiselect starts with its default ticked, so enter keeps it', async () => {
    const { io, screens } = drive(always(KEY.enter));
    expect(await framePrompters(io).ask.ask(multi, ['second'])).toEqual(['second']);
    expect(screens[0]).toContain('◻ First');
    expect(screens[0]).toContain('◼ Second');
    expect(screens[0]).toContain('space toggle');
  });

  test('space toggles the option under the cursor', async () => {
    const { io } = drive(always(`${KEY.space}${KEY.enter}`));
    expect(await framePrompters(io).ask.ask(multi, ['second'])).toEqual(['second', 'first']);
  });

  test('a text question keeps its default on enter and takes what is typed', async () => {
    const text = question({ kind: 'text', options: undefined, placeholder: 'a name' });
    const kept = drive(always(KEY.enter));
    expect(await framePrompters(kept.io).ask.ask(text, 'kept')).toBe('kept');

    const typed = drive(always(`typed${KEY.enter}`));
    expect(await framePrompters(typed.io).ask.ask(text, '')).toBe('typed');
    expect(typed.screens[0]).toContain('› a name');
  });

  test('a confirm takes y and n at once, as clack does', async () => {
    const yes = drive(always('y'));
    expect(await framePrompters(yes.io).ask.confirm('Pick up the run?', false)).toBe(true);
    const no = drive(always('n'));
    expect(await framePrompters(no.io).ask.confirm('Pick up the run?', true)).toBe(false);
  });
});

describe('the steps', () => {
  test('projects-dir is "Where your repos are", and the picker is "Pick repos"', async () => {
    const { io, screens } = drive(always(KEY.enter));
    const frame = framePrompters(io);
    await frame.ask.ask(
      question({ id: 'projects-dir', phase: 'discover', kind: 'text' }),
      '~/x',
    );
    await frame.ask.pick([testScan()]);
    expect(screens[0]).toContain('step 2 of 8');
    expect(screens[0]).toContain('Where your repos are');
    expect(screens[1]).toContain('step 3 of 8');
    expect(screens[1]).toContain('Which repos should be set up?');
  });

  test('the picker starts empty; a ticks every repo', async () => {
    const scans = [testScan({ path: '/a', name: 'a' }), testScan({ path: '/b', name: 'b' })];
    const none = drive(always(KEY.enter));
    expect(await framePrompters(none.io).ask.pick(scans)).toEqual([]);
    const all = drive(always(`a${KEY.enter}`));
    expect(await framePrompters(all.io).ask.pick(scans)).toEqual(scans);
  });

  test('each repo is named, and counted when its first question comes round again', async () => {
    const scans = [
      testScan({ path: '/a', name: 'alpha' }),
      testScan({ path: '/b', name: 'beta' }),
    ];
    const { io, screens } = drive(always(`a${KEY.enter}`));
    const frame = framePrompters(io);
    await frame.ask.pick(scans);
    const first = question({ id: 'per-repo', phase: 'discover' });
    const second = question({ id: 'per-repo-2', phase: 'discover' });
    await frame.ask.ask(first, 'first');
    await frame.ask.ask(second, 'first');
    await frame.ask.ask(first, 'first');
    expect(screens[1]).toContain('Each repo · alpha');
    expect(screens[1]).toContain('Each repo (1 of 2)');
    expect(screens[2]).toContain('Each repo · alpha');
    expect(screens[3]).toContain('Each repo · beta');
    expect(screens[3]).toContain('Each repo (2 of 2)');
  });

  test('a first question reached by ← back is the same repo, not the next', async () => {
    const scans = [
      testScan({ path: '/a', name: 'alpha' }),
      testScan({ path: '/b', name: 'beta' }),
    ];
    const { io, screens } = drive(inTurn(`a${KEY.enter}`, KEY.enter, `${KEY.up}${KEY.enter}`));
    const frame = framePrompters(io);
    await frame.ask.pick(scans);
    const first = question({ id: 'per-repo', phase: 'discover' });
    await frame.ask.ask(first, 'first');
    expect(
      await frame.ask.ask(question({ id: 'next', phase: 'discover' }), 'first', true),
    ).toBe(BACK);
    await frame.ask.ask(first, 'first');
    expect(screens[3]).toContain('Each repo · alpha');
  });
});

describe('the run', () => {
  test('what setup says goes into the next panel, and the console gets it back after', async () => {
    const { io, screens } = drive(always(KEY.enter));
    const frame = framePrompters(io);
    await frame.run(async () => {
      say('  alpha: a folder, not a repo — nothing to track or exclude.');
      await frame.ask.ask(question(), 'first');
      return 0;
    });
    expect(screens[0]).toContain('alpha: a folder, not a repo');
    const lines: string[] = [];
    setSink((line) => lines.push(line));
    say('after');
    expect(lines).toEqual(['after']);
  });

  test('the review shows the preview, the write step follows the second yes, then done', async () => {
    const { io, screens, written } = drive(always(KEY.enter));
    const frame = framePrompters(io);
    const code = await frame.run(async () => {
      say('\nThis run would write:\n');
      say('~/.claude\n  CLAUDE.md  — global rules  [new]');
      expect(await frame.confirm.confirm('Show the per-file diff first?', false)).toBe(false);
      expect(await frame.confirm.confirm('Write these 1 file(s)?', true)).toBe(true);
      say('\nWrote 1 file(s).');
      return 0;
    });
    expect(code).toBe(0);
    expect(screens[0]).toContain('step 6 of 8');
    expect(screens[0]).toContain('This run would write:');
    expect(screens[0]).toContain('CLAUDE.md  — global rules  [new]');
    expect(screens[0]).toContain('› No');
    expect(screens[1]).toContain('This run would write:');
    expect(screens[1]).toContain('› Yes');
    const after = written();
    expect(after).toContain('step 7 of 8');
    expect(after).toContain('Setup is done');
    expect(after).toContain('Wrote 1 file(s).');
    expect(after).toContain('personal-config undo');
  });

  test('a declined review ends on what setup said, with no done screen', async () => {
    const { io, written } = drive(always('n'));
    const frame = framePrompters(io);
    await frame.run(async () => {
      say('This run would write:');
      await frame.confirm.confirm('Show the per-file diff first?', false);
      await frame.confirm.confirm('Write these 1 file(s)?', true);
      say('Nothing was written.');
      return 0;
    });
    expect(written()).toContain('Nothing was written.');
    expect(written()).not.toContain('Setup is done');
  });

  test('the sink is put back when setup throws', async () => {
    const { io } = drive(always(KEY.enter));
    const frame = framePrompters(io);
    await expect(
      frame.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const lines: string[] = [];
    setSink((line) => lines.push(line));
    say('after');
    expect(lines).toEqual(['after']);
  });

  test('every line of a screen fits 80 columns', async () => {
    const { io, screens } = drive(always(KEY.enter), { columns: 80, rows: 24 });
    const frame = framePrompters(io);
    await frame.run(async () => {
      say('x'.repeat(200));
      await frame.ask.ask(question({ ask: 'word '.repeat(40) }), 'first');
      return 0;
    });
    for (const line of (screens[0] ?? '').split('\n')) {
      expect([...line].length).toBeLessThanOrEqual(80);
    }
    expect((screens[0] ?? '').split('\n').length).toBeLessThanOrEqual(24);
  });
});
