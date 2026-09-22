/**
 * The two questions a non-coder is asked and a programmer is not (setup-tracks `DESIGN.md` D22
 * and D23, both ratified 2026-09-22). `edit-policy` is a policy area: it renders a paragraph
 * into the short standard's `## Preferences` through `policyParagraphs`, with no renderer change
 * of its own, so the test renders and reads rather than asserting on the area object.
 * `off-limits` travels the proof line's path exactly (G32) — asked per target, carried on
 * `RepoPlan`, laid over the shared answers by `targetAnswers` so it is saved and hashed — and
 * renders one line in the short router and one row in the short ledger, or nothing at all.
 *
 * A file of its own rather than more of `tracks.test.ts` (X1): a new file named for the area is
 * what keeps two sessions from colliding in one suite.
 *
 * The paragraphs are asserted by their opening sentence, not verbatim. D22 leaves their wording
 * to the builder and flags it for the owner's review, so a verbatim pin would go red on the
 * rewording it is inviting; what has to hold is that the right one of the three answers puts the
 * right paragraph in the right section.
 */
import { describe, expect, test } from 'bun:test';
import { planRepo } from '../src/commands/setup.ts';
import { defaultsPrompter } from '../src/lib/ask.ts';
import { configHash } from '../src/lib/config.ts';
import { leftoverTokens } from '../src/lib/template.ts';
import type { Answers, PlannedFile, RepoPlan } from '../src/lib/types.ts';
import { ALL_QUESTIONS, askable } from '../src/questions/index.ts';
import { targetAnswers } from '../src/render/context.ts';
import { renderAll } from '../src/render/index.ts';
import { DEFAULT_ANSWERS, testConfig, testContext, testRepoPlan, testScan } from './helpers.ts';

/** §3.1's last row: the shape both questions are for — non-code, light, no git. */
const NON_CODE: Answers = {
  ...DEFAULT_ANSWERS,
  workKind: 'non-code',
  configWeight: 'light',
  usesGit: 'no',
  proofLine: '',
};

/** §3.1's first row, for every negative case: neither question reaches a code track. */
const CODE: Answers = {
  ...DEFAULT_ANSWERS,
  workKind: 'code',
  configWeight: 'full',
  usesGit: 'yes',
  proofLine: '',
};

function folderPlan(overrides: Partial<RepoPlan> = {}): RepoPlan {
  return testRepoPlan({
    scan: testScan({
      kind: 'folder',
      name: 'accounts',
      path: '/tmp/accounts',
      remoteOwner: null,
      languages: [],
      packageManager: null,
      hasCi: false,
    }),
    trackMode: 'n/a',
    ...overrides,
  });
}

async function render(answers: Answers, plan: RepoPlan = folderPlan()): Promise<PlannedFile[]> {
  return renderAll(testContext(answers, plan));
}

function text(files: PlannedFile[], suffix: string): string {
  return files.find((f) => f.path.endsWith(suffix))?.contents ?? '';
}

function askedIds(answers: Answers): string[] {
  return askable(ALL_QUESTIONS, answers).map((q) => q.id);
}

/**
 * One `## ` section's body. A paragraph asserted to be "in Preferences" has to be in that
 * section and not merely somewhere in a 200-line document — the short standard names the agent
 * and the owner throughout, so a loose `toContain` would pass on the wrong section.
 */
function section(body: string, heading: string): string {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => l === heading || l.startsWith(`${heading} `));
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((l) => l.startsWith('## '));
  return (next === -1 ? rest : rest.slice(0, next)).join('\n');
}

async function preferences(answers: Answers): Promise<string> {
  return section(text(await render(answers), 'docs/AGENT-PRACTICES.md'), '## Preferences');
}

const AGENT_EDITS = '**The agent makes the change.**';
const SHOW_FIRST = '**Changes to a document are shown, not made.**';

describe('D22 — a non-coder is asked who makes changes to a document', () => {
  test('asked of non-code work and of nobody else', () => {
    expect(askedIds({ workKind: 'non-code' })).toContain('edit-policy');
    expect(askedIds({ workKind: 'code' })).not.toContain('edit-policy');
  });

  test('it joins the two house rules a non-coder already answers, and makes three', () => {
    const practices = askable(ALL_QUESTIONS, { workKind: 'non-code' })
      .filter((q) => q.phase === 'practices')
      .map((q) => q.id);
    expect(practices).toEqual(['copy-registers', 'drive-by-fixes', 'edit-policy']);
  });

  test('the recommended answer writes the ritual around an edit into Preferences', async () => {
    const body = await preferences({ ...NON_CODE, 'practices.edit-policy': 'agent-edits' });
    expect(body).toContain(AGENT_EDITS);
    expect(body).toContain('never overwrite one you have not read');
    expect(body).not.toContain(SHOW_FIRST);
  });

  test('“show me first” writes the other paragraph instead', async () => {
    const body = await preferences({ ...NON_CODE, 'practices.edit-policy': 'show-first' });
    expect(body).toContain(SHOW_FIRST);
    expect(body).not.toContain(AGENT_EDITS);
  });

  test('no rule writes neither, and leaves the two beside it standing', async () => {
    const body = await preferences({ ...NON_CODE, 'practices.edit-policy': 'none' });
    expect(body).not.toContain(AGENT_EDITS);
    expect(body).not.toContain(SHOW_FIRST);
    // The negative case is only worth anything if the section still renders what it did before.
    expect(body).toContain('**For user-facing copy, never pick silently.**');
    expect(body).toContain('**No drive-by fixes.**');
  });

  /**
   * D22 fixes the mechanism as well as the shape: `policyParagraphs` picks the area up with no
   * renderer change, so what keeps the paragraph off a code track is the question's `when` and
   * nothing else — on that track the answer is absent and `policyAnswer` reads `none`. `setup`
   * loads its config with no repo layer (`loadConfig(cli, null)`), so a target's own saved
   * answers cannot come back as a stale one either. An answer written into a profile by hand is
   * therefore honoured rather than overridden, which is the same deal every other area gets.
   */
  test('a code track renders no edit-policy paragraph: nothing there answers it', async () => {
    const standard = text(await render(CODE, testRepoPlan()), 'docs/AGENT-PRACTICES.md');
    expect(standard).not.toContain(AGENT_EDITS);
    expect(standard).not.toContain(SHOW_FIRST);
    // The section it would have landed in is rendered, so this is an absence and not a miss.
    expect(standard).toContain('# Part 11 — Owner policy');
  });
});

describe('D23 — a non-coder is asked, per target, what the agent must not read', () => {
  const OFF = 'the client-records/ folder';
  const ROUTER_LINE = `Never read, copy or quote from \`${OFF}\``;
  const LEDGER_ROW = `| Not to be read or copied | \`${OFF}\` | the owner |`;

  test('asked of non-code work and of nobody else', () => {
    expect(askedIds({ workKind: 'non-code' })).toContain('off-limits');
    expect(askedIds({ workKind: 'code' })).not.toContain('off-limits');
  });

  test('planRepo carries what the discover phase was told, and leaves it the target’s', async () => {
    const scan = testScan({
      kind: 'folder',
      name: 'accounts',
      path: '/tmp/accounts',
      remoteOwner: null,
    });
    const answers: Answers = { ...DEFAULT_ANSWERS, workKind: 'non-code', usesGit: 'no' };
    const prompter = defaultsPrompter({ 'off-limits': `  ${OFF} ` });
    const plan = await planRepo(scan, null, answers, testConfig(), prompter);
    expect(plan.offLimits).toBe(OFF);
    expect(answers.offLimits).toBeUndefined();
  });

  test('targetAnswers lays the plan’s answer over the shared ones', () => {
    const shared: Answers = { commitPolicy: 'print-blocks' };
    expect(targetAnswers(shared, folderPlan({ offLimits: OFF }))).toEqual({
      ...shared,
      proofLine: '',
      offLimits: OFF,
    });
  });

  test('named, it is a line in the router and a row in the ledger', async () => {
    const files = await render({ ...NON_CODE, offLimits: OFF });
    expect(text(files, 'CLAUDE.md')).toContain(ROUTER_LINE);
    expect(text(files, 'HANDOFF.md')).toContain(LEDGER_ROW);
  });

  test('empty renders nothing at all — no line, no row, no “none named”', async () => {
    const files = await render({ ...NON_CODE, offLimits: '' });
    const router = text(files, 'CLAUDE.md');
    const ledger = text(files, 'HANDOFF.md');
    expect(router).not.toContain('Never read, copy or quote');
    expect(ledger).not.toContain('Not to be read or copied');
    // Unlike the proof line, whose empty renders "not yet written": writing one is a first
    // session's job, and nothing being off limits is not a job (D23).
    expect(router).not.toContain('nothing is off limits');
    expect(ledger).not.toContain('nothing is off limits');
    // An empty row must not break the facts table it sits inside.
    expect(ledger).toContain('| What proves work here is sound |');
    expect(ledger).toContain('| Where the files live | | |');
  });

  test('saved with the target’s other answers, and hashed into its stamp', async () => {
    const files = await render({ ...NON_CODE, offLimits: OFF });
    const saved = JSON.parse(text(files, '.personal-config.json')) as { answers: Answers };
    expect(saved.answers.offLimits).toBe(OFF);

    const base = testConfig({ answers: targetAnswers(NON_CODE, folderPlan()) });
    const named = testConfig({
      answers: targetAnswers(NON_CODE, folderPlan({ offLimits: OFF })),
    });
    expect(await configHash(named)).not.toBe(await configHash(base));
  });

  /**
   * Two halves, because the code track has two routers. Code + full writes the *full* router,
   * whose `## Never do this` is Part 0's to fill — it carries no slot for this at all, which is
   * why the answer is supplied here and still renders nothing. Code + light writes the short
   * router, which does carry the slot; there the gate is the question's `when`, so the answer is
   * absent. `leftoverTokens` proves the slot was filled rather than left standing.
   */
  test('nothing on a code track, by two different mechanisms', async () => {
    const full = await render({ ...CODE, offLimits: OFF }, testRepoPlan());
    expect(text(full, 'CLAUDE.md')).not.toContain('Never read, copy or quote');
    expect(text(full, 'HANDOFF.md')).not.toContain('Not to be read or copied');

    const light = await render({ ...CODE, configWeight: 'light' }, testRepoPlan());
    expect(text(light, 'CLAUDE.md')).not.toContain('Never read, copy or quote');
    expect(text(light, 'HANDOFF.md')).not.toContain('Not to be read or copied');
    expect(leftoverTokens(text(light, 'CLAUDE.md'))).toEqual([]);
    expect(leftoverTokens(text(light, 'HANDOFF.md'))).toEqual([]);
  });
});
