/**
 * `← back`. Until 2026-09-15 the wizard only moved forward: `askChoice`'s loop re-asked the
 * *same* question and `askPhase` was a plain `for`, so a wrong answer on question four could
 * only be fixed by finishing the run and starting another. These tests drive the way back
 * through a scripted `Prompter`, because the harness has no terminal to press an arrow key in.
 */
import { describe, expect, test } from 'bun:test';
import { parseCli } from '../src/lib/args.ts';
import { BACK, choiceOptions, type Prompter, READ_MORE } from '../src/lib/ask.ts';
import { loadConfig } from '../src/lib/config.ts';
import type { Answers, AnswerValue, Question } from '../src/lib/types.ts';
import { matchesWhen } from '../src/lib/when.ts';
import { askPhase } from '../src/phases/run.ts';
import { questionsFor } from '../src/questions/index.ts';
import { pickAll } from './helpers.ts';

/** One entry per *ask*, so a question asked twice consumes two of them. */
function scripted(script: AnswerValue[]): Prompter & {
  asked: Array<{ id: string; canGoBack: boolean }>;
} {
  const asked: Array<{ id: string; canGoBack: boolean }> = [];
  return {
    asked,
    async ask(question, fallback, canGoBack = false) {
      asked.push({ id: question.id, canGoBack });
      return script[asked.length - 1] ?? fallback;
    },
    async confirm(_message, fallback) {
      return fallback;
    },
    pick: pickAll,
  };
}

function ids(prompter: { asked: Array<{ id: string }> }): string[] {
  return prompter.asked.map((a) => a.id);
}

/**
 * The scripts below answer the first three questions with real track values — `code`, `full`,
 * `yes` — rather than the `a`/`b`/`c` they used to carry. Seven of the questions behind them
 * are asked only on the track they name (PASSOFF item 56), so a script that answered
 * `work-kind` with `a` would walk a phase four questions shorter than the one these tests are
 * about, and the positional assertions would be pinning the wrong walk.
 */
const TRACK: AnswerValue[] = ['code', 'full', 'yes'];

/** The `you` phase exactly as `setup` asks it — every real question, no terminal. */
async function runYou(prompter: Prompter): Promise<Answers> {
  const config = await loadConfig(parseCli(['setup']), null);
  const answers: Answers = { ...config.answers };
  await askPhase('you', prompter, answers, config);
  return answers;
}

const YOU = questionsFor('you').map((q) => q.id);

/** `noUncheckedIndexedAccess` is on, and a missing index here is a broken test, not a case. */
function youId(index: number): string {
  const id = YOU[index];
  if (id === undefined) throw new Error(`the you phase has no question ${index}`);
  return id;
}

/**
 * The answer key of the nth question, by position. These tests are about *walking* the phase,
 * so what they assert has to be positional too — naming `attribution` or `models.deep` made
 * them assertions about which question happens to be third, and they went red when three
 * questions were added at the head of the phase on 2026-09-17.
 */
function youKey(index: number): string {
  const question = questionsFor('you')[index];
  if (!question) throw new Error(`the you phase has no question ${index}`);
  return question.configKey;
}

/** The first `select` in the catalog, which is the only kind that carries an option list. */
function aChoice(): Question {
  const question = questionsFor('you').find((q) => q.kind === 'select');
  if (!question) throw new Error('the you phase has no select question');
  return question;
}

describe('which questions offer a way back', () => {
  test('the first question of a phase does not, because there is nothing behind it', async () => {
    const prompter = scripted([]);
    await runYou(prompter);

    expect(prompter.asked[0]?.canGoBack).toBe(false);
    expect(prompter.asked.slice(1).every((a) => a.canGoBack)).toBe(true);
  });

  test('a question returned to still offers it — back is not a one-way ticket', async () => {
    // Answer one, answer two, step back off three, then walk forward again.
    const prompter = scripted([...TRACK.slice(0, 2), BACK]);
    await runYou(prompter);

    const secondVisit = prompter.asked.findIndex((a, i) => i > 2 && a.id === youId(1));
    expect(secondVisit).toBeGreaterThan(-1);
    expect(prompter.asked[secondVisit]?.canGoBack).toBe(true);
  });

  test('`askPhase` reports the trail, and the prompter decides whether to draw it', () => {
    // A `text` question has no option list to put `← back` in, so `choiceOptions` is only ever
    // asked about choices. The runner still passes `canGoBack` for every kind: knowing what is
    // behind a question is the runner's job, drawing a widget is the prompter's.
    const question = aChoice();

    expect(choiceOptions(question, false).map((o) => o.value)).not.toContain(BACK);
    const withBack = choiceOptions(question, true);
    expect(withBack.at(-1)?.value).toBe(BACK);
    expect(withBack.at(-1)?.label).toBe('← back');
    expect(withBack.at(-2)?.value).toBe(READ_MORE);
  });
});

describe('walking backwards', () => {
  test('picking it re-asks the previous question, and keeps the corrected answer', async () => {
    const prompter = scripted(['code', 'full', BACK, 'light']);
    const answers = await runYou(prompter);

    // q1, q2, q3 → back, then q2 again, then forward from q3.
    expect(ids(prompter).slice(0, 5)).toEqual([...YOU.slice(0, 3), ...YOU.slice(1, 3)]);
    expect(answers[youKey(1)]).toBe('light');
  });

  test('the answer to the question stepped back from is not kept', async () => {
    // The run steps off question three before answering it, corrects two, then answers three.
    // `no` rather than `yes` on the third: the fallback is `yes`, so the assertion would pass
    // on a run that never took the scripted answer at all.
    const prompter = scripted(['code', 'full', BACK, 'full', 'no']);
    const answers = await runYou(prompter);

    expect(answers[youKey(2)]).toBe('no');
  });

  test('two backs in a row walk two questions, not one', async () => {
    const prompter = scripted([...TRACK, BACK, BACK]);
    await runYou(prompter);

    // Forward to the fourth, then two steps back: the third, then the second.
    expect(ids(prompter).slice(0, 6)).toEqual([...YOU.slice(0, 4), youId(2), youId(1)]);
  });

  test('every question is answered by the end, however much walking happened', async () => {
    // The track answers are `code`, `full`, `yes`, which asks nearly the whole phase — every
    // question whose own `when` resolves true against what this run actually answered.
    // `model-light` is the one exception (`haiku-tier` D1): it is gated on `modelLightEnabled`,
    // which this script never sets to `yes`, so the opt-in's own recommended default (`no`)
    // correctly leaves it unasked — the same way a shorter track already leaves other
    // conditional questions unasked.
    const prompter = scripted([...TRACK, 'x', BACK, 'x2']);
    const answers = await runYou(prompter);

    for (const question of questionsFor('you')) {
      if (!matchesWhen(question.when, answers)) continue;
      expect(answers[question.configKey]).toBeDefined();
    }
  });
});

/**
 * PASSOFF item 56 put seven questions behind the three track answers, and all three are at the
 * *head* of the same phase — so `← back` is the one path that can unask a question the person
 * has already answered. `askPhase` re-reads `askable` on every step forward, which is what makes
 * the set shrink; the trail is what stops it landing on a question that is no longer there.
 */
describe('changing a track answer on the way back', () => {
  test('answering non-code at the top drops attribution and the docs rule, but re-asks the commit question', async () => {
    // Forward to `attribution`, then four backs to stand on `work-kind` again and change it.
    const prompter = scripted([...TRACK, 'print-blocks', BACK, BACK, BACK, BACK, 'non-code']);
    const answers = await runYou(prompter);

    const secondPass = ids(prompter).slice(ids(prompter).lastIndexOf(youId(0)));
    // `commit-policy` is gated on git alone (item 62), and git is still `yes` — only the
    // work kind changed — so it is asked again, unlike `attribution` and `docs-mcp`, which
    // are still code-only.
    expect(secondPass).toContain('commit-policy');
    expect(secondPass).not.toContain('attribution');
    expect(secondPass).not.toContain('docs-mcp');
    // Re-asked with the script exhausted, it falls back to the recommended default — the
    // same value it was given the first time, so this does not by itself prove the re-ask.
    expect(answers.commitPolicy).toBe('print-blocks');
    expect(answers.workKind).toBe('non-code');
  });

  test('answering light at the top drops the two tiers and the routing rule', async () => {
    const prompter = scripted(['code', 'full', BACK, 'light']);
    await runYou(prompter);

    const secondPass = ids(prompter).slice(ids(prompter).lastIndexOf(youId(1)));
    expect(secondPass).not.toContain('model-deep');
    expect(secondPass).not.toContain('model-fast');
    expect(secondPass).not.toContain('model-routing');
    // The short standard still prints one model, so `model-default` survives the cut (D6).
    expect(secondPass).toContain('model-default');
  });
});

describe('a question its `when` skipped', () => {
  /**
   * `track-mode` is not asked when the repo is not the person's, so stepping back from the
   * question after it has to land on `work-profile`. An `index - 1` would have shown them a
   * question they never saw as the one they came from.
   *
   * `usesGit` is seeded because `track-mode` now needs the target owned *and* git in play, and
   * `workKind`/`configWeight` because `work-profile` is asked on code + full only (PASSOFF item
   * 56) and it is the question this walk lands back on. The `you` phase has always answered all
   * three by the time `discover` runs.
   */
  async function runDiscover(
    prompter: Prompter,
    owned: boolean,
    track: Answers = { workKind: 'code', configWeight: 'full' },
  ): Promise<Answers> {
    const config = await loadConfig(parseCli(['setup']), null);
    const answers: Answers = {
      ...config.answers,
      owned,
      usesGit: 'yes',
      ...track,
    };
    await askPhase('discover', prompter, answers, config, undefined, ['projects-dir']);
    return answers;
  }

  test('is stepped over going backwards, not stepped onto', async () => {
    const prompter = scripted(['ledger', BACK]);
    await runDiscover(prompter, false);

    expect(ids(prompter).slice(0, 3)).toEqual(['work-profile', 'proof-line', 'work-profile']);
  });

  test('is still asked when it applies, so the trail is not simply shorter', async () => {
    const prompter = scripted([]);
    await runDiscover(prompter, true);

    expect(ids(prompter)).toContain('track-mode');
  });

  /**
   * Item 60 (D26) puts `archive-home` and `mode` behind `code && full`, so on a short track the
   * phase stops before them and the walk steps back onto the question actually asked before it.
   *
   * The `you`-phase case above cannot cover these two, and that is a property of the runner,
   * not an omission: `askPhase` is called once per phase and offers no `← back` on a phase's
   * first question, so changing `work-kind` in `you` can never unask a `discover` question in
   * the same pass. What it does instead is decide the set `discover` is asked from, which is
   * what this case drives.
   *
   * **Item 61 moved where the phase ends**, and the trailing `off-limits` below is that: a
   * non-code track now asks one more question after the proof line (D23). What this case is
   * about — that `archive-home` and `mode` are gone and the walk steps back over them — is
   * unchanged, and the case immediately after it owns the new question's own walk.
   */
  test('a short track stops before D26’s two and steps back onto what it came from', async () => {
    const prompter = scripted(['tracked', BACK]);
    const answers = await runDiscover(prompter, true, {
      workKind: 'non-code',
      configWeight: 'light',
    });

    // Asked, stepped back from, re-asked, and walked forward again.
    expect(ids(prompter)).toEqual([
      'track-mode',
      'proof-line',
      'track-mode',
      'proof-line',
      'off-limits',
    ]);
    expect(ids(prompter)).not.toContain('archive-home');
    expect(ids(prompter)).not.toContain('mode');
    // What each of the two leaves behind, and they differ. `archiveHome` is a top-level config
    // key rather than a stored answer, so an unasked question leaves nothing for
    // `archiveFor` (`src/commands/setup.ts`) to read and the plan carries the empty string —
    // which `renderArchiveIndex` already treats as "no archive" (D26). `mode` *is* a stored
    // answer, and both shipped profiles set it to `solo`, so the merged config seeds it before
    // the phase starts; `pickShared` would default it to `solo` anyway.
    expect(answers.archiveHome).toBeUndefined();
    expect(answers.mode).toBe('solo');
    // `tracker` follows `mode` for free — it is asked only when `mode` is `team`, which an
    // unasked `mode` never becomes.
    expect(ids(prompter)).not.toContain('tracker');
  });

  /**
   * Item 61's `off-limits` (D23) is a `text` question that exists only on a non-code track, so
   * it is the first question whose *presence* turns on `work-kind` and which is also the last
   * thing the phase asks. Two things have to hold, and they are asserted separately because
   * they are independent: that changing `work-kind` is what makes it appear at all, and that
   * once it appears it can be stepped back from and walked forward onto again like any other.
   *
   * The first half is driven by running the phase twice rather than by pressing `← back` in
   * `you`, for the runner reason the case above records: `askPhase` cannot cross a phase
   * boundary, so a `work-kind` change can only ever decide the set the *next* phase asks from.
   */
  test('the new text question appears only when work-kind says non-code', async () => {
    const code = scripted([]);
    await runDiscover(code, true, { workKind: 'code', configWeight: 'light' });
    expect(ids(code)).not.toContain('off-limits');

    const nonCode = scripted([]);
    await runDiscover(nonCode, true, { workKind: 'non-code', configWeight: 'light' });
    expect(ids(nonCode)).toContain('off-limits');
  });

  test('and once it appears it is stepped back from and resumed, not skipped past', async () => {
    const LINE = 'the totals agree with the source table';
    const prompter = scripted(['tracked', LINE, BACK]);
    const answers = await runDiscover(prompter, true, {
      workKind: 'non-code',
      configWeight: 'light',
    });

    // Reached, stepped back from onto the question before it, and reached again — the walk a
    // last-question-of-the-phase has to survive, since there is nothing after it to land on.
    expect(ids(prompter)).toEqual([
      'track-mode',
      'proof-line',
      'off-limits',
      'proof-line',
      'off-limits',
    ]);
    // It is not the phase's first question, so the runner offers the way back from it.
    expect(prompter.asked[2]?.canGoBack).toBe(true);
    // Stepping back re-asks rather than discarding: the answer given before the `← back` is
    // what the re-ask falls back to, so walking forward again keeps it.
    expect(answers.proofLine).toBe(LINE);
  });
});
