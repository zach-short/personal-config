import type { Answers, Question } from '../lib/types.ts';

/**
 * Phase 2 — what is true of each repo. Only what a human knows is asked here; everything the
 * repo itself knows (gates, hazards, the directory map) is left to the Part 0 prompt.
 */
export const DISCOVER_QUESTIONS: Question[] = [
  {
    id: 'projects-dir',
    phase: 'discover',
    kind: 'text',
    ask: 'Which directory holds the repos you want to set up?',
    configKey: 'projectsDir',
    readMore: 'projects-dir',
    placeholder: '~/Projects',
  },
  {
    id: 'work-profile',
    phase: 'discover',
    kind: 'select',
    ask: 'How does work arrive in this repo?',
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
    when: (answers: Answers) => answers.owned !== false,
  },
  {
    id: 'archive-home',
    phase: 'discover',
    kind: 'text',
    ask: 'Where should closed work go when it leaves the repo?',
    configKey: 'archiveHome',
    readMore: 'archive-home',
    placeholder: '~/Projects/archive/<repo>/, or docs/archive/ to keep closed work in-tree',
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
  },
  {
    id: 'tracker',
    phase: 'discover',
    kind: 'text',
    ask: 'Where are items and decisions visible to the team?',
    configKey: 'tracker',
    readMore: 'tracker',
    placeholder: 'e.g. GitHub Issues on this repo',
    when: (answers: Answers) => answers.mode === 'team',
  },
];
