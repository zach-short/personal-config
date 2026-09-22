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
  test('35 questions, phased 14 / 7 / 14', async () => {
    const catalog = await committed();
    const byPhase: Record<string, number> = {};
    for (const q of catalog.questions) byPhase[q.phase] = (byPhase[q.phase] ?? 0) + 1;
    expect(catalog.questions.length).toBe(35);
    expect(byPhase).toEqual({ you: 14, discover: 7, practices: 14 });
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
    expect(conditions).toEqual({
      // Item 62: `commitRuleLine` is read by `repo.ts`, `standard.ts` and `short-standard.ts`
      // for any git target, non-code included — only `commits.md` (`rules.ts:24`) is code-only,
      // and `attribution` rides on that narrower file alone.
      'commit-policy': gitOnly,
      attribution: codeAndGit,
      // The tier table in `model-routing.md` is written on the weight alone, non-code
      // included, so these three are *not* the short-track negation — see `you.ts`.
      'model-deep': fullWeight,
      'model-fast': fullWeight,
      'model-routing': fullWeight,
      'docs-mcp': codeOnly,
      'work-profile': codeAndFull,
      'track-mode': {
        all: [
          { key: 'owned', isNot: false },
          { key: 'usesGit', is: 'yes' },
        ],
      },
      tracker: { key: 'mode', is: 'team' },
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
    // Copy registers and drive-by fixes survive: neither is a rule about source code.
    expect(asked('non-code')).toEqual(['copy-registers', 'drive-by-fixes']);
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
describe('what each of the four shapes is actually asked', () => {
  /** The site's view of a run: `owned` is derived from a git remote, and a browser has none. */
  async function asked(answers: Answers): Promise<string[]> {
    const catalog = await committed();
    return catalog.questions
      .filter((q) => matchesWhen(q.when, { mode: 'solo', ...answers }))
      .map((q) => q.id);
  }

  const DEAD_ON_A_SHORT_TRACK = ['model-deep', 'model-fast', 'model-routing', 'work-profile'];

  test('code + full + git is asked everything — §3.1 row 1 renders 0.2.5 byte for byte', async () => {
    const ids = await asked({ workKind: 'code', configWeight: 'full', usesGit: 'yes' });

    expect(ids).toHaveLength(33);
    expect(ids).toContain('commit-policy');
    expect(ids).toContain('model-routing');
  });

  test('code + full without git drops the two commit questions and nothing else', async () => {
    const ids = await asked({ workKind: 'code', configWeight: 'full', usesGit: 'no' });

    // 33 − `track-mode`, which has always been git-gated, − the two of this row.
    expect(ids).toHaveLength(30);
    expect(ids).not.toContain('commit-policy');
    expect(ids).not.toContain('attribution');
    expect(ids).toContain('docs-mcp');
  });

  test('code + light drops the tiers, the routing rule and the work profile', async () => {
    const ids = await asked({ workKind: 'code', configWeight: 'light', usesGit: 'yes' });

    expect(ids).toHaveLength(29);
    for (const id of DEAD_ON_A_SHORT_TRACK) expect(ids).not.toContain(id);
    // A light *code* setup still gets `commits.md` and `docs-lookup.md`, so it is still asked.
    expect(ids).toContain('commit-policy');
    expect(ids).toContain('docs-mcp');
  });

  test('non-code in git keeps its own commit question but drops attribution, the docs rule and the work profile', async () => {
    const full = await asked({ workKind: 'non-code', configWeight: 'full', usesGit: 'yes' });
    const light = await asked({ workKind: 'non-code', configWeight: 'light', usesGit: 'yes' });

    // 19 and 16, not 18 and 15 (item 62): `commit-policy` is asked wherever the target is in
    // git, which a non-code target with git of its own still is.
    expect(full).toHaveLength(19);
    expect(light).toHaveLength(16);
    for (const ids of [full, light]) {
      expect(ids).toContain('commit-policy');
      expect(ids).not.toContain('attribution');
      expect(ids).not.toContain('docs-mcp');
      expect(ids).not.toContain('work-profile');
    }
    // The one that is not the short-track negation: non-code + full still renders
    // `model-routing.md`, so it is still asked for the tiers that table prints.
    expect(full).toContain('model-routing');
    expect(light).not.toContain('model-routing');
  });

  test('the seven are gone together on the shape that wants none of them', async () => {
    const before = await asked({ workKind: 'code', configWeight: 'full', usesGit: 'yes' });
    const after = await asked({ workKind: 'non-code', configWeight: 'light', usesGit: 'yes' });

    // Every question the short non-code track skips, named: six of item 56's seven (item 62
    // moved `commit-policy` off this list — git is `yes` on both sides, so it is asked on
    // both) and the eleven code-conventions questions that were already gated on `code`.
    // `track-mode` is asked on both sides too, for the same reason, and is correctly absent.
    expect(before.filter((id) => !after.includes(id))).toEqual([
      'attribution',
      'model-deep',
      'model-fast',
      'model-routing',
      'docs-mcp',
      'work-profile',
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
});

describe('the catalog version', () => {
  test('is the package version plus a content hash, so a bump is legible', async () => {
    const catalog = await committed();
    expect(catalog.catalogVersion).toMatch(/^\d+\.\d+\.\d+\+[0-9a-f]{8}$/);
  });
});
