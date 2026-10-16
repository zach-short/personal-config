/**
 * `say()` writes to a sink the frame can swap (bare-command-home BD-4). Every command but the bare
 * one keeps the default, so the default must print exactly what `console.log` printed before.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { note, say, setSink } from '../src/lib/ui.ts';

afterEach(() => setSink(null));

describe('the default sink', () => {
  test('hands console.log each line exactly as given', () => {
    const log = spyOn(console, 'log').mockImplementation(() => {});
    try {
      say('one line');
      say('two\nlines');
      say();
      expect(log.mock.calls).toEqual([['one line'], ['two\nlines'], ['']]);
    } finally {
      log.mockRestore();
    }
  });
});

describe('a sink that is set', () => {
  test('takes every line and console.log sees none', () => {
    const lines: string[] = [];
    const log = spyOn(console, 'log').mockImplementation(() => {});
    try {
      setSink((line) => lines.push(line));
      say('to the frame');
      say();
      expect(lines).toEqual(['to the frame', '']);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  test('takes a note as its title, then its body', () => {
    const lines: string[] = [];
    setSink((line) => lines.push(line));
    note('--- a/file\n+ added', '~/repo/file');
    expect(lines).toEqual(['~/repo/file', '--- a/file\n+ added']);
  });

  test('setSink(null) puts console.log back', () => {
    const log = spyOn(console, 'log').mockImplementation(() => {});
    try {
      setSink(() => {});
      setSink(null);
      say('back on the console');
      expect(log.mock.calls).toEqual([['back on the console']]);
    } finally {
      log.mockRestore();
    }
  });
});
