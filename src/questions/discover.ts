import type { Question } from '../lib/types.ts';

/**
 * Phase 2 — what is true of each repo. Only what a human knows is asked here; everything the
 * repo itself knows (gates, hazards, the directory map) is left to the Part 0 prompt.
 */
export const DISCOVER_QUESTIONS: Question[] = [
  {
    id: 'projects-dir',
    phase: 'discover',
    kind: 'text',
    // "projects", not "repos": this is the first question the terminal asks, and D11's finding
    // about the page title applies unchanged to it — four words that turn a non-coder away
    // before they have answered anything. The word is settled by citation rather than picked
    // here: the portfolio settled it on 2026-09-17 (setup-tracks `DESIGN.md` G30, D21), where
    // "where your work lives" and "repos and folders" were considered and rejected.
    ask: 'Which directory holds the projects you want to set up?',
    configKey: 'projectsDir',
    readMore: 'projects-dir',
    placeholder: '.',
  },
  {
    id: 'work-profile',
    phase: 'discover',
    kind: 'select',
    // "this project", the same settlement (G30). Asked only on code + full after item 56, so
    // the reader is a programmer — but their targets may still be a mix of repos and folders,
    // which is item 54's whole case, so "project" is the honest word here too (D21).
    ask: 'How does work arrive in this project?',
    configKey: 'workProfile',
    readMore: 'work-profile',
    options: [
      {
        value: 'ledger',
        label: 'A stream of mostly independent items',
        example: 'Fix a flaky test, add an endpoint, bump a dep — a ledger and a board',
        recommended: true,
      },
      {
        value: 'folders',
        label: 'A few big efforts that each span many sessions',
        example: 'One "checkout rewrite" folder: scope → design → plan → runtime pass',
        recommended: false,
      },
    ],
    // `workRecordShape` returns `ledger` for the whole short track whatever this says
    // (`src/render/context.ts`, which names stopping the question as the honest fix), so the
    // answer only reaches a rendered file on code *and* full. That is `isShortTrack`'s
    // "non-code or light" negated, written as a conjunction because `WhenSpec` has `all:` and
    // deliberately no `any:` (PASSOFF item 56).
    when: {
      all: [
        { key: 'workKind', is: 'code' },
        { key: 'configWeight', is: 'full' },
      ],
    },
  },
  {
    id: 'track-mode',
    phase: 'discover',
    kind: 'select',
    ask: 'Should these files be committed to this repo, or kept private to you?',
    configKey: 'trackMode',
    readMore: 'track-mode',
    options: [
      {
        value: 'tracked',
        label: 'Committed — it is my repo',
        example: '`HANDOFF.md` is in `git ls-files`; a teammate or a future you reads it',
        recommended: true,
      },
      {
        value: 'untracked',
        label: 'Private — git-ignored',
        example: 'A course fork or a client repo: files land in `.git/info/exclude`',
        recommended: false,
      },
    ],
    // Owned *and* git: the ownership guard was always the first half, and the git question
    // (setup-tracks `DESIGN.md` D4) is the second — there is no `.git/info/exclude` to write to
    // when the work is a plain folder, so the question has no referent. `owned` is derived from
    // the remote by `planRepo` and is `undefined` in a browser, which is why its half stays
    // `isNot: false` rather than `is: true`.
    when: {
      all: [
        { key: 'owned', isNot: false },
        { key: 'usesGit', is: 'yes' },
      ],
    },
  },
  {
    /**
     * The proof line (D7). It renders where "the gates are green" renders for a code repo, and
     * it is asked on every track rather than only the ones with no gates: the standard's own
     * rule is that a done-when which is only "gates pass" is not a done-when, which is as true
     * of a repo with CI as of a folder without. Conditioning it would need "non-code **or**
     * light", and `WhenSpec` has `all:` and deliberately no `any:`.
     */
    id: 'proof-line',
    phase: 'discover',
    kind: 'text',
    ask: 'What proves work here is sound?',
    configKey: 'proofLine',
    readMore: 'proof-line',
    placeholder:
      'e.g. the reconciliation balances to the bank statement, or someone who didn’t write it read it',
  },
  {
    /**
     * What the agent must not read or copy here (setup-tracks `DESIGN.md` D23). The only
     * question in the set about harm to somebody other than the owner: a folder of non-code
     * work is far likelier than a repo to hold other people's records, and until 2026-09-22
     * nothing asked (G37). Non-code only — a code repo's off-limits material has conventions
     * (`.gitignore`, `.env`) this would only restate, and the full router's `## Never do this`
     * is Part 0's to fill.
     *
     * Per target, and travelling exactly as the proof line does: asked into the per-target map,
     * carried on `RepoPlan`, laid over by `targetAnswers`. **Empty is a complete answer and
     * renders nothing** — no line, no row, no "none named". The proof line's empty renders
     * *"not yet written"* because writing one is a first session's job; nothing being off
     * limits is not a job.
     */
    id: 'off-limits',
    phase: 'discover',
    kind: 'text',
    ask: 'Is there anything here the agent must not read or copy?',
    configKey: 'offLimits',
    readMore: 'off-limits',
    placeholder: 'e.g. a folder of other people’s records — or leave this empty',
    when: { key: 'workKind', is: 'non-code' },
  },
  {
    id: 'archive-home',
    phase: 'discover',
    kind: 'text',
    ask: 'Where should closed work go when it leaves the repo?',
    configKey: 'archiveHome',
    readMore: 'archive-home',
    placeholder: '~/archive/<repo>/, or docs/archive/ to keep closed work in-tree',
    // `workRecordShape` returns `ledger` for the whole short track (`src/render/context.ts`)
    // and the short track never renders the long standard, so both of this answer's readers —
    // `renderFolders` and `renderArchiveIndex` (`src/render/repo.ts`) — are unreachable there:
    // it was asked, saved, and rendered into no document (setup-tracks `DESIGN.md` D26, G24).
    // The same spec as `work-profile` above, `isShortTrack` negated. Unasked, the key stays
    // empty, which `renderArchiveIndex` already reads as "no archive".
    when: {
      all: [
        { key: 'workKind', is: 'code' },
        { key: 'configWeight', is: 'full' },
      ],
    },
  },
  {
    id: 'mode',
    phase: 'discover',
    kind: 'select',
    ask: 'Does one person decide things here, or several?',
    configKey: 'mode',
    readMore: 'mode',
    options: [
      {
        value: 'solo',
        label: 'One person — me',
        example: 'Questions go to you in chat; the standard ships without its teams part',
        recommended: true,
      },
      {
        value: 'team',
        label: 'Several people merge code here',
        example: 'Questions go to a named decider on a tracker item, not into a doc',
        recommended: false,
      },
    ],
    // Both readers are out of reach on a short track: `src/render/repo.ts` reads `mode` only
    // inside the Part 0 prompt, which that track returns `null` for, and `src/render/standard.ts`
    // is the long standard, which it never writes (D26, G24). The same spec again. An unasked
    // `mode` reads as `solo` (`pickShared`, `src/commands/setup.ts`), which is what the short
    // standard already tells its reader — "The owner is the person who decides things here" —
    // and `tracker` below needs no condition of its own, because a `mode` that is not asked is
    // never `team`. Against, and recorded in D26: a non-code *team* is a real reader this makes
    // solo-only in its questions, as it already is in its documents.
    when: {
      all: [
        { key: 'workKind', is: 'code' },
        { key: 'configWeight', is: 'full' },
      ],
    },
  },
  {
    id: 'tracker',
    phase: 'discover',
    kind: 'text',
    ask: 'Where are items and decisions visible to the team?',
    configKey: 'tracker',
    readMore: 'tracker',
    placeholder: 'e.g. GitHub Issues on this repo',
    when: { key: 'mode', is: 'team' },
  },
  {
    id: 'tier-ceiling',
    phase: 'discover',
    kind: 'select',
    ask: 'What is the most expensive model this repo may run?',
    configKey: 'tierCeiling',
    readMore: 'tier-ceiling',
    options: [
      {
        value: 'deep',
        label: 'Deep — no ceiling (the default)',
        example: 'This repo can run any model you configure',
        recommended: true,
      },
      {
        value: 'default',
        label: 'Default',
        example: 'Deep-tier work is delegated to subagents; expensive operations are capped',
        recommended: false,
      },
      {
        value: 'mechanical',
        label: 'Mechanical',
        example: 'Only sweeps, renames, and mechanical work — no reasoning tiers',
        recommended: false,
      },
    ],
  },
];
