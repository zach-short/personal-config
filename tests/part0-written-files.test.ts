/**
 * The Part 0 prompt's "Already written, do not recreate" list. From `8947613` (2026-09-15) until
 * board row 70 (2026-09-23) `renderPart0` filled `{{WRITTEN_FILES}}` with the literal
 * `(filled at write time)` and nothing filled it later, so every prompt the tool wrote told the
 * adapting session nothing about which files already existed. No gate saw it: `fill()` only
 * leaves *unknown* tokens behind, and this one was known and filled with a placeholder sentence.
 */
import { describe, expect, test } from 'bun:test';
import { join, relative } from 'node:path';
import type { PlannedFile } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import { DEFAULT_ANSWERS, testContext, testRepoPlan } from './helpers.ts';

const ROOT = '/tmp/example';

async function render(): Promise<PlannedFile[]> {
  return renderAll(testContext(DEFAULT_ANSWERS, testRepoPlan()));
}

function part0(files: PlannedFile[]): string {
  const file = files.find((f) => f.path === join(ROOT, 'PART0-PROMPT.md'));
  if (!file) throw new Error('no PART0-PROMPT.md planned');
  return file.contents;
}

/** The fenced block under the heading, one entry per line. */
function listed(prompt: string): string[] {
  const section = prompt.split('## Already written, do not recreate\n\n')[1] ?? '';
  const fence = section.match(/^```\n([\s\S]*?)\n```/);
  return fence?.[1]?.split('\n') ?? [];
}

describe('the Part 0 prompt lists the files this run writes into the repo', () => {
  test('violates: no placeholder sentence or token survives under the heading', async () => {
    const prompt = part0(await render());
    expect(prompt).not.toContain('(filled at write time)');
    expect(prompt).not.toContain('{{WRITTEN_FILES}}');
    expect(listed(prompt).length).toBeGreaterThan(0);
  });

  test('passes: the list is exactly the repo-rooted, non-append files of the same plan', async () => {
    const files = await render();
    const expected = files
      .filter((f) => f.path.startsWith(`${ROOT}/`) && f.strategy !== 'append-lines')
      .filter((f) => !f.path.endsWith('PART0-PROMPT.md'))
      .map((f) => relative(ROOT, f.path));
    const paths = listed(part0(files)).map((line) => line.split(/\s+/)[0]);

    expect(paths).toEqual(expected);
    expect(paths).toContain('CLAUDE.md');
    expect(paths).toContain('.personal-config.json');
  });

  test('passes: ~/.claude files, the prompt itself and ignore-file appends are left out', async () => {
    const lines = listed(part0(await render()));
    expect(lines.some((line) => line.includes('.claude/'))).toBe(false);
    expect(lines.some((line) => line.startsWith('PART0-PROMPT.md'))).toBe(false);
    // Tracked mode appends to `.gitignore`, which this run did not write.
    expect(lines.some((line) => line.startsWith('.gitignore'))).toBe(false);
  });

  test('passes: each line is the path padded to one column, then the preview label', async () => {
    const files = await render();
    const lines = listed(part0(files));
    const width = Math.max(...lines.map((line) => line.split(' ')[0]?.length ?? 0));
    for (const line of lines) {
      const path = line.slice(0, width).trimEnd();
      const label = files.find((f) => f.path === join(ROOT, path))?.label;
      expect(line).toBe(`${path.padEnd(width)} ${label}`);
    }
  });

  test('passes: two renders of the same inputs produce the same prompt', async () => {
    expect(part0(await render())).toBe(part0(await render()));
  });
});
