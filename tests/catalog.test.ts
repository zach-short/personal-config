import { describe, expect, test } from 'bun:test';
import { buildCatalog, catalogPath, serializeCatalog } from '../src/lib/catalog.ts';
import type { Answers, Catalog } from '../src/lib/types.ts';
import { matchesWhen } from '../src/lib/when.ts';
import { ALL_QUESTIONS, askable, readMoreIds } from '../src/questions/index.ts';

async function committed(): Promise<Catalog> {
  return (await Bun.file(catalogPath()).json()) as Catalog;
}

describe('the freshness test — a question change without a regenerated catalog is a red test', () => {
  test('the committed catalog.json is byte-identical to a fresh build', async () => {
    const fresh = serializeCatalog(await buildCatalog());
    const onDisk = await Bun.file(catalogPath()).text();
    // The whole point of D6's pin: drift becomes a failing test in the repo that owns the
    // questions, rather than the site silently changing when someone edits one.
    expect(onDisk, 'catalog.json is stale — run `bun run catalog`').toBe(fresh);
  });

  test('the version moves when a question does', async () => {
    const base = await buildCatalog();
    const edited = {
      ...base,
      questions: base.questions.map((q) => ({ ...q, ask: `${q.ask}?` })),
    };
    expect(serializeCatalog(edited)).not.toBe(serializeCatalog(base));
  });
});

describe('the catalog carries the whole question set', () => {
  // 30 → 35 on 2026-09-17: four track questions at the head of `you` (work kind, config
  // weight, git, output style) and one per-target question in `discover` (the proof line).
  // The numbers are moved rather than loosened into a range — a count that cannot go red is
  // not a count.
  //
  // This is the split the catalog *carries*, which item 56 did not change: gating a question
  // does not remove it, and the site needs every one to evaluate the conditions for itself.
  // What a given person is actually asked is pinned separately, below.
  //
  // 35 → 37 on 2026-09-22, item 61: `off-limits` in `discover` and `edit-policy` in
  // `practices`, the two questions a non-coder is asked and a programmer is not (D22, D23).
  //
  // 37 → 39, same day, the `haiku-tier` effort: `model-light-enabled` and `model-light` in
  // `you`, the opt-in fourth tier (D1).
  //
  // 39 → 46, 2026-09-25, item 72: `tier-ceiling` in `discover` (1), and model ID selection
  // questions in `you` (6 new). Total: you 22, discover 9, practices 15.
  test('46 questions, phased 22 / 9 / 15', async () => {
    const catalog = await committed();
    const byPhase: Record<string, number> = {};
    for (const q of catalog.questions) byPhase[q.phase] = (byPhase[q.phase] ?? 0) + 1;
    expect(catalog.questions.length).toBe(46);
    expect(byPhase).toEqual({ you: 22, discover: 9, practices: 15 });
  });

  test('every question the wizard asks is present, in the wizard`s order', async () => {
    const catalog = await committed();
    expect(catalog.questions.map((q) => q.id)).toEqual(ALL_QUESTIONS.map((q) => q.id));
  });

  test('every long form is carried, and none is empty', async () => {
    const catalog = await committed();
    expect(catalog.choices.map((c) => c.id).sort()).toEqual([...readMoreIds()].sort());
    expect(catalog.choices.filter((c) => c.body.trim().length === 0)).toEqual([]);
  });

  test('every question`s long form is reachable by its readMore id', async () => {
    const catalog = await committed();
    const ids = new Set(catalog.choices.map((c) => c.id));
    const orphans = catalog.questions.filter((q) => !ids.has(q.readMore)).map((q) => q.id);
    expect(orphans).toEqual([]);
  });
});

describe('the conditionals and the one hidden question survive the trip', () => {
  test('their conditions are carried as data, not lost with the closure', async () => {
    const catalog = await committed();
    const conditions = Object.fromEntries(
      catalog.questions.filter((q) => q.when).map((q) => [q.id, q.when]),
    );
    // Written out rather than derived from the catalog: a condition added or dropped by
    // accident is exactly what this is here to catch, and a loop over the same source would
    // agree with itself either way.
    const codeOnly = { key: 'workKind', is: 'code' };
    // The seven of item 56, one corrected by item 62. `isNot: 'no'` on every git half and
    // never `is: 'yes'`, so a third value meaning "some of it" keeps asking rather than
    // silently stopping.
    const gitOnly = { key: 'usesGit', isNot: 'no' };
    const codeAndGit = {
      all: [
        { key: 'workKind', is: 'code' },
        { key: 'usesGit', isNot: 'no' },
      ],
    };
    const codeAndFull = {
      all: [
        { key: 'workKind', is: 'code' },
        { key: 'configWeight', is: 'full' },
      ],
    };
    const fullWeight = { key: 'configWeight', is: 'full' };
    // Item 61's two (D22, D23). The mirror image of `codeOnly`, and the only two specs in the
    // set that name `non-code`: both questions exist because confining `commit-policy` to a
    // repo left the non-coder with no rule about the step that cannot be taken back.
    const nonCodeOnly = { key: 'workKind', is: 'non-code' };
    // Item 72: tier ceiling and model ID questions (D1). Model IDs are asked once per person
    // when a repo picks a ceiling below Deep.
    const tierCeilingNotDeep = { key: 'tierCeiling', isNot: 'deep' };
    const tierCeilingNotDeepAndDefaultOther = {
      all: [
        { key: 'tierCeiling', isNot: 'deep' },
        { key: 'modelIds.default', is: 'other' },
      ],
    };
    const tierCeilingNotDeepAndMechanicalOther = {
      all: [
        { key: 'tierCeiling', isNot: 'deep' },
        { key: 'modelIds.mechanical', is: 'other' },
      ],
    };
    const tierCeilingNotDeepAndLight = {
      all: [
        { key: 'tierCeiling', isNot: 'deep' },
        { key: 'modelLightEnabled', is: 'yes' },
      ],
    };
    const tierCeilingNotDeepAndLightOther = {
      all: [
        { key: 'tierCeiling', isNot: 'deep' },
        { key: 'modelLightEnabled', is: 'yes' },
        { key: 'modelIds.light', is: 'other' },
      ],
    };
    expect(conditions).toEqual({
      // Item 62: `commitRuleLine` is read by `repo.ts`, `standard.ts` and `short-standard.ts`
      // for any git target, non-code included — only `commits.md` (`rules.ts:24`) is code-only,
      // and `attribution` rides on that narrower file alone.
      'commit-policy': gitOnly,
      attribution: codeAndGit,
      // The tier table in `model-routing.md` is written on the weight alone, non-code
      // included, so these four are *not* the short-track negation — see `you.ts`.
      'model-deep': fullWeight,
      'model-fast': fullWeight,
      'model-light-enabled': fullWeight,
      'model-routing': fullWeight,
      // `model-light` adds a second condition on top of the weight: the opt-in answer itself
      // (`haiku-tier` D1). Asked only when both are true, so the recommended `no` never surfaces
      // a text question for a tier nobody wanted.
      'model-light': {
        all: [
          { key: 'configWeight', is: 'full' },
          { key: 'modelLightEnabled', is: 'yes' },
        ],
      },
      'docs-mcp': codeOnly,
      'work-profile': codeAndFull,
      // D26, the two item 56's audit did not count (G23, G24): both were asked on every
      // short-track shape, saved, and rendered into no document there — `archiveHome` because
      // `workRecordShape` returns `ledger` for the whole short track, `mode` because its two
      // readers are the Part 0 prompt and the long standard, neither of which a short track
      // writes. They take `work-profile`'s spec exactly, the negation of `isShortTrack`.
      'archive-home': codeAndFull,
      mode: codeAndFull,
      // D23: asked per target, like the proof line beside it, but only where the work is not
      // code — a repo's off-limits material has `.gitignore` and `.env` already.
      'off-limits': nonCodeOnly,
      'track-mode': {
        all: [
          { key: 'owned', isNot: false },
          { key: 'usesGit', is: 'yes' },
        ],
      },
      tracker: { key: 'mode', is: 'team' },
      // D22: the non-coder's analogue of `commit-policy`, which is the entry above it.
      'edit-policy': nonCodeOnly,
      'commit-policy-practice': { never: true },
      comments: codeOnly,
      'function-length': codeOnly,
      exports: codeOnly,
      'file-naming': codeOnly,
      imports: codeOnly,
      types: codeOnly,
      'logic-placement': codeOnly,
      'data-layer': codeOnly,
      states: codeOnly,
      'design-tokens': codeOnly,
      'test-policy': codeOnly,
      'model-ids-default': tierCeilingNotDeep,
      'model-ids-default-other': tierCeilingNotDeepAndDefaultOther,
      'model-ids-mechanical': tierCeilingNotDeep,
      'model-ids-mechanical-other': tierCeilingNotDeepAndMechanicalOther,
      'model-ids-light': tierCeilingNotDeepAndLight,
      'model-ids-light-other': tierCeilingNotDeepAndLightOther,
    });
  });

  test('track-mode needs the repo owned *and* git in play, not either one', async () => {
    const catalog = await committed();
    const question = catalog.questions.find((q) => q.id === 'track-mode');
    expect(matchesWhen(question?.when, { owned: true, usesGit: 'yes' })).toBe(true);
    // `owned` is derived from a git remote, so a browser never has it — and must still ask.
    expect(matchesWhen(question?.when, { usesGit: 'yes' })).toBe(true);
    expect(matchesWhen(question?.when, { owned: false, usesGit: 'yes' })).toBe(false);
    expect(matchesWhen(question?.when, { owned: true, usesGit: 'no' })).toBe(false);
  });

  test('the code-conventions questions are skipped for non-code work', async () => {
    const catalog = await committed();
    const asked = (workKind: string) =>
      catalog.questions
        .filter((q) => q.phase === 'practices' && matchesWhen(q.when, { workKind }))
        .map((q) => q.id);

    expect(asked('code')).toHaveLength(13);
    // Copy registers and drive-by fixes survive: neither is a rule about source code. Item 61
    // adds the third, and it is the only one of the three a *programmer* is not asked —
    // `PART 3 OF 3 · House rules` for a non-coder goes from two questions to three (D22).
    expect(asked('non-code')).toEqual(['copy-registers', 'drive-by-fixes', 'edit-policy']);
  });

  test('tracker is asked for a team and skipped for a solo', async () => {
    const catalog = await committed();
    const question = catalog.questions.find((q) => q.id === 'tracker');
    expect(matchesWhen(question?.when, { mode: 'team' })).toBe(true);
    expect(matchesWhen(question?.when, { mode: 'solo' })).toBe(false);
  });

  test('commit-policy-practice is never asked, by any answers at all', async () => {
    const catalog = await committed();
    const question = catalog.questions.find((q) => q.id === 'commit-policy-practice');
    const probes: Answers[] = [
      {},
      { commitPolicy: 'print-blocks' },
      { owned: true, mode: 'team' },
    ];
    expect(probes.map((a) => matchesWhen(question?.when, a))).toEqual([false, false, false]);
  });

  test('the catalog and the wizard skip the same questions for the same answers', async () => {
    const catalog = await committed();
    const probes: Answers[] = [
      { owned: false, mode: 'solo' },
      // The one the `all:` form exists for, and the one the site actually sees: no `owned`.
      { mode: 'solo', workKind: 'non-code', usesGit: 'no' },
      { owned: true, mode: 'team', workKind: 'code', usesGit: 'yes' },
    ];
    for (const answers of probes) {
      const wizard = askable(ALL_QUESTIONS, answers).map((q) => q.id);
      const site = catalog.questions
        .filter((q) => matchesWhen(q.when, answers))
        .map((q) => q.id);
      expect(site).toEqual(wizard);
    }
  });
});

/**
 * PASSOFF item 56. The three track answers gated what a run *wrote* and nothing about what it
 * *asked*, so a non-code visitor with no git answered 21 questions and 6 of them reached no
 * rendered byte. One case per shape of setup-tracks `DESIGN.md` §3.1, because a single case
 * would pass on the shape it was written for while another quietly regrew its dead questions.
 *
 * Counts, not just absences: a count is what goes red when a *new* question is added with no
 * thought about which track wants it.
 */
describe('what each of the five shapes is actually asked', () => {
  /**
   * The site's view of a run: `owned` is derived from a git remote, and a browser has none.
   *
   * `mode` is supplied rather than asked-for because `tracker` reads it, and item 60 stopped
   * asking it on a short track (D26) — where an unasked `mode` reads as `solo`
   * (`pickShared`, `src/commands/setup.ts`), which is what `tracker`'s own condition then sees.
   */
  async function asked(answers: Answers): Promise<string[]> {
    const catalog = await committed();
    return catalog.questions
      .filter((q) => matchesWhen(q.when, { mode: 'solo', ...answers }))
      .map((q) => q.id);
  }

  const DEAD_ON_A_SHORT_TRACK = [
    'model-deep',
    'model-fast',
    'model-light-enabled',
    'model-light',
    'model-routing',
    'work-profile',
    // Item 60, D26.
    'archive-home',
    'mode',
  ];

  // 33 → 34, the `haiku-tier` effort: `model-light-enabled` joins the always-asked-on-full-weight
  // group. `model-light` itself is not asked here — `mode: 'solo'` is the only answer this
  // probe supplies beyond the three track axes, so `modelLightEnabled` is unanswered and the
  // opt-in's own condition is false.
  test('code + full + git is asked everything — §3.1 row 1 renders 0.2.5 byte for byte', async () => {
    const ids = await asked({ workKind: 'code', configWeight: 'full', usesGit: 'yes' });

    expect(ids).toHaveLength(34);
    expect(ids).toContain('commit-policy');
    expect(ids).toContain('model-routing');
  });

  test('code + full without git drops the two commit questions and nothing else', async () => {
    const ids = await asked({ workKind: 'code', configWeight: 'full', usesGit: 'no' });

    // 34 − `track-mode`, which has always been git-gated, − the two of this row.
    expect(ids).toHaveLength(31);
    expect(ids).not.toContain('commit-policy');
    expect(ids).not.toContain('attribution');
    expect(ids).toContain('docs-mcp');
  });

  test('code + light drops the tiers, the routing rule, the work profile and D26’s two', async () => {
    const ids = await asked({ workKind: 'code', configWeight: 'light', usesGit: 'yes' });

    // 29 → 27 on item 60: `archive-home` and `mode` join the four (D26). Item 61 adds nothing
    // here — both of its questions are non-code, and this is the short track a *programmer*
    // walks, which is the half of "nothing on a code track" that is easy to lose.
    expect(ids).toHaveLength(27);
    for (const id of DEAD_ON_A_SHORT_TRACK) expect(ids).not.toContain(id);
    expect(ids).not.toContain('off-limits');
    expect(ids).not.toContain('edit-policy');
    // A light *code* setup still gets `commits.md` and `docs-lookup.md`, so it is still asked.
    expect(ids).toContain('commit-policy');
    expect(ids).toContain('docs-mcp');
  });

  test('non-code in git keeps its own commit question but drops attribution, the docs rule and the work profile', async () => {
    const full = await asked({ workKind: 'non-code', configWeight: 'full', usesGit: 'yes' });
    const light = await asked({ workKind: 'non-code', configWeight: 'light', usesGit: 'yes' });

    // 19 and 16 on item 61: two more than item 60's 17 and 14, both shapes gaining
    // `off-limits` and `edit-policy` (D22, D23). §10.3's "After D22 + D23" column says 18 for
    // the full shape and the gap is item 62's, not this row's: that column was computed on item
    // 56's tree, before item 62 put `commit-policy` back for a non-code target in git, and that
    // one question is the whole of the difference — the same off-by-one item 60 recorded
    // (HANDOFF 73), carried forward unchanged. Measured by running, not reasoned.
    //
    // 19 → 20 on the full shape only, the `haiku-tier` effort: `model-light-enabled` is asked on
    // the weight alone, non-code included (same reasoning as `model-deep`/`model-fast` above).
    // The light shape is untouched — `model-light-enabled` is also weight-gated, same as every
    // other tier question, so a light non-code run never sees it either.
    expect(full).toHaveLength(20);
    expect(light).toHaveLength(16);
    for (const ids of [full, light]) {
      expect(ids).toContain('commit-policy');
      expect(ids).toContain('off-limits');
      expect(ids).toContain('edit-policy');
      expect(ids).not.toContain('attribution');
      expect(ids).not.toContain('docs-mcp');
      expect(ids).not.toContain('work-profile');
      expect(ids).not.toContain('archive-home');
      expect(ids).not.toContain('mode');
    }
    // The one that is not the short-track negation: non-code + full still renders
    // `model-routing.md`, so it is still asked for the tiers that table prints.
    expect(full).toContain('model-routing');
    expect(light).not.toContain('model-routing');
  });

  test('the shortest track — §3.1’s last row, the shape this design exists for', async () => {
    const ids = await asked({ workKind: 'non-code', configWeight: 'light', usesGit: 'no' });

    // 21 before item 56, 14 after it, 12 after D26, 14 again after item 61's two. The fifth
    // shape of §10.3's table, which had no case of its own until item 60: it is the one a
    // non-programmer actually walks, and §10.3's "After D22 + D23" column says 14 for it.
    expect(ids).toHaveLength(14);
    for (const id of DEAD_ON_A_SHORT_TRACK) expect(ids).not.toContain(id);
    // The two this shape gained: a rule about the step that cannot be taken back where there is
    // no commit to gate it on, and the one question in the set about somebody else's material.
    expect(ids).toContain('edit-policy');
    expect(ids).toContain('off-limits');
    // Nothing here is asked about git, and `tracker` follows `mode` for free — an unasked
    // `mode` is never `team` (D26).
    expect(ids).not.toContain('commit-policy');
    expect(ids).not.toContain('track-mode');
    expect(ids).not.toContain('tracker');
    // The per-target question that is asked on every track, gates or no gates (D7).
    expect(ids).toContain('proof-line');
  });

  test('the seven are gone together on the shape that wants none of them', async () => {
    const before = await asked({ workKind: 'code', configWeight: 'full', usesGit: 'yes' });
    const after = await asked({ workKind: 'non-code', configWeight: 'light', usesGit: 'yes' });

    // Every question the short non-code track skips, named: six of item 56's seven (item 62
    // moved `commit-policy` off this list — git is `yes` on both sides, so it is asked on
    // both), item 60's two (D26), and the eleven code-conventions questions that were already
    // gated on `code`. `track-mode` is asked on both sides too, and is correctly absent.
    expect(before.filter((id) => !after.includes(id))).toEqual([
      'attribution',
      'model-deep',
      'model-fast',
      'model-light-enabled',
      'model-routing',
      'docs-mcp',
      'work-profile',
      'archive-home',
      'mode',
      'comments',
      'function-length',
      'exports',
      'file-naming',
      'imports',
      'types',
      'logic-placement',
      'data-layer',
      'states',
      'design-tokens',
      'test-policy',
    ]);
  });

  /**
   * The other direction, which had no case until item 61 because until item 61 the answer was
   * the empty list: the short non-code track is now asked two things the full code track is
   * not. Pinned as a list rather than a count, because "a non-coder is asked something a
   * programmer is not" is the whole of D22 and D23 and an added third would be a decision.
   */
  test('and the two that go the other way — the only questions a programmer is never asked', async () => {
    const code = await asked({ workKind: 'code', configWeight: 'full', usesGit: 'yes' });
    const nonCode = await asked({
      workKind: 'non-code',
      configWeight: 'light',
      usesGit: 'yes',
    });

    expect(nonCode.filter((id) => !code.includes(id))).toEqual(['off-limits', 'edit-policy']);
  });
});

describe('the catalog version', () => {
  test('is the package version plus a content hash, so a bump is legible', async () => {
    const catalog = await committed();
    expect(catalog.catalogVersion).toMatch(/^\d+\.\d+\.\d+\+[0-9a-f]{8}$/);
  });
});
