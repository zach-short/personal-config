/**
 * `/clean-up` — the judgment around `fold` and `archive`. It is rendered only for code + full,
 * the one track asked for an archive home, and there its prose turns on two axes: whether the
 * work record is a ledger and board (something to fold) or project folders (nothing to fold), and
 * whether there is git (without it `archive` refuses, so the skill cannot send the agent to it).
 */
import { describe, expect, test } from 'bun:test';
import { leftoverTokens } from '../src/lib/template.ts';
import type { Answers, PlannedFile, RepoPlan, WorkProfile } from '../src/lib/types.ts';
import {
  DEFAULT_ANSWERS,
  everySkill,
  PROSE_LAND_STEP,
  testContext,
  testRepoPlan,
} from './helpers.ts';

type Shape = {
  workKind: 'code' | 'non-code';
  configWeight: 'full' | 'light';
  usesGit: 'yes' | 'no';
};

const CODE_FULL_GIT: Shape = { workKind: 'code', configWeight: 'full', usesGit: 'yes' };
const CODE_FULL_NO_GIT: Shape = { workKind: 'code', configWeight: 'full', usesGit: 'no' };

async function render(
  shape: Shape,
  workProfile: WorkProfile = 'ledger',
  commitPolicy = 'print-blocks',
): Promise<PlannedFile[]> {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    ...PROSE_LAND_STEP,
    skills: 'all',
    ...shape,
    commitPolicy,
  };
  const plan: RepoPlan = testRepoPlan({ workProfile });
  return everySkill(testContext(answers, plan));
}

async function cleanUp(
  shape: Shape,
  workProfile: WorkProfile = 'ledger',
  commitPolicy = 'print-blocks',
): Promise<string> {
  const files = await render(shape, workProfile, commitPolicy);
  return files.find((f) => f.path.endsWith('clean-up/SKILL.md'))?.contents ?? '';
}

/** Autonomous-autopilot Phase 1 (design 4.3): under agent-pushes the sweep commits and pushes. */
describe('/clean-up under agent-pushes', () => {
  const PUSHES = [
    "Uncommitted changes block it too: commit the folder's final state yourself, naming its files, then `personal-config archive <slug> --move --dry-run`, then again without `--dry-run`.",
    'Then commit everything the sweep changed, naming the exact files, and push. **The archive may be its own repository**: its commit is rooted there and names its own files, exactly as the command printed it.',
    "Run it only once every `COMMITTED` item's tracked close-out is on the base, which the land step did.",
  ];
  const OWNERS = [
    "**the commit is the owner's**",
    'Then the commit blocks for everything the sweep changed.',
    "Run it only once every `COMMITTED` item's close-out is committed",
  ];

  test('passes: the three sentences render, and the owner commits nothing', async () => {
    const text = (await cleanUp(CODE_FULL_GIT, 'ledger', 'agent-pushes')).replace(/\s+/g, ' ');
    for (const phrase of PUSHES) expect(text, phrase).toContain(phrase);
    for (const phrase of OWNERS) expect(text, phrase).not.toContain(phrase);
  });

  test("violates: under agent-commits the owner's sentences stay and none of these renders", async () => {
    const text = (await cleanUp(CODE_FULL_GIT, 'ledger', 'agent-commits')).replace(/\s+/g, ' ');
    for (const phrase of PUSHES) expect(text, phrase).not.toContain(phrase);
    for (const phrase of OWNERS) expect(text, phrase).toContain(phrase);
  });
});

describe('who gets /clean-up', () => {
  test('passes: code + full installs it beside the others, /delegate, /autopilot and /audit among them in git', async () => {
    const files = await render(CODE_FULL_GIT);
    expect(files.map((f) => f.path.split('/').at(-2)).sort()).toEqual([
      'audit',
      'autopilot',
      'clean-up',
      'close-out',
      'delegate',
      'handoff',
      'passoff',
      'scope',
    ]);
  });

  test('violates: non-code + full is never asked for an archive home, so it gets no /clean-up', async () => {
    const files = await render({ workKind: 'non-code', configWeight: 'full', usesGit: 'yes' });
    expect(files).toHaveLength(4);
    expect(files.some((f) => f.path.includes('clean-up'))).toBe(false);
  });

  test('violates: a light setup gets its two and nothing else', async () => {
    const files = await render({ workKind: 'code', configWeight: 'light', usesGit: 'yes' });
    expect(files.some((f) => f.path.includes('clean-up'))).toBe(false);
  });
});

describe('what /clean-up tells each shape', () => {
  test('a ledger with git folds the board and ledger, then archives folders behind the owner commit', async () => {
    const text = await cleanUp(CODE_FULL_GIT);
    for (const phrase of [
      'personal-config fold --dry-run',
      'personal-config archive <slug>',
      '--move --dry-run',
      "the commit is the\n   owner's",
      '`COMMITTED, <date>, <hash>`',
      'Report, never mark.',
      'a `DONE` or `COMMITTED` row, a ledger step',
      '**The archive may be its own repository**',
    ])
      expect(text, phrase).toContain(phrase);
  });

  /**
   * Per-item-board Phase 6 (D6, D16): the fold moves a `COMMITTED` item's file with its row, and a
   * 1.x board, which the same installed skill still meets, keeps every row and step number.
   * Standard 2.2.0: a `DONE` item stays, and a `DONE` row git shows committed is moved, not marked.
   */
  test('a ledger folds item files with their rows, log lines by age, and a 1.x board as before', async () => {
    const text = (await cleanUp(CODE_FULL_GIT)).replace(/\s+/g, ' ');
    for (const phrase of [
      'closed item files and their rows, old log lines, finished design folders',
      "Each `COMMITTED` item's file is written to the archive, read back, given an index line",
      'only then removed with its row',
      'Log lines older than 90 days go to the archive log.',
      'A `DONE` item stays: its commit does not exist yet, except in a folder with no `.git`',
      'A row at `DONE` is built but not committed: it is not finished',
      'A `DONE` row whose code commit you can find is really `COMMITTED`',
      "git log --all --format='%h %d %s' -E --grep='row <n>([^0-9]|$)'",
      'Moving a `DONE` row to `COMMITTED` is not marking: it is a fact read from git.',
      'On a 1.x board, with no `passoff/` folder beside it, every row and every step number stays',
      'a close-out section, a log line',
    ])
      expect(text, phrase).toContain(phrase);
    expect(await cleanUp(CODE_FULL_NO_GIT)).not.toContain('git log --all');
    expect(await cleanUp(CODE_FULL_NO_GIT)).not.toContain('git cat-file');
  });

  test('without git, `DONE` is final: it is finished and it folds (standard 2.2.0)', async () => {
    const text = (await cleanUp(CODE_FULL_NO_GIT)).replace(/\s+/g, ' ');
    for (const phrase of [
      'A board row** is finished when it says `DONE, <date>` and its item file holds a close-out',
      "Each `DONE` item's file is written to the archive, read back",
      'With no git, no commit will follow, so `DONE` is final.',
      'a row is finished when it says `DONE, <step>` and that step is in the ledger.',
    ])
      expect(text, phrase).toContain(phrase);
    expect(text).not.toContain('A row at `DONE` is built but not committed');
    expect(text).not.toContain('`COMMITTED, <step>, <hash>`');
  });

  test('project folders are never told to fold a ledger or board they do not keep', async () => {
    const text = await cleanUp(CODE_FULL_GIT, 'folders');
    expect(text).toContain('1. **Each finished folder**');
    expect(text).toContain('closed project folders');
    for (const phrase of [
      'personal-config fold',
      'ledger step',
      'board row',
      'the ledger, the board',
    ])
      expect(text, phrase).not.toContain(phrase);
  });

  test('without git it is not sent to a command that refuses, nor told to commit', async () => {
    const text = await cleanUp(CODE_FULL_NO_GIT);
    expect(text).toContain('needs git and refuses without it');
    expect(text).toContain('verify\n   every file arrived before deleting the original');
    for (const phrase of ['personal-config archive <slug>', '--move', 'commit blocks'])
      expect(text, phrase).not.toContain(phrase);
  });

  for (const [name, shape, profile] of [
    ['ledger + git', CODE_FULL_GIT, 'ledger'],
    ['ledger, no git', CODE_FULL_NO_GIT, 'ledger'],
    ['folders + git', CODE_FULL_GIT, 'folders'],
    ['folders, no git', CODE_FULL_NO_GIT, 'folders'],
  ] as const) {
    test(`${name} leaves no token unfilled`, async () => {
      const text = await cleanUp(shape, profile);
      expect(text).not.toBe('');
      expect(leftoverTokens(text)).toEqual([]);
    });
  }

  test('the stamp sits below the frontmatter, where the harness can read it', async () => {
    const text = await cleanUp(CODE_FULL_GIT);
    expect(text.startsWith('---\nname: clean-up\n')).toBe(true);
  });
});

describe('what /close-out folds, by git (standard 2.2.0)', () => {
  async function closeOut(shape: Shape): Promise<string> {
    const files = await render(shape);
    const text = files.find((f) => f.path.endsWith('close-out/SKILL.md'))?.contents ?? '';
    return text.replace(/\s+/g, ' ');
  }

  test('without git, the item just closed folds now, and no row waits for a hash', async () => {
    const text = await closeOut(CODE_FULL_NO_GIT);
    expect(text).toContain(
      "`personal-config fold` moves each `DONE` item's file to the archive",
    );
    expect(text).toContain("`DONE` is final: this item's file moves at this fold.");
    expect(text).not.toContain('COMMITTED, HANDOFF <n>, <hash>');
  });

  test('with git, it waits for `COMMITTED`, and names the folder case in one clause', async () => {
    const text = await closeOut(CODE_FULL_GIT);
    expect(text).toContain(
      "`personal-config fold` moves each `COMMITTED` item's file to the archive",
    );
    expect(text).toContain("so this item's file waits for the next close-out");
    expect(text).toContain('In a folder with no `.git`, `DONE` is final and folds too.');
  });
});
