/**
 * The track questions (setup-tracks `DESIGN.md` D1, D4, D13, D17) and the two promises they
 * were added under: a stored profile that predates them keeps meaning what it meant, and a
 * person who answers the way everyone answered at 0.2.6 gets the same bytes back.
 */
import { describe, expect, test } from 'bun:test';
import { parseCli } from '../src/lib/args.ts';
import { defaultsPrompter } from '../src/lib/ask.ts';
import { loadConfig } from '../src/lib/config.ts';
import { STORED_PROFILE_DEFAULTS } from '../src/lib/stored-profile-defaults.ts';
import type { Answers, Question } from '../src/lib/types.ts';
import { targetList } from '../src/lib/ui.ts';
import { defaultFor } from '../src/phases/run.ts';
import { questionsFor } from '../src/questions/index.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  tempDir,
  testConfig,
  testContext,
  testScan,
} from './helpers.ts';

/** The four keys a profile written at 0.2.6 cannot carry, because the questions did not exist. */
const ADDED_KEYS = ['workKind', 'configWeight', 'usesGit', 'outputStyle'] as const;

function youQuestion(id: string): Question {
  const question = questionsFor('you').find((q) => q.id === id);
  if (!question) throw new Error(`the you phase has no question "${id}"`);
  return question;
}

describe('DIAL-7 — a stored profile that predates the track questions', () => {
  test('reads as the behaviour at 0.2.6: code, full, git, check first', async () => {
    const config = await loadConfig(parseCli(['setup']), null);
    // `profiles/starter.json` is a real profile written before these questions existed, and
    // deliberately still carries none of their keys — adding them there would move the config
    // hash of every repo this tool has already configured.
    for (const key of ADDED_KEYS) expect(config.answers[key]).toBeUndefined();

    const answers: Answers = { ...config.answers };
    const prompter = defaultsPrompter();
    for (const key of ADDED_KEYS) {
      const question = questionsFor('you').find((q) => q.configKey === key);
      if (!question) throw new Error(`no question writes ${key}`);
      answers[key] = await prompter.ask(question, defaultFor(question, answers, config));
    }

    expect(answers).toMatchObject({
      workKind: 'code',
      configWeight: 'full',
      usesGit: 'yes',
      outputStyle: 'check-first',
    });
  });

  /**
   * The half that cannot be seen from outside. Every one of these questions marks its
   * behaviour-preserving option `recommended`, so the explicit reading and the fallthrough
   * agree today — which is the hazard, not the reassurance. Re-marking `recommended` on a
   * question is a copy change somebody will make one day; it must not silently change what a
   * profile stored a year earlier means.
   */
  test('the explicit reading beats the question’s own recommended option', async () => {
    const config = testConfig();
    const workKind = youQuestion('work-kind');
    const flipped: Question = {
      ...workKind,
      options: (workKind.options ?? []).map((option) => ({
        ...option,
        recommended: option.value !== 'code',
      })),
    };

    expect(flipped.options?.find((o) => o.recommended)?.value).toBe('non-code');
    expect(defaultFor(flipped, {}, config)).toBe('code');
    // And a stored answer still outranks it: this is a default, not an override.
    expect(defaultFor(flipped, { workKind: 'non-code' }, config)).toBe('non-code');
  });

  test('every key the track work added names its reading, and no other key is claimed', () => {
    expect(Object.keys(STORED_PROFILE_DEFAULTS).sort()).toEqual([...ADDED_KEYS].sort());
    // `proofLine` is a text question: unanswered is the empty string, which is what 0.2.6
    // rendered, so it is deliberately not in the map.
    expect(STORED_PROFILE_DEFAULTS.proofLine).toBeUndefined();
  });
});

describe('the no-change promise', () => {
  /**
   * §2's first non-scope item: a person who answers the way everyone answers at 0.2.6 gets
   * byte-identical output. This renders the whole plan twice — once with the 0.2.6 answer set,
   * once with the same set plus all five new answers at the values a 0.2.6 run implies — and
   * compares the bytes of every planned file.
   *
   * It compares rendered contents rather than a `--dry-run` preview on purpose: the preview
   * prints paths and labels, so it would stay green against a renderer that changed every line
   * of every file. The stamp is fixed by `testContext`, which is what isolates the claim from
   * the config hash.
   *
   * **The one file that does change is `.personal-config.json`**, and it has to: it is the
   * record of the answers, and there are five more answers. Its config hash moves with it,
   * correctly — a new answer is a new input to the configuration. That does not make `doctor`
   * report drift against a repo configured at 0.2.6, because `loadConfig` rebuilds the
   * expectation from that repo's own `.personal-config.json`, the user config and
   * `profiles/starter.json`, and none of the three carries a track key.
   */
  test('the five new answers change no rendered byte but the answers record', async () => {
    const dir = await tempDir();
    try {
      const before = await renderAll(testContext({ ...DEFAULT_ANSWERS }));
      const after = await renderAll(
        testContext({
          ...DEFAULT_ANSWERS,
          workKind: 'code',
          configWeight: 'full',
          usesGit: 'yes',
          outputStyle: 'check-first',
          proofLine: '',
        }),
      );

      expect(after.map((f) => f.path)).toEqual(before.map((f) => f.path));
      expect(before.length).toBeGreaterThan(1);

      const differing: string[] = [];
      for (const [index, file] of before.entries()) {
        if (after[index]?.contents !== file.contents) differing.push(file.path);
      }
      expect(differing.map((path) => path.split('/').at(-1))).toEqual([
        '.personal-config.json',
      ]);

      const record = before.findIndex((f) => f.path.endsWith('.personal-config.json'));
      const was = JSON.parse(before[record]?.contents ?? '{}') as { answers: Answers };
      const is = JSON.parse(after[record]?.contents ?? '{}') as { answers: Answers };
      expect(
        Object.keys(is.answers)
          .filter((k) => !(k in was.answers))
          .sort(),
      ).toEqual(['configWeight', 'outputStyle', 'proofLine', 'usesGit', 'workKind']);
      for (const [key, value] of Object.entries(was.answers)) {
        expect(is.answers[key], `${key} changed`).toEqual(value);
      }
    } finally {
      await cleanup(dir);
    }
  });

  /**
   * The same promise, re-proved for D5 — extended here rather than restated in a second file,
   * because "a 0.2.6 run gets 0.2.6's output" is one claim and every item that widens the
   * wizard has to answer to it.
   *
   * Discovery is the item most able to break it quietly: it now returns plain directories as
   * well, so a scan that finds only repos must still list exactly what it listed before —
   * including a scan of fifty, which was fifty rows at 0.2.6 and is not DIAL-10's to cap.
   * The expected string is written out literally rather than built from `targetList`, which
   * would only assert that the function agrees with itself.
   */
  test('a git-only scan lists exactly what it listed at 0.2.6', () => {
    const scans = [
      testScan({ name: 'bun-monorepo', languages: ['typescript'], packageManager: 'bun' }),
      testScan({
        name: 'go-module',
        languages: ['go'],
        packageManager: null,
        hasCi: false,
        existingDocs: ['CLAUDE.md'],
      }),
    ];

    expect(targetList(scans, '~/Projects')).toBe(
      [
        '',
        'Found 2 repo(s) under ~/Projects:',
        '',
        '  repo                   languages          pm          existing',
        '  bun-monorepo           typescript         bun    CI  —',
        '  go-module              go                 —          CLAUDE.md',
      ].join('\n'),
    );
  });

  test('DIAL-10 does not reach a git-only scan, however many repos it finds', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => testScan({ name: `repo-${i}` }));
    const rows = targetList(fifty, '~/Projects')
      .split('\n')
      .filter((line) => line.startsWith('  repo-'));
    expect(rows.length).toBe(50);
    expect(targetList(fifty, '~/Projects')).not.toContain('… and');
  });

  test('a non-code answer is what changes the question set, and only that', () => {
    const code = questionsFor('practices').filter(
      (q) => q.when === undefined || JSON.stringify(q.when).includes('"code"'),
    );
    expect(code.length).toBeGreaterThan(0);
    // The three new `you` questions and the proof line are asked of everyone, unconditionally:
    // the axes cannot gate themselves, and "non-code *or* light" is a disjunction `WhenSpec`
    // deliberately has no form for.
    for (const id of ['work-kind', 'config-weight', 'uses-git', 'output-style']) {
      expect(youQuestion(id).when).toBeUndefined();
    }
    const proofLine = questionsFor('discover').find((q) => q.id === 'proof-line');
    expect(proofLine?.when).toBeUndefined();
    expect(proofLine?.kind).toBe('text');
  });
});
