/**
 * Standard §0.2 for the code standard: a repo that already keeps one under another name keeps
 * that name. Found 2026-09-29 — `setup` wrote `docs/conventions-typescript.md` beside this repo's
 * own `docs/conventions-ts.md`, leaving two TypeScript standards.
 */
import { describe, expect, test } from 'bun:test';
import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import { detectConventionsDocs } from '../src/lib/conventions-docs.ts';
import { scanRepo } from '../src/lib/discover.ts';
import type { PlannedFile } from '../src/lib/types.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  clearSavedAnswers,
  DEFAULT_ANSWERS,
  tempDir,
  testContext,
  testRepoPlan,
} from './helpers.ts';

const HAND_WRITTEN = '# TypeScript conventions — mine\n\nF1. Files are kebab-case.\n';

async function inRepo<T>(files: Record<string, string>, run: (dir: string) => Promise<T>) {
  const dir = await tempDir();
  try {
    for (const [path, contents] of Object.entries(files)) {
      await Bun.write(join(dir, path), contents);
    }
    return await run(dir);
  } finally {
    await cleanup(dir);
    await clearSavedAnswers();
  }
}

async function planFor(dir: string): Promise<PlannedFile[]> {
  const repo = testRepoPlan({ scan: await scanRepo(dir) });
  return renderAll(testContext(DEFAULT_ANSWERS, repo));
}

function relative(dir: string, files: PlannedFile[]): string[] {
  return files.map((f) => f.path.slice(dir.length + 1));
}

function router(files: PlannedFile[]): string {
  return files.find((f) => f.path.endsWith('CLAUDE.md'))?.contents ?? '';
}

describe('an adopted code standard', () => {
  test('an existing conventions-ts.md is targeted, not duplicated', async () => {
    await inRepo(
      { 'package.json': '{}\n', 'docs/conventions-ts.md': HAND_WRITTEN },
      async (dir) => {
        const files = await planFor(dir);
        const paths = relative(dir, files);
        expect(paths).toContain('docs/conventions-ts.md');
        expect(paths).not.toContain('docs/conventions-typescript.md');
        expect(router(files)).toContain('`docs/conventions-ts.md`');
        expect(router(files)).not.toContain('conventions-typescript.md');

        // Unstamped, so the stamp guard leaves it as the person wrote it.
        await commitPlan(await resolvePlan(files));
        expect(await Bun.file(join(dir, 'docs/conventions-ts.md')).text()).toBe(HAND_WRITTEN);
        expect(await Bun.file(join(dir, 'docs/conventions-typescript.md')).exists()).toBe(
          false,
        );
      },
    );
  });

  test('passes: a repo with no code standard gets the default name', async () => {
    await inRepo({ 'package.json': '{}\n' }, async (dir) => {
      const files = await planFor(dir);
      expect(relative(dir, files)).toContain('docs/conventions-typescript.md');
      expect(router(files)).toContain('`docs/conventions-typescript.md`');
    });
  });

  test('a stamped file under the adopted name is updated in place', async () => {
    await inRepo({ 'package.json': '{}\n' }, async (dir) => {
      // A file this tool wrote and stamped, since renamed by the person and then edited.
      await commitPlan(await resolvePlan(await planFor(dir)));
      const generated = await Bun.file(join(dir, 'docs/conventions-typescript.md')).text();
      await rename(
        join(dir, 'docs/conventions-typescript.md'),
        join(dir, 'docs/conventions-ts.md'),
      );
      await Bun.write(join(dir, 'docs/conventions-ts.md'), `${generated}\nedited\n`);

      await commitPlan(await resolvePlan(await planFor(dir)));
      expect(await Bun.file(join(dir, 'docs/conventions-ts.md')).text()).toBe(generated);
      expect(await Bun.file(join(dir, 'docs/conventions-typescript.md')).exists()).toBe(false);
    });
  });
});

describe('mapping conventions files to languages', () => {
  test('aliases map to the language id the scanner reports', async () => {
    const docs = await inRepo(
      {
        'docs/conventions-ts.md': 'x\n',
        'docs/conventions-py.md': 'x\n',
        'docs/conventions-golang.md': 'x\n',
        'docs/conventions-notes.md': 'x\n',
      },
      detectConventionsDocs,
    );
    expect(docs).toEqual({
      typescript: 'docs/conventions-ts.md',
      python: 'docs/conventions-py.md',
      go: 'docs/conventions-golang.md',
    });
  });

  test('two languages are two standards, not a duplicate', async () => {
    const docs = await inRepo(
      { 'docs/conventions-go.md': 'x\n', 'docs/conventions-typescript.md': 'x\n' },
      detectConventionsDocs,
    );
    expect(docs).toEqual({
      go: 'docs/conventions-go.md',
      typescript: 'docs/conventions-typescript.md',
    });
  });

  test('a hand-picked name outranks the default, and the default outranks js', async () => {
    const both = await inRepo(
      {
        'docs/conventions-js.md': 'x\n',
        'docs/conventions-ts.md': 'x\n',
        'docs/conventions-typescript.md': 'x\n',
      },
      detectConventionsDocs,
    );
    expect(both).toEqual({ typescript: 'docs/conventions-ts.md' });

    const jsOnly = await inRepo({ 'docs/conventions-js.md': 'x\n' }, detectConventionsDocs);
    expect(jsOnly).toEqual({ typescript: 'docs/conventions-js.md' });
  });

  test('a repo with no docs directory adopts nothing', async () => {
    expect(await inRepo({ 'README.md': '# x\n' }, detectConventionsDocs)).toEqual({});
  });
});
