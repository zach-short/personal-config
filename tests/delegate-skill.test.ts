/**
 * `/delegate` (delegate-autopilot Phase 1, board row 83). It is offered only on code + full + git
 * (D1), on a board or on project folders (D22), and where it renders, `model-routing.md` names it
 * as the one exception to "a Deep subagent never builds" (D6, §4.3, BD-1). The template carries no
 * model family name (D12) and no Part number of the standard (BD-2); the tier names are filled in
 * from the person's own answers.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { readText } from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { leftoverTokens } from '../src/lib/template.ts';
import type { Answers, PlannedFile, WorkProfile } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import { DEFAULT_ANSWERS, testConfig, testContext, testRepoPlan } from './helpers.ts';

const CODE_FULL_GIT = { workKind: 'code', configWeight: 'full', usesGit: 'yes' } as const;

const EXCEPTION =
  'One exception, and only one: a Deep row may be built by a Deep subagent when I named that row\nmyself, by running `/delegate` on it, and that build then gets an independent Deep review.';

async function render(
  overrides: Answers = {},
  workProfile: WorkProfile = 'ledger',
  config = testConfig(),
): Promise<PlannedFile[]> {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    skills: 'all',
    ...CODE_FULL_GIT,
    ...overrides,
  };
  return renderAll(testContext(answers, testRepoPlan({ workProfile }), config));
}

function find(files: PlannedFile[], suffix: string): string | undefined {
  return files.find((f) => f.path.endsWith(join(...suffix.split('/'))))?.contents;
}

function skillNames(files: PlannedFile[]): string[] {
  return files
    .filter((f) => f.path.endsWith('SKILL.md'))
    .map((f) => f.path.split('/').at(-2) ?? '')
    .sort();
}

describe('who gets /delegate', () => {
  test('passes: code + full + git with every skill gets it beside the other five', async () => {
    expect(skillNames(await render())).toEqual([
      'clean-up',
      'close-out',
      'delegate',
      'handoff',
      'passoff',
      'scope',
    ]);
  });

  test('passes: project folders get it too, recorded through the phase header (D22)', async () => {
    const text = find(await render({}, 'folders'), 'delegate/SKILL.md') ?? '';
    expect(text).toContain('Mark the phase header `IN FLIGHT`');
    expect(text).toContain('The phase header becomes `BUILT <date>`');
    for (const phrase of ['passoff claim', 'HANDOFF.md', 'PASSOFF.md', 'mark the row `DONE`'])
      expect(text, phrase).not.toContain(phrase);
  });

  const without: Array<[string, Answers]> = [
    ['skills: none', { skills: 'none' }],
    ['the lighter setup', { configWeight: 'light' }],
    ['non-code work on the full setup', { workKind: 'non-code' }],
    ['code + full without git, which keeps its five', { usesGit: 'no' }],
  ];
  for (const [name, overrides] of without) {
    test(`violates: ${name} gets no /delegate`, async () => {
      expect(skillNames(await render(overrides))).not.toContain('delegate');
    });
  }
});

describe('what /delegate says', () => {
  test('the description is the ratified copy, word for word (D23)', async () => {
    const text = find(await render(), 'delegate/SKILL.md') ?? '';
    expect(text).toContain(
      'description: Build one ratified board row or planned phase with a builder subagent and a separate auditor, each in its own worktree on the right model, then sign it off. Use when a row has cleared its gate and you want it built, reviewed and recorded without opening a new session.\n',
    );
  });

  test('the template names no model family and no Part of the standard', async () => {
    const source = await readText(join(repoRoot(), 'templates', 'skills', 'delegate.md'));
    expect(source.toLowerCase()).not.toMatch(/fable|opus|sonnet|haiku/);
    expect(source).not.toMatch(/Part \d/);
    expect(source).not.toContain('—');
  });

  test('each configured tier name is filled in, and the Light row only when that tier is on', async () => {
    const config = testConfig({
      models: { deep: 'Big', default: 'Middle', fast: '', light: 'Tiny' },
    });
    const off = find(await render({}, 'ledger', config), 'delegate/SKILL.md') ?? '';
    expect(off).toContain('| Deep | Big |\n| Default | Middle |\n| Mechanical | <unset> |\n');
    expect(off).not.toContain('Light');
    const on = find(
      await render({ modelLightEnabled: 'yes' }, 'ledger', config),
      'delegate/SKILL.md',
    );
    expect(on).toContain('| Light | Tiny |');
  });

  test('under print-blocks the builder never commits, and the auditor works from the diff', async () => {
    const text =
      find(await render({ commitPolicy: 'print-blocks' }), 'delegate/SKILL.md') ?? '';
    expect(text).toContain('- Do not commit.');
    expect(text).toContain('diff HEAD');
    expect(text).toContain('"not yet committed"');
    expect(text).not.toContain('Commit on your own worktree branch');
  });

  test('under agent-commits the builder commits on its branch and never pushes', async () => {
    const text =
      find(await render({ commitPolicy: 'agent-commits' }), 'delegate/SKILL.md') ?? '';
    expect(text).toContain('Commit on your own worktree branch');
    expect(text).toContain('Never push and never merge.');
    expect(text).toContain("from the builder's branch");
    expect(text).not.toContain('- Do not commit.');
  });

  test('it names no skill that does not ship yet (BD-14, BD-17)', async () => {
    const text = find(await render(), 'delegate/SKILL.md') ?? '';
    expect(text).not.toContain('autopilot');
  });

  for (const policy of ['print-blocks', 'agent-commits', 'no-rule'])
    for (const profile of ['ledger', 'folders'] as const)
      test(`${policy} on ${profile} leaves no token unfilled, with the stamp below the frontmatter`, async () => {
        const text =
          find(await render({ commitPolicy: policy }, profile), 'delegate/SKILL.md') ?? '';
        expect(text.startsWith('---\nname: delegate\n')).toBe(true);
        expect(text).toContain('---\n\n<!-- personal-config v');
        expect(leftoverTokens(text)).toEqual([]);
      });
});

describe("model-routing.md names /delegate's Deep exception only where /delegate renders", () => {
  test('passes: delegate-or-stop on code + full + git holds the sentence once', async () => {
    const rule = find(await render(), 'rules/model-routing.md') ?? '';
    expect(rule.split(EXCEPTION)).toHaveLength(2);
    expect(rule).toContain(`that tier is for.\n${EXCEPTION}\nNever do the work yourself`);
  });

  const without: Array<[string, Answers]> = [
    ['warn-only', { modelRouting: 'warn-only' }],
    ['skills: none', { skills: 'none' }],
    ['non-code work on the full setup', { workKind: 'non-code' }],
    ['code + full without git', { usesGit: 'no' }],
  ];
  for (const [name, overrides] of without) {
    test(`violates: ${name} has no exception`, async () => {
      const rule = find(await render(overrides), 'rules/model-routing.md') ?? '';
      expect(rule).not.toBe('');
      expect(rule).not.toContain('One exception');
      if (overrides.modelRouting !== 'warn-only')
        expect(rule).toContain('that tier is for.\nNever do the work yourself');
    });
  }

  test('violates: skip writes no rule at all', async () => {
    expect(
      find(await render({ modelRouting: 'skip' }), 'rules/model-routing.md'),
    ).toBeUndefined();
  });
});
