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
  test('30 questions, phased 10 / 6 / 14', async () => {
    const catalog = await committed();
    const byPhase: Record<string, number> = {};
    for (const q of catalog.questions) byPhase[q.phase] = (byPhase[q.phase] ?? 0) + 1;
    expect(catalog.questions.length).toBe(30);
    expect(byPhase).toEqual({ you: 10, discover: 6, practices: 14 });
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

describe('the two conditionals and the one hidden question survive the trip', () => {
  test('their conditions are carried as data, not lost with the closure', async () => {
    const catalog = await committed();
    const conditions = Object.fromEntries(
      catalog.questions.filter((q) => q.when).map((q) => [q.id, q.when]),
    );
    expect(conditions).toEqual({
      'track-mode': { key: 'owned', isNot: false },
      tracker: { key: 'mode', is: 'team' },
      'commit-policy-practice': { never: true },
    });
  });

  test('track-mode is asked when the repo is owned, and skipped when it is not', async () => {
    const catalog = await committed();
    const question = catalog.questions.find((q) => q.id === 'track-mode');
    expect(matchesWhen(question?.when, { owned: true })).toBe(true);
    expect(matchesWhen(question?.when, {})).toBe(true);
    expect(matchesWhen(question?.when, { owned: false })).toBe(false);
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
    const answers: Answers = { owned: false, mode: 'solo' };
    const wizard = askable(ALL_QUESTIONS, answers).map((q) => q.id);
    const site = catalog.questions.filter((q) => matchesWhen(q.when, answers)).map((q) => q.id);
    expect(site).toEqual(wizard);
  });
});

describe('the catalog version', () => {
  test('is the package version plus a content hash, so a bump is legible', async () => {
    const catalog = await committed();
    expect(catalog.catalogVersion).toMatch(/^\d+\.\d+\.\d+\+[0-9a-f]{8}$/);
  });
});
