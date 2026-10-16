/**
 * Drives the frame through streams, as a person at a terminal would (bare-command-home PLAN.md
 * F7). A key sent before a prompt is listening is lost, because `@clack/core` reads keys only
 * while a prompt is open; so each screen's keys are sent once that screen is drawn, and a prompt
 * is drawn first right after it hides the cursor.
 */
import { PassThrough, Writable } from 'node:stream';
import type { FrameIo } from '../src/lib/frame.ts';
import { painter, stripAnsi } from '../src/lib/screens.ts';

export const KEY = {
  enter: '\r',
  up: '\x1b[A',
  down: '\x1b[B',
  left: '\x1b[D',
  right: '\x1b[C',
  space: ' ',
} as const;

/** The keys for one screen, given its text; `null` sends nothing. */
export type Respond = (screen: string) => string | null;

export type Driven = {
  io: FrameIo;
  /** Each prompt's first screen, color stripped, in the order drawn. */
  screens: string[];
  /** Everything written, color stripped: the screens that wait for no key are in here too. */
  written: () => string;
};

export function drive(respond: Respond, size = { columns: 100, rows: 40 }): Driven {
  const input = new PassThrough();
  const screens: string[] = [];
  let all = '';
  let fresh = false;
  const output = new Writable({
    write(chunk, _encoding, done) {
      const text = String(chunk);
      all += text;
      if (text.includes('\x1b[?25l')) fresh = true;
      else if (fresh) {
        fresh = false;
        const screen = stripAnsi(text);
        screens.push(screen);
        const keys = respond(screen);
        if (keys !== null) setImmediate(() => input.write(keys));
      }
      done();
    },
  });
  return {
    io: { input, output, size: () => size, where: '~/work', paint: painter('plain') },
    screens,
    written: () => stripAnsi(all),
  };
}

/** Answers every screen with the same keys. */
export function always(keys: string): Respond {
  return () => keys;
}

/** Answers each screen with the next keys in turn, then enter. */
export function inTurn(...keys: string[]): Respond {
  const queue = [...keys];
  return () => queue.shift() ?? KEY.enter;
}
