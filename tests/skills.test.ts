/**
 * Item 51. `DESIGN.md` D9 ratified `/handoff` and `/close-out` as "the two that survive without
 * gates or commits" (DIAL-6). Half of that was wrong, and item 44 found it by reading rather than
 * assuming: both skills were written for a reader with a board, a code map, gate commands and a
 * commit to land the record in, and a light non-code setup installs exactly these two.
 *
 * Every case below is the same test — render the skill for a shape, and assert that no sentence
 * which is false for that shape survived. The positive assertions are there because a renderer
 * that emitted an empty token would pass every negative one.
 */
import { describe, expect, test } from 'bun:test';
import { leftoverTokens } from '../src/lib/template.ts';
import type { Answers, PlannedFile, RepoPlan, WorkProfile } from '../src/lib/types.ts';
import { renderSkills } from '../src/render/skills.ts';
import { DEFAULT_ANSWERS, testContext, testRepoPlan, testScan } from './helpers.ts';

type Shape = {
  workKind: 'code' | 'non-code';
  configWeight: 'full' | 'light';
  usesGit: 'yes' | 'no';
};

const CODE_FULL_GIT: Shape = { workKind: 'code', configWeight: 'full', usesGit: 'yes' };
const CODE_FULL_NO_GIT: Shape = { workKind: 'code', configWeight: 'full', usesGit: 'no' };
const CODE_LIGHT: Shape = { workKind: 'code', configWeight: 'light', usesGit: 'yes' };
const NON_CODE_FULL: Shape = { workKind: 'non-code', configWeight: 'full', usesGit: 'yes' };
const NON_CODE_LIGHT: Shape = { workKind: 'non-code', configWeight: 'light', usesGit: 'no' };

async function render(
  shape: Shape,
  workProfile: WorkProfile = 'ledger',
): Promise<PlannedFile[]> {
  const answers: Answers = { ...DEFAULT_ANSWERS, skills: 'all', ...shape };
  const plan: RepoPlan = testRepoPlan({ workProfile });
  return renderSkills(testContext(answers, plan));
}

function skill(files: PlannedFile[], name: string): string {
  return files.find((f) => f.path.endsWith(`${name}/SKILL.md`))?.contents ?? '';
}

/** Read once per case so a missing file fails as an empty string rather than a thrown error. */
async function both(shape: Shape, workProfile: WorkProfile = 'ledger'): Promise<string> {
  const files = await render(shape, workProfile);
  return `${skill(files, 'close-out')}\n${skill(files, 'handoff')}`;
}

describe('the sentences that were false for the shape that read them', () => {
  test('a light non-code target is told of no board, no code map, no gates and no commit', async () => {
    const text = await both(NON_CODE_LIGHT);
    for (const phrase of [
      'in the same commit',
      'Gates green',
      'walked the flow on the device',
      'Run every gate command once',
      'the code map',
      'Code map',
      'Invariants',
      'Environment',
      'the board',
      'board item',
      'a phase',
      'runtime entries',
      'pass-off prompt',
      'Project-folder profile',
      'HANDOFF 24',
      'migration name',
    ])
      expect(text, phrase).not.toContain(phrase);
  });

  test('it is told what it does have instead — the proof line, and its own ledger sections', async () => {
    const text = await both(NON_CODE_LIGHT);
    expect(text).toContain('Apply the proof line to what was done');
    expect(text).toContain('Orientation, How things are here, Settled, Known facts and quirks');
    expect(text).toContain("the next session's prompt");
    expect(text).toContain('"step 24"');
  });

  test('a light code target keeps code and loses the board, the gates and the code map', async () => {
    const text = await both(CODE_LIGHT);
    expect(text).toContain('before any code');
    expect(text).toContain('`file:line`');
    for (const phrase of ['the board', 'board item', 'Gates green', 'the code map', 'Code map'])
      expect(text, phrase).not.toContain(phrase);
  });

  test('a full code target without git keeps the board and the gates and loses the commit', async () => {
    const text = await both(CODE_FULL_NO_GIT);
    expect(text).toContain('Gates green');
    expect(text).toContain('the pass-off prompt');
    expect(text).not.toContain('in the same commit');
    expect(text).not.toContain('a commit,');
  });

  test('a full non-code target keeps its board and loses the code', async () => {
    const text = await both(NON_CODE_FULL);
    expect(text).toContain('board item');
    expect(text).toContain('before the board and before any work');
    expect(text).toContain('in the same commit as the work');
    for (const phrase of ['before any code', '`file:line`', 'the code map', 'Gates green'])
      expect(text, phrase).not.toContain(phrase);
  });
});

describe('the shapes whose prose this row does not change', () => {
  test('a full code git target on a ledger keeps every sentence that is true of it', async () => {
    const text = await both(CODE_FULL_GIT);
    for (const phrase of [
      'in the same commit as the code',
      'Add any new file to the code map.',
      'Gates green, not seen running',
      'The board is what is next',
      'before the board and before any code',
      'Environment, Settled, Code map, Invariants, Known facts',
      'Run every gate command once before writing it into Environment.',
    ])
      expect(text, phrase).toContain(phrase);
  });

  /**
   * The project-folder profile is the one reader the runtime-pass block was ever true for. It has
   * no ledger at all (`src/render/repo.ts:184`), which is why the step bullet is not rendered for
   * it and was not simply reworded.
   */
  test('a project-folder target keeps the phase header, the runtime block and three blocks', async () => {
    const text = await both(CODE_FULL_GIT, 'folders');
    expect(text).toContain('Post three blocks in the chat');
    expect(text).toContain('Block B: the runtime entries this piece added.');
    expect(text).toContain('The runtime-pass file gets this phase');
    expect(text).toContain('Every phase and every board item');
    expect(text).not.toContain('One new step at the next free number');
  });
});

/**
 * Per-item-board Phase 6. Where a board is written beside a ledger, the record is the item file's
 * close-out and one log line, and `DONE` carries a date (D2 to D4, D13). The light track writes no
 * board and keeps its step log (D3 As built). A skill is installed once per machine, so the 2.0.0
 * text also tells a 1.x board where its step goes (D12).
 */
describe('standard 2.0.0: the record is the item file and a log line', () => {
  const FIRST_PERSON_STEP = '**One new step at the next free number**';

  for (const [name, shape] of [
    ['code + full + git', CODE_FULL_GIT],
    ['non-code + full', NON_CODE_FULL],
  ] as const) {
    test(`${name}: close-out writes the item's close-out section, a log line and a dated DONE`, async () => {
      const text = await both(shape);
      for (const phrase of [
        "section at the end of the item's own file**, `passoff/<n>-<slug>.md`",
        '`- <date> · closed item <n>`',
        '**The row becomes `DONE, <date>`**',
        '## Recording work',
        'read only your own item',
        'On a 1.x board, with no `passoff/` folder beside it',
      ])
        expect(text, phrase).toContain(phrase);
      expect(text).not.toContain(FIRST_PERSON_STEP);
      expect(text).not.toContain('## Appending a step');
    });
  }

  test('a light target keeps its numbered step log, because it writes no board', async () => {
    for (const shape of [CODE_LIGHT, NON_CODE_LIGHT]) {
      const text = await both(shape);
      expect(text).toContain(FIRST_PERSON_STEP);
      expect(text).toContain('## Appending a step');
      for (const phrase of ['closed item', 'passoff/', 'Close-out, <date>'])
        expect(text, phrase).not.toContain(phrase);
    }
  });

  test('the close-out names the code map on the full track and the proof line on the short one', async () => {
    expect(await both(CODE_FULL_GIT)).toContain(
      'which questions it answered; and **Left owed:**',
    );
    const short = await both(NON_CODE_FULL);
    expect(short).toContain(
      'how the proof line was applied (what was checked and what was seen)',
    );
    expect(short).not.toContain('code map');
  });

  test('in git the item just closed is folded later, once its row says COMMITTED', async () => {
    const text = (await both(CODE_FULL_GIT)).replace(/\s+/g, ' ');
    expect(text).toContain("A `DONE` item's file stays until its row says `COMMITTED`");
    expect(text).toContain("moves each `COMMITTED` item's file to the archive");
    expect(await both(CODE_FULL_NO_GIT)).not.toContain("`DONE` item's file stays");
  });

  /** Standard 2.1.0: the hash is unknowable before the owner commits, so `DONE` comes first. */
  test('in git the row is DONE before the hand-back blocks, and COMMITTED once git has the commit', async () => {
    const text = (await both(CODE_FULL_GIT)).replace(/\s+/g, ' ');
    expect(text).toContain('now, before the hand-back blocks');
    expect(text).toContain('Do not wait for the hash');
    expect(text).toContain('the row becomes `COMMITTED, <date>, <hash>`');
    expect(text).toContain("git log --all --format='%h %d %s' -E --grep='row <n>([^0-9]|$)'");
    expect(text).toContain('`COMMITTED, HANDOFF <n>, <hash>`');
    expect(await both(CODE_FULL_NO_GIT)).not.toContain('Do not wait for the hash');
  });

  test('/passoff puts the prompt in its own file on a board, and says nothing of one in folders', async () => {
    const onBoard = skill(await render(CODE_FULL_GIT), 'passoff');
    expect(onBoard).toContain('**Where it goes.** One file per item, `passoff/<n>-<slug>.md`');
    expect(onBoard).toContain("The item's close-out section is the truth");
    const inFolders = skill(await render(CODE_FULL_GIT, 'folders'), 'passoff');
    expect(inFolders).not.toContain('Where it goes.');
    expect(inFolders).toContain('The ledger step is the truth');
  });

  test('an adopted board name and an itemsDir override are the names the skills cite', async () => {
    const answers: Answers = { ...DEFAULT_ANSWERS, skills: 'all', ...CODE_FULL_GIT };
    const plan = testRepoPlan({
      scan: testScan({ ledgerDoc: 'NOTES.md', boardDoc: 'BOARD.md', itemsDoc: 'tasks' }),
    });
    const files = await renderSkills(testContext(answers, plan));
    const text = `${skill(files, 'close-out')}\n${skill(files, 'handoff')}`;
    expect(text).toContain('`tasks/<n>-<slug>.md`');
    expect(text).toContain('the log in `NOTES.md`');
    expect(text).toContain('`DONE, NOTES <n>`');
    expect(text).toContain("the archive's `NOTES-log.md`");
    expect(text).not.toContain('passoff/');
  });

  test('none of the six rewritten skills carries an em dash, on any shape', async () => {
    const six = ['handoff', 'passoff', 'close-out', 'clean-up', 'delegate', 'autopilot'];
    const shapes = [CODE_FULL_GIT, CODE_FULL_NO_GIT, CODE_LIGHT, NON_CODE_FULL, NON_CODE_LIGHT];
    const rendered = await Promise.all(
      shapes.flatMap((shape) => [render(shape, 'ledger'), render(shape, 'folders')]),
    );
    const files = rendered
      .flat()
      .filter((file) => six.some((name) => file.path.endsWith(`${name}/SKILL.md`)));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file.contents, file.path).not.toContain('—');
  });
});

describe('every shape renders a complete document', () => {
  const SHAPES: Array<[string, Shape]> = [
    ['code + full + git', CODE_FULL_GIT],
    ['code + full + no git', CODE_FULL_NO_GIT],
    ['code + light', CODE_LIGHT],
    ['non-code + full', NON_CODE_FULL],
    ['non-code + light', NON_CODE_LIGHT],
  ];

  for (const [name, shape] of SHAPES) {
    test(`${name} leaves no token unfilled`, async () => {
      for (const file of await render(shape)) expect(leftoverTokens(file.contents)).toEqual([]);
    });
  }

  test('the stamp still sits below the frontmatter, where the harness can read it', async () => {
    const text = skill(await render(NON_CODE_LIGHT), 'handoff');
    expect(text.startsWith('---\nname: handoff\n')).toBe(true);
    expect(text).toMatch(/\n---\n\n<!-- personal-config /);
  });
});
