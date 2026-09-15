import { describe, expect, test } from 'bun:test';
import type { ConventionRule } from '../src/lib/types.ts';
import { PRACTICE_AREAS } from '../src/questions/index.ts';
import { renderConventions } from '../src/render/conventions.ts';
import { DEFAULT_ANSWERS, testContext } from './helpers.ts';

const LANGUAGES = ['typescript', 'go', 'swift', 'python'];

function rulesFor(language: string): ConventionRule[] {
  return PRACTICE_AREAS.filter((area) => area.target === 'conventions')
    .filter((area) => area.languages.length === 0 || area.languages.includes(language))
    .map((area) =>
      area.rule(String(DEFAULT_ANSWERS[area.question.configKey] ?? 'none'), language),
    )
    .filter((rule): rule is ConventionRule => rule !== null);
}

const ALL = LANGUAGES.flatMap(rulesFor);

describe('§8.1 — the enforcement tag is a claim about tooling', () => {
  test('violates: no seeded rule claims a linter, a gate or a CI job that was never configured', () => {
    const claimed = ALL.filter((rule) => rule.enforcement !== 'review').map((r) => r.id);
    expect(claimed).toEqual([]);
  });

  test('the generated file tells the reader how to promote one', () => {
    const files = renderConventions(testContext(DEFAULT_ANSWERS), ['typescript']);
    expect(files[0]?.contents).toContain('Promote');
  });
});

describe('§8.1 — IDs are never renumbered', () => {
  test('the states rule is D2, and no D6 exists to leave a hole behind it', () => {
    const ids = new Set(ALL.map((rule) => rule.id));
    expect(ids.has('D2')).toBe(true);
    expect(ids.has('D6')).toBe(false);
  });

  test('the whole set is pinned, so a renumber has to be deliberate', () => {
    expect([...new Set(ALL.map((rule) => rule.id))].sort()).toEqual([
      'C1',
      'D1',
      'D2',
      'E1',
      'F1',
      'I1',
      'L1',
      'L2',
      'S1',
      'T1',
      'X1',
    ]);
  });

  test('one ID never means two rules inside a language', () => {
    for (const language of LANGUAGES) {
      const ids = rulesFor(language).map((rule) => rule.id);
      expect(ids).toHaveLength(new Set(ids).size);
    }
  });
});

describe('a rule’s body describes the rule its title names', () => {
  test('violates: D1 talked only about environment variables', () => {
    const d1 = rulesFor('typescript').find((rule) => rule.id === 'D1');
    expect(d1?.title).toContain('typed client');
    expect(d1?.body).toContain('typed client');
  });

  test('the other branch says what it names too', () => {
    const area = PRACTICE_AREAS.find((a) => a.question.id === 'data-layer');
    expect(area?.rule('library-default', 'typescript')?.body).toContain('agreed library');
  });
});

describe('a rule that assumes a two-platform repo', () => {
  test('violates: "both platforms" dangles where there is one', () => {
    const bodies = ALL.map((rule) => rule.body).join('\n');
    expect(bodies).not.toContain('Both platforms');
    expect(rulesFor('swift').find((r) => r.id === 'S1')?.body).toContain('Every platform');
  });
});
