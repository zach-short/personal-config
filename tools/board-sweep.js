export const meta = {
  name: 'board-sweep',
  description: 'Triage open personal-config board items for genuine owner decisions, then build, audit and report on everything not blocked',
  phases: [
    { title: 'Triage' },
    { title: 'Build' },
    { title: 'Audit' },
  ],
}

// B7: args.items was read unguarded; a missing or JSON-stringified args crashed on ITEMS.length
// with no usable message.
const ITEMS = args && Array.isArray(args.items) ? args.items : null;
if (!ITEMS || ITEMS.length === 0) {
  throw new Error(
    'board-sweep needs args.items as a real JSON array of board items ' +
      '({id, title, model, lane, waitsOn, kind, prompt}), not a stringified one.'
  );
}

function tierToModel(tier) {
  if (tier === 'Fable 5.1') return 'fable';
  if (tier === 'Sonnet 5') return 'sonnet';
  return 'opus';
}

// B2: triage carried no model, so every triage agent inherited the workflow default (Sonnet 5 on
// the last run) and a Mechanical-tier read decided what Opus and Fable were allowed to build.
// model-routing.md: never let a subagent inherit the session tier for read-and-report work. A bad
// triage is also a *quiet* failure — a wrongly-cleared item builds and looks fine — so the floor
// here is the Default tier, raised to Deep only where the item itself is Deep.
function triageModel(item) {
  return item.model === 'Fable 5.1' ? 'fable' : 'opus';
}

const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    blocked: { type: 'boolean' },
    question: { type: 'string' },
    recommendation: { type: 'string' },
    reasoning: { type: 'string' },
  },
  required: ['blocked', 'reasoning'],
};

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    worktreePath: { type: 'string' },
    gatesGreen: { type: 'boolean' },
    gateOutput: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    diff: { type: 'string' },
    summary: { type: 'string' },
    leftOwed: { type: 'string' },
  },
  required: ['worktreePath', 'gatesGreen', 'summary'],
};

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['clean', 'non_blocking', 'blocking'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { summary: { type: 'string' }, citation: { type: 'string' } },
        required: ['summary', 'citation'],
      },
    },
    gatesReranGreen: { type: 'boolean' },
    diffScopedCorrectly: { type: 'boolean' },
  },
  required: ['verdict', 'gatesReranGreen'],
};

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['clean', 'finding'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          citation: { type: 'string' },
          severity: { type: 'string' },
        },
        required: ['summary', 'citation'],
      },
    },
  },
  required: ['verdict'],
};

function triagePrompt(item) {
  return [
    'You are triaging one open board item before it is built, per this repos own AGENT-PRACTICES standard (Part 1 R6, GATE 1).',
    'Read the items full prompt below, and re-verify its load-bearing claims against the real repo state rather than trusting them on sight (R3).',
    'Say whether it still carries a genuine open decision that only the repos owner can make.',
    '',
    // B6: this rule used to be flat -- "an Ask-before-building section counts as blocked" -- so an
    // item whose owner had since answered that section, in writing, directly underneath it was
    // blocked all over again on the next sweep. That is what happened to item 38.
    'An explicit Ask-before-building section counts as blocked ONLY if the prompt does not already record the owners answer.',
    'If the prompt carries a recorded decision that resolves that section -- a "Decided <date>, <owner>" line, or equivalent -- then the decision stands and the item is NOT blocked. Report it as clear to build, and say which decision you are relying on.',
    'A build-level judgment call an engineer can reasonably make alone does not count as blocked - do not invent a blocker where the prompt already made the call.',
    '',
    'If blocked, restate the exact question and give your own recommendation.',
    'If not blocked, say in one line why it is safe to build exactly as scoped.',
    'You have read-only access. Do not edit any file; if you want to fix something, that is part of your reasoning, not an edit.',
    '',
    `--- ITEM ${item.id}: ${item.title} ---`,
    item.prompt,
  ].join('\n');
}

function buildPrompt(item) {
  return [
    item.prompt,
    '',
    'Additional instructions for this run:',
    'Work only inside your isolated worktree.',
    // B10: the last run's auditor had to discover this for itself. Your worktree branches from the
    // last COMMIT, so uncommitted work sitting in the main checkout is not here and you must not
    // assume it is. If your change touches a file that main has uncommitted edits to, say so in
    // leftOwed -- landing it is a manual reconciliation the owner does, not you.
    'Your worktree branches from committed HEAD. Any uncommitted work in the main checkout is NOT present here.',
    'If a file you touch also has uncommitted edits in the main checkout, name it in leftOwed as needing manual reconciliation.',
    // Untracked files are absent from a worktree entirely. An item that asks you to append to one
    // (a ledger, a board) cannot be done here -- write the exact text you would have appended into
    // leftOwed instead of inventing a file, and say which file it belongs in.
    'Files untracked in git do not exist in your worktree at all. If the item asks you to append to one, do NOT create it: put the exact text you would have appended into leftOwed, naming the file it belongs in.',
    'If the item prompt records an owner decision, implement exactly that decision - not your own preference, even if you would have chosen differently.',
    'Before you finish, run: git rev-parse --show-toplevel  -- and report that value as worktreePath.',
    'Run every gate command named under Hand back yourself and report the real output as gateOutput; set gatesGreen true only if every one of them actually passed.',
    'Run: git diff  -- in your worktree and report the full text as diff, plus the list of changed files.',
    'Never run git commit or git push.',
    'Touch only the files this item is scoped to; nothing else.',
  ].join('\n');
}

function auditPrompt(item, build) {
  return [
    'You are auditing a finished build, not trusting its own claim, per this repos AGENT-PRACTICES Part 4.',
    `The build ran in an isolated worktree at: ${build.worktreePath}`,
    'cd there first, using Bash, before checking anything.',
    'Re-run the gate commands yourself rather than trusting the builders report.',
    'Confirm the diff only touches the files this item was scoped to, and nothing else changed.',
    'Do not edit any file, in that worktree or anywhere else. If you find yourself wanting to fix something, that is a finding, not an edit.',
    '',
    'The items original prompt, for what is fixed, not in scope, and hand-back:',
    item.prompt,
    '',
    'The builders own report, as JSON:',
    JSON.stringify(build),
  ].join('\n');
}

function reviewPrompt(item) {
  return [
    item.prompt,
    '',
    'You have read-only access for this item; do not edit anything.',
    'Return your verdict as structured output.',
  ].join('\n');
}

async function runOneItem(item) {
  if (item.kind === 'review') {
    const review = await agent(reviewPrompt(item), {
      schema: REVIEW_SCHEMA,
      phase: 'Audit',
      label: `review:${item.id}`,
      model: tierToModel(item.model),
      // B5: a read-only reviewer was being spawned straight into the shared checkout with nothing
      // but "do not edit" to hold it there. model-routing.md is explicit that this does not hold.
      isolation: 'worktree',
    });
    return { item: item, kind: 'review', review: review };
  }

  const build = await agent(buildPrompt(item), {
    schema: BUILD_SCHEMA,
    phase: 'Build',
    label: `build:${item.id}`,
    model: tierToModel(item.model),
    isolation: 'worktree',
  });

  if (!build || !build.gatesGreen) {
    log(
      'Item ' + item.id + ': ' + (build ? 'gates did not pass' : 'builder returned nothing') +
        ' - skipping its audit.'
    );
    return { item: item, kind: 'build', build: build, audit: null };
  }

  const audit = await agent(auditPrompt(item, build), {
    schema: AUDIT_SCHEMA,
    phase: 'Audit',
    label: `audit:${item.id}`,
    model: tierToModel(item.model),
    // B5 again: the auditor cds into the build's worktree, but it still needs somewhere of its own
    // to stand so that a slip lands in a throwaway tree rather than in main.
    isolation: 'worktree',
  });

  return { item: item, kind: 'build', build: build, audit: audit };
}

phase('Triage');
log(`Triaging ${ITEMS.length} board items for genuine open decisions...`);

const triageResults = await parallel(
  ITEMS.map((item) => () =>
    agent(triagePrompt(item), {
      schema: TRIAGE_SCHEMA,
      phase: 'Triage',
      label: `triage:${item.id}`,
      model: triageModel(item),
      isolation: 'worktree',
    }).then((t) => ({ ...item, triage: t }))
  )
);

// B1: parallel() resolves a thrown thunk to null. The old loop went straight to t.triage and died
// with a TypeError on the whole sweep if a single triage agent errored out.
const triaged = triageResults.map((t, i) => (t ? t : { ...ITEMS[i], triage: null }));

const blocked = [];
const maybeReady = [];
for (const t of triaged) {
  if (!t.triage) {
    blocked.push({
      ...t,
      triage: {
        blocked: true,
        reasoning: 'triage agent returned no result',
        question: 'Triage could not be completed for this item; needs a human look before building.',
      },
    });
  } else if (t.triage.blocked) {
    blocked.push(t);
  } else {
    maybeReady.push(t);
  }
}

// B3/B4/B9. Every build runs in its OWN worktree cut from main, so a dependent item cannot see its
// dependency's output even when a lane orders them one after the other. Lane sequencing was an
// illusion of ordering: the only thing that actually makes a dependency visible to its dependent is
// LANDING it in main between sweeps. So an item is deferred whenever any item it waits on appears
// anywhere in this sweep -- ready, deferred or blocked alike.
//
// A dependency that is NOT in this sweep is presumed already landed and defers nothing; the old
// code had this backwards and would defer an item whose dependency had shipped weeks ago.
//
// This one rule subsumes what used to be two separate passes: the fixed point over transitively
// deferred dependencies, and the cross-lane check that stopped an item being built twice in two
// concurrent worktrees. Neither can arise once no ready item has an in-sweep dependency at all.
const inSweep = new Set(ITEMS.map((i) => i.id));
const blockedIds = new Set(blocked.map((b) => b.id));
const deferred = [];
const ready = [];
for (const item of maybeReady) {
  const deps = (item.waitsOn || []).filter((dep) => inSweep.has(dep));
  if (deps.length > 0) {
    deferred.push({
      ...item,
      unmet: deps,
      reason: deps.some((d) => blockedIds.has(d))
        ? 'waits on an item blocked on an owner decision'
        : 'waits on an item building in this same sweep, in a worktree of its own, so this build could not see its result - land that one first, then rerun this item',
    });
  } else {
    ready.push(item);
  }
}

log(
  blocked.length +
    ' blocked on a genuine decision, ' +
    deferred.length +
    ' deferred behind a dependency, ' +
    ready.length +
    ' clear to build.'
);
for (const b of blocked) log(`  blocked: ${b.id} - ${b.title}`);
for (const d of deferred) log(`  deferred: ${d.id} - waits on ${d.unmet.join(', ')} (${d.reason})`);

// There is deliberately no dependency sort here any more. Nothing in `ready` waits on anything
// else in this sweep -- the pass above guarantees it -- so ordering within a lane would be sorting
// by a relation that no longer holds between any two of them. Lanes still exist to serialize items
// that touch the same area of the codebase, which is what they were actually for.
const lanes = {};
ready.forEach((item) => {
  const lane = item.lane || 'A';
  if (!lanes[lane]) lanes[lane] = [];
  lanes[lane].push(item);
});

phase('Build');
const laneResults = await parallel(
  Object.keys(lanes).map((lane) => async () => {
    const out = [];
    for (const item of lanes[lane]) {
      log(`Lane ${lane}: starting item ${item.id} - ${item.title}`);
      out.push(await runOneItem(item));
    }
    return out;
  })
);

// B8: a lane whose thunk threw came back as null and went into results as a null entry.
const results = laneResults.filter(Boolean).flat().filter(Boolean);

return {
  blocked: blocked,
  deferred: deferred,
  results: results,
};
