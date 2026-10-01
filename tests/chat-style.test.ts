/**
 * write-doc-ste Phase 1: the `chat-style` question and `~/.claude/rules/language-style.md`.
 *
 * Three promises from `docs/incomplete/write-doc-ste/DESIGN.md`. D2: every track and both weights
 * are asked, and `ste` writes the rule while `none` writes nothing. D4: an absent answer reads
 * `ste` in the wizard's default *and* in the renderer's own fallback, because `doctor` renders
 * from saved answers without the wizard (`src/doctor/rerender.ts`). D3 and BD-3: the rule carries
 * the irony and litotes line and names no style file.
 *
 * Every negative case is rendered with the answers that would otherwise produce the file, so a
 * renderer that wrote it unconditionally fails here rather than passing on what is present.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { catalogPath } from '../src/lib/catalog.ts';
import { claudeRulesDir } from '../src/lib/paths.ts';
import { readStamp } from '../src/lib/stamp.ts';
import { storedProfileDefault } from '../src/lib/stored-profile-defaults.ts';
import type { Answers, Catalog, PlannedFile, Question } from '../src/lib/types.ts';
import { matchesWhen } from '../src/lib/when.ts';
import { defaultFor } from '../src/phases/run.ts';
import { ALL_QUESTIONS } from '../src/questions/index.ts';
import { renderAll } from '../src/render/index.ts';
import { DEFAULT_ANSWERS, testConfig, testContext } from './helpers.ts';

const SHAPES: Record<string, Answers> = {
  'code + full': { workKind: 'code', configWeight: 'full', usesGit: 'yes' },
  'code + light': { workKind: 'code', configWeight: 'light', usesGit: 'yes' },
  'non-code + full': { workKind: 'non-code', configWeight: 'full', usesGit: 'yes' },
  'non-code + light': { workKind: 'non-code', configWeight: 'light', usesGit: 'no' },
};

const RULE = join(claudeRulesDir(), 'language-style.md');

function question(): Question {
  const found = ALL_QUESTIONS.find((q) => q.id === 'chat-style');
  if (!found) throw new Error('chat-style is not in the question set');
  return found;
}

async function rule(answers: Answers): Promise<PlannedFile | undefined> {
  const files = await renderAll(testContext({ ...DEFAULT_ANSWERS, ...answers }));
  return files.find((f) => f.path === RULE);
}

/** The rule's text with its line wrapping undone, so an assertion does not pin where it wraps. */
function flat(file: PlannedFile | undefined): string {
  return (file?.contents ?? '').replace(/\s+/g, ' ');
}

describe('D2: asked of everyone, after output-style', () => {
  test('it has no condition, so all four combinations of work kind and weight are asked', () => {
    expect(question().when).toBeUndefined();
    for (const [shape, answers] of Object.entries(SHAPES)) {
      expect(matchesWhen(question().when, answers), shape).toBe(true);
    }
  });

  test('it sits directly after output-style in the you phase (DIAL-8)', () => {
    const ids = ALL_QUESTIONS.filter((q) => q.phase === 'you').map((q) => q.id);
    expect(ids[ids.indexOf('output-style') + 1]).toBe('chat-style');
  });
});

describe('D2: ste writes the rule, none writes nothing', () => {
  for (const [shape, answers] of Object.entries(SHAPES)) {
    test(`${shape}: ste plans language-style.md, stamped`, async () => {
      const file = await rule({ ...answers, chatStyle: 'ste' });
      expect(file).toBeDefined();
      expect(readStamp(file?.contents ?? '')).not.toBeNull();
    });

    test(`${shape}: none plans nothing at that path`, async () => {
      expect(await rule({ ...answers, chatStyle: 'none' })).toBeUndefined();
    });
  }
});

describe('D4: an absent answer reads ste, wherever it is read', () => {
  test('the renderer: a saved profile with no chatStyle still plans the rule', async () => {
    expect(DEFAULT_ANSWERS.chatStyle).toBeUndefined();
    for (const [shape, answers] of Object.entries(SHAPES)) {
      expect(await rule(answers), shape).toBeDefined();
    }
  });

  test('the wizard: defaultFor offers ste on a run that has no answer yet', () => {
    expect(defaultFor(question(), {}, testConfig())).toBe('ste');
  });

  test('chatStyle has no stored default, so the recommended option decides', () => {
    expect(storedProfileDefault('chatStyle')).toBeNull();
  });

  /** G12: the site's `defaultAnswer` reads `recommended` and nothing else. */
  test('the terminal and the site start on the same answer', async () => {
    const catalog = (await Bun.file(catalogPath()).json()) as Catalog;
    const onSite = catalog.questions
      .find((q) => q.id === 'chat-style')
      ?.options?.find((o) => o.recommended)?.value;
    if (onSite === undefined)
      throw new Error('the catalog marks no chat-style option recommended');
    expect(onSite).toBe('ste');
    expect(defaultFor(question(), {}, testConfig())).toBe(onSite);
  });

  test('a saved none is kept, not replaced by the recommendation', () => {
    expect(defaultFor(question(), { chatStyle: 'none' }, testConfig())).toBe('none');
  });
});

describe('D3 and BD-3: what the rule says', () => {
  test('the five STE lines with their caps, and the irony and litotes line', async () => {
    const text = flat(await rule({ chatStyle: 'ste' }));
    expect(text).toContain('ASD-STE100 Simplified Technical English');
    expect(text).toContain('Maximum 20 words for instructions and 25 words for descriptions.');
    expect(text).toContain('Use one word for one meaning.');
    expect(text).toContain('Use simple verb tenses and the active voice.');
    expect(text).toContain('Do not use idioms, slang or phrasal verbs with unclear meaning.');
    expect(text).toContain('Give one instruction in each sentence.');
    expect(text).toContain('Do not use irony, sarcasm or litotes.');
  });

  test('it is scoped to chat, and code, commits and file contents keep their own rules', async () => {
    const text = flat(await rule({ chatStyle: 'ste' }));
    expect(text).toContain('This rule covers chat replies to me only.');
    expect(text).toContain('Papers, documents and other written work are outside this rule.');
    expect(text).toContain(
      'Code, commit messages and file contents keep the style rules of their own project.',
    );
  });

  test('it names no style file', async () => {
    const text = flat(await rule({ chatStyle: 'ste' }));
    expect(text).not.toMatch(/style\.md|writing-style|write-doc/);
  });
});
