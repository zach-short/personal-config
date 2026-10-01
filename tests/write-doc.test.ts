/**
 * write-doc-ste Phase 2: the `write-doc` question and `~/.claude/skills/write-doc/`.
 *
 * The promises from `docs/incomplete/write-doc-ste/DESIGN.md`. D5: asked of non-code work on both
 * weights and never of code. D10: not asked, and not rendered, under `skills: none`. D9: an absent
 * answer reads `yes` in the wizard's default and in the renderer's own fallback. BD-2: a saved
 * `writeDoc: yes` renders nothing on a later code run. D6 and BD-4: one folder of three files, the
 * skill stamped below its frontmatter and the script executable. Design hazard 4: the STE report
 * is rendered only where the chat rule was.
 *
 * Every negative case is rendered with the answers that would otherwise produce the folder, so a
 * renderer that wrote it unconditionally fails here rather than passing on what is absent.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { catalogPath } from '../src/lib/catalog.ts';
import { claudeSkillsDir } from '../src/lib/paths.ts';
import { readStamp } from '../src/lib/stamp.ts';
import { storedProfileDefault } from '../src/lib/stored-profile-defaults.ts';
import type { Answers, Catalog, PlannedFile, Question } from '../src/lib/types.ts';
import { matchesWhen } from '../src/lib/when.ts';
import { defaultFor } from '../src/phases/run.ts';
import { ALL_QUESTIONS } from '../src/questions/index.ts';
import { renderAll } from '../src/render/index.ts';
import { DEFAULT_ANSWERS, testConfig, testContext } from './helpers.ts';

const NON_CODE: Record<string, Answers> = {
  'non-code + full': { workKind: 'non-code', configWeight: 'full', usesGit: 'yes' },
  'non-code + light': { workKind: 'non-code', configWeight: 'light', usesGit: 'no' },
};

const CODE: Record<string, Answers> = {
  'code + full': { workKind: 'code', configWeight: 'full', usesGit: 'yes' },
  'code + light': { workKind: 'code', configWeight: 'light', usesGit: 'yes' },
};

const DIR = join(claudeSkillsDir(), 'write-doc');
const SKILL = join(DIR, 'SKILL.md');
const STYLE = join(DIR, 'style.md');
const CHECK = join(DIR, 'check.sh');
const TEMPLATES = join(import.meta.dir, '..', 'templates', 'write-doc');

function question(): Question {
  const found = ALL_QUESTIONS.find((q) => q.id === 'write-doc');
  if (!found) throw new Error('write-doc is not in the question set');
  return found;
}

async function folder(answers: Answers): Promise<PlannedFile[]> {
  const files = await renderAll(testContext({ ...DEFAULT_ANSWERS, ...answers }));
  return files.filter((f) => f.path.startsWith(`${DIR}/`));
}

async function file(answers: Answers, path: string): Promise<PlannedFile> {
  const found = (await folder(answers)).find((f) => f.path === path);
  if (!found) throw new Error(`${path} was not planned`);
  return found;
}

/** Text with its line wrapping undone, so an assertion does not pin where it wraps. */
function flat(text: string): string {
  return text.replace(/\s+/g, ' ');
}

const YES = { ...NON_CODE['non-code + full'], skills: 'all', writeDoc: 'yes' };

describe('D5 and D10: who is asked', () => {
  test('it sits directly after skills in the you phase (DIAL-8)', () => {
    const ids = ALL_QUESTIONS.filter((q) => q.phase === 'you').map((q) => q.id);
    expect(ids[ids.indexOf('skills') + 1]).toBe('write-doc');
  });

  test('asked of non-code work on both weights when skills are installed', () => {
    for (const [shape, answers] of Object.entries(NON_CODE)) {
      expect(matchesWhen(question().when, { ...answers, skills: 'all' }), shape).toBe(true);
    }
  });

  test('never asked of code work, on either weight', () => {
    for (const [shape, answers] of Object.entries(CODE)) {
      expect(matchesWhen(question().when, { ...answers, skills: 'all' }), shape).toBe(false);
    }
  });

  test('not asked under skills: none, on either weight', () => {
    for (const [shape, answers] of Object.entries(NON_CODE)) {
      expect(matchesWhen(question().when, { ...answers, skills: 'none' }), shape).toBe(false);
    }
  });
});

describe('what each answer renders', () => {
  for (const [shape, answers] of Object.entries(NON_CODE)) {
    test(`${shape}: yes plans the three files`, async () => {
      const paths = (await folder({ ...answers, skills: 'all', writeDoc: 'yes' })).map(
        (f) => f.path,
      );
      expect(paths.sort()).toEqual([SKILL, CHECK, STYLE].sort());
    });

    test(`${shape}: no plans nothing in the folder`, async () => {
      expect(await folder({ ...answers, skills: 'all', writeDoc: 'no' })).toEqual([]);
    });

    test(`${shape}: skills none plans nothing, even with a saved yes (D10)`, async () => {
      expect(await folder({ ...answers, skills: 'none', writeDoc: 'yes' })).toEqual([]);
    });
  }

  for (const [shape, answers] of Object.entries(CODE)) {
    test(`${shape}: a saved yes from an earlier non-code run plans nothing (BD-2)`, async () => {
      expect(await folder({ ...answers, skills: 'all', writeDoc: 'yes' })).toEqual([]);
    });
  }
});

describe('D9: an absent answer reads yes, wherever it is read', () => {
  test('the renderer: a non-code profile with no writeDoc still plans the folder', async () => {
    expect(DEFAULT_ANSWERS.writeDoc).toBeUndefined();
    for (const [shape, answers] of Object.entries(NON_CODE)) {
      expect(await folder({ ...answers, skills: 'all' }), shape).toHaveLength(3);
    }
  });

  test('the wizard: defaultFor offers yes on a run that has no answer yet', () => {
    expect(defaultFor(question(), {}, testConfig())).toBe('yes');
  });

  test('writeDoc has no stored default, so the recommended option decides', () => {
    expect(storedProfileDefault('writeDoc')).toBeNull();
  });

  /** G12: the site's `defaultAnswer` reads `recommended` and nothing else. */
  test('the terminal and the site start on the same answer', async () => {
    const catalog = (await Bun.file(catalogPath()).json()) as Catalog;
    const onSite = catalog.questions
      .find((q) => q.id === 'write-doc')
      ?.options?.find((o) => o.recommended)?.value;
    if (onSite === undefined)
      throw new Error('the catalog marks no write-doc option recommended');
    expect(onSite).toBe('yes');
    expect(defaultFor(question(), {}, testConfig())).toBe(onSite);
  });

  test('a saved no is kept, not replaced by the recommendation', () => {
    expect(defaultFor(question(), { writeDoc: 'no' }, testConfig())).toBe('no');
  });
});

describe('D6 and BD-4: the three files, their stamps and their modes', () => {
  test('SKILL.md keeps its frontmatter on line 1, with the stamp below it', async () => {
    const skill = await file(YES, SKILL);
    expect(skill.contents.split('\n')[0]).toBe('---');
    expect(readStamp(skill.contents)).not.toBeNull();
    expect(skill.mode).toBeUndefined();
  });

  test('the description keeps the trigger list, README included', async () => {
    const skill = await file(YES, SKILL);
    expect(skill.contents).toContain('name: write-doc');
    expect(skill.contents).toContain(
      'Use when the user types /write-doc, or asks to write, draft or rewrite a paper, doc, essay, report, README or proposal.',
    );
  });

  test('style.md is stamped and is the template below its stamp', async () => {
    const style = await file(YES, STYLE);
    expect(readStamp(style.contents)).not.toBeNull();
    const template = await Bun.file(join(TEMPLATES, 'style.md')).text();
    expect(style.contents.split('\n').slice(1).join('\n')).toBe(template);
  });

  test('check.sh is executable, its shebang on line 1 and its stamp on line 2', async () => {
    const check = await file(YES, CHECK);
    expect(check.mode).toBe(0o755);
    const lines = check.contents.split('\n');
    expect(lines[0]).toBe('#!/usr/bin/env bash');
    expect(readStamp(check.contents)).not.toBeNull();
    const template = await Bun.file(join(TEMPLATES, 'check.sh')).text();
    expect([lines[0], ...lines.slice(2)].join('\n')).toBe(template);
  });

  test('the skill names its own style file and script by absolute path', async () => {
    const text = (await file(YES, SKILL)).contents;
    expect(text).toContain(`Read \`${STYLE}\` in full`);
    expect(text).toContain(`${CHECK} check <path-to-file>`);
  });

  test('no placeholder is left in the skill', async () => {
    expect((await file(YES, SKILL)).contents).not.toMatch(/\{\{/);
  });
});

describe('the engine carries no personal strings', () => {
  test('the rendered skill and style name no person and no ~/Projects', async () => {
    for (const path of [SKILL, STYLE, CHECK]) {
      const text = (await file(YES, path)).contents;
      expect(text, path).not.toMatch(/zach/i);
      expect(text, path).not.toContain('~/Projects');
    }
  });

  test('the skill speaks of the author, never of a named owner', async () => {
    const text = (await file(YES, SKILL)).contents;
    expect(text).toContain('**Needs the author**');
    expect(text).toContain('[NEEDS THE AUTHOR: what is missing]');
  });
});

describe('design hazard 4: the STE passages follow chatStyle', () => {
  test('under ste, the skill reports in ASD-STE100 and points at the chat rule', async () => {
    const text = flat((await file({ ...YES, chatStyle: 'ste' }, SKILL)).contents);
    expect(text).toContain('**Report to the author in ASD-STE100.**');
    expect(text).toContain('Chat replies follow the ASD-STE100 rule in `language-style.md`');
  });

  test('an absent chatStyle reads ste, as the chat rule does (D4)', async () => {
    const text = flat((await file(YES, SKILL)).contents);
    expect(text).toContain('**Report to the author in ASD-STE100.**');
  });

  test('under none, the skill names no chat style at all', async () => {
    const text = flat((await file({ ...YES, chatStyle: 'none' }, SKILL)).contents);
    expect(text).toContain('**Report to the author.**');
    expect(text).toContain('Chat replies are outside it.');
    expect(text).not.toMatch(/STE100|language-style/);
  });
});
