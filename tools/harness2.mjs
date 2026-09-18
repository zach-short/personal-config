// Executes the REAL board-sweep.js body with stubbed agents, so the dependency/lane logic under
// test is the shipped code, not a paraphrase of it.
import { readFileSync } from 'node:fs';

const SRC = readFileSync(
  new URL(process.env.SCRIPT || './board-sweep.js', import.meta.url),
  'utf8',
).replace(/^export const meta/m, 'const meta');

const ITEMS = JSON.parse(readFileSync(new URL('./items.json', import.meta.url), 'utf8'));

async function run(name, { triage, items = ITEMS, noArgs = false, agentImpl } = {}) {
  const spawned = [];
  const logs = [];

  // Extracted from the `agent` stub below so `run` stays under the repo's complexity ceiling:
  // the label-to-canned-result table is its own concept and reads better named.
  const cannedFor = (label) => {
    const [kind, id] = (label || '').split(':');
    if (kind === 'triage') return triage(id);
    if (kind === 'build') return { worktreePath: `/wt/${id}`, gatesGreen: true, summary: 'ok' };
    if (kind === 'audit') return { verdict: 'clean', gatesReranGreen: true };
    if (kind === 'review') return { verdict: 'clean' };
    return null;
  };

  const agent = async (_prompt, opts = {}) => {
    spawned.push({ label: opts.label, model: opts.model, isolation: opts.isolation });
    const overridden = agentImpl ? await agentImpl(opts) : undefined;
    return overridden !== undefined ? overridden : cannedFor(opts.label);
  };
  const parallel = (thunks) =>
    Promise.all(
      thunks.map((t) =>
        Promise.resolve()
          .then(t)
          .catch(() => null),
      ),
    );
  const phase = () => {};
  const log = (m) => logs.push(m);

  const body = new Function(
    'agent',
    'parallel',
    'phase',
    'log',
    'args',
    `"use strict"; return (async () => {\n${SRC}\n})()`,
  );

  console.log(`\n=== ${name} ===`);
  try {
    const out = await body(agent, parallel, phase, log, noArgs ? undefined : { items });
    console.log('  blocked :', out.blocked.map((b) => b.id).join(', ') || '(none)');
    console.log(
      '  deferred:',
      out.deferred.map((d) => `${d.id}<-${d.unmet.join('+')}`).join(', ') || '(none)',
    );
    console.log(
      '  built   :',
      out.results.map((r) => `${r.item.id}/${r.kind}`).join(', ') || '(none)',
    );
    const builds = spawned
      .filter((s) => (s.label || '').startsWith('build:'))
      .map((s) => s.label);
    const dupes = builds.filter((b, i) => builds.indexOf(b) !== i);
    console.log('  DUPLICATE BUILDS:', dupes.length ? dupes.join(', ') : 'none');
    const bare = spawned.filter((s) => !s.model || !s.isolation);
    console.log(
      '  agents missing model or isolation:',
      bare.length ? JSON.stringify(bare) : 'none',
    );
    console.log(
      '  triage models:',
      spawned
        .filter((s) => (s.label || '').startsWith('triage:'))
        .map((s) => `${s.label}=${s.model}`)
        .join(' '),
    );
    return out;
  } catch (e) {
    console.log('  THREW:', `${e.constructor.name}: ${e.message}`);
    return null;
  }
}

const clear = () => ({ blocked: false, reasoning: 'clear' });
const block = () => ({ blocked: true, reasoning: 'owner decision', question: 'q' });

// 1. Last run's actual shape: 37 blocked, 38 blocked. 36 must defer behind 37.
await run('replay of last run (37 + 38 blocked)', {
  triage: (id) => (id === '37' || id === '38' ? block() : clear()),
});

// 2. B1: a triage agent throws. Old script died with a TypeError on the whole sweep.
await run('B1 - one triage agent throws', {
  triage: (id) => {
    if (id === '38') throw new Error('agent exploded');
    return clear();
  },
});

// 3. B1b: a triage agent returns null (user skipped it / terminal API error).
await run('B1b - one triage agent returns null', {
  triage: (id) => (id === '38' ? null : clear()),
});

// 4. B3: 35 blocked -> 37 deferred -> 36 must ALSO defer (it waits on 37).
//    Old code froze readyIds before deferring, so 36 counted 37 as "ready" and built anyway.
await run('B3 - transitive defer (35 blocked)', {
  triage: (id) => (id === '35' ? block() : clear()),
});

// 5. B4: put 37 in a different lane from its dependency 35. Old code built 35 in BOTH lanes.
const crossLane = JSON.parse(JSON.stringify(ITEMS)).map((i) =>
  i.id === '37' ? { ...i, lane: 'B' } : i,
);
await run('B4 - cross-lane dependency (37 moved to lane B)', {
  items: crossLane,
  triage: () => clear(),
});

// 6. B8/B10: a build reports gates red -> audit must be skipped, no null rows in results.
await run('B10 - build reports gates red', {
  triage: () => clear(),
  agentImpl: (opts) =>
    opts.label === 'build:38'
      ? { worktreePath: '/wt/38', gatesGreen: false, summary: 'gates failed' }
      : undefined,
});

// 7. B7: args missing entirely.
await run('B7 - no args.items', { triage: clear, noArgs: true });

// 8. B3 isolated: 36 waits ONLY on 37, 37 waits on 35, 35 blocked.
//    Transitive chain -- 36 must defer because 37 defers. The real board masks this because
//    36 happens to also wait on 35 directly.
const chain = JSON.parse(JSON.stringify(ITEMS)).map((i) =>
  i.id === '36' ? { ...i, waitsOn: ['37'] } : i,
);
await run('B3 ISOLATED - 36 waits only on 37, 37 waits on 35, 35 blocked', {
  items: chain,
  triage: (id) => (id === '35' ? block() : clear()),
});

// 9. The other half of the new rule: item 37 waits on 35, but 35 is NOT in this sweep (already
//    landed in main). It must BUILD, not defer. The old code deferred it, because the dep was
//    simply absent from readyIds.
await run('DEP NOT IN SWEEP - 37 alone, 35 already landed', {
  items: ITEMS.filter((i) => i.id === '37'),
  triage: () => clear(),
});

// 10. And the sweep we are about to actually run: item 35 alone, no deps.
await run('REAL RERUN - 35 alone', {
  items: ITEMS.filter((i) => i.id === '35'),
  triage: () => clear(),
});
