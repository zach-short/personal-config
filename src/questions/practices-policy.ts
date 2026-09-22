import type { PracticeArea, Question } from '../lib/types.ts';

/**
 * Four areas that are not language rules but owner policy — they render into Part 11 of the
 * adapted standard, which is the one part the standard itself marks as editable preference,
 * and into the short standard's `## Preferences`, which is that part's short-track counterpart.
 */

function question(id: string, ask: string, options: Question['options']): Question {
  return {
    id,
    phase: 'practices',
    kind: 'select',
    ask,
    options,
    readMore: id,
    configKey: `practices.${id}`,
  };
}

const COPY_REGISTERS: PracticeArea = {
  target: 'policy',
  languages: [],
  question: question('copy-registers', 'Who picks the words a user reads?', [
    {
      value: 'ask-three-registers',
      label: 'You do — the agent offers 2–3 variations',
      example: '"Couldn’t save" / "That didn’t go through — try again" / "Save failed"',
      recommended: true,
    },
    {
      value: 'agent-picks',
      label: 'The agent picks and tells you what it chose',
      example: 'Copy lands in the diff; you change it if you disagree',
    },
    { value: 'none', label: 'No rule', example: 'Copy is written like any other code' },
  ]),
  rule: () => null,
  policy: (value) => {
    if (value === 'none') return null;
    if (value === 'agent-picks') {
      return '**User-facing copy is written in the diff**, with the chosen wording named in the hand-back so it can be changed in one edit.';
    }
    return '**For user-facing copy, never pick silently.** Where a decision has not already fixed the words, write 2–3 real variations in different registers — plain, warm, terse — and ask which. Check first whether it is already settled; re-opening decided copy wastes the owner’s time.';
  },
};

const DRIVE_BY_FIXES: PracticeArea = {
  target: 'policy',
  languages: [],
  question: question('drive-by-fixes', 'What happens to an unrelated problem found mid-task?', [
    {
      value: 'note-and-raise',
      label: 'Note it and raise it — never fold it in',
      example: 'A typo found while fixing auth is reported, not committed with the auth fix',
      recommended: true,
    },
    {
      value: 'trivial-allowed',
      label: 'Trivial fixes may ride along if named in the hand-back',
      example: 'A one-line typo is fixed; the hand-back says it was',
    },
    { value: 'none', label: 'No rule', example: 'The agent decides what to fold in' },
  ]),
  rule: () => null,
  policy: (value) => {
    if (value === 'none') return null;
    if (value === 'trivial-allowed') {
      return '**Drive-by fixes are allowed only when trivial and named.** Anything beyond a typo or a dead import is a separate change; whatever rides along is listed in the hand-back.';
    }
    return '**No drive-by fixes.** Fix what the task is. Note anything else you find and raise it; do not fold it into an unrelated change. An unrelated change hides in the diff, and in its review.';
  },
};

/**
 * The non-coder's analogue of `commit-policy` (setup-tracks `DESIGN.md` D22). `commit-policy`
 * decides who takes the irreversible step in a repo and is asked only where git is in play, so
 * without this a non-coder is left with no rule about the irreversible step at all — and for a
 * document that is not in git, an edit in place is that step.
 *
 * It recommends the agent take that step, which nothing else here does. Two things outweigh the
 * consistency: the complaint this whole design exists for is an agent that replies with a plan
 * instead of doing the work (D15), which is what "show me first" makes the rule; and the harness
 * already supplies the veto that answer would add — `Write` and `Edit` prompt before touching a
 * file and refuse to overwrite one the session has not read. What no harness setting supplies is
 * the *ritual* around an edit — name it, never delete, move the old one aside — which is what the
 * recommended paragraph writes.
 */
const EDIT_POLICY: PracticeArea = {
  target: 'policy',
  languages: [],
  question: {
    ...question(
      'edit-policy',
      'When your agent changes a document, should it make the change, or show it to you first?',
      [
        {
          value: 'agent-edits',
          label: 'The agent edits, and names every change',
          example:
            'It changes the file, says which part and what it said before, and never deletes one',
          recommended: true,
        },
        {
          value: 'show-first',
          label: 'Show me first — I make the change',
          example: 'It writes the new wording in chat; you put it in',
        },
        {
          value: 'none',
          label: 'No rule',
          example: 'Nothing is written; the agent does what it would do by default',
        },
      ],
    ),
    when: { key: 'workKind', is: 'non-code' },
  },
  rule: () => null,
  policy: (value) => {
    if (value === 'none') return null;
    if (value === 'show-first') {
      return '**Changes to a document are shown, not made.** Write the new wording in chat — the file, the section, and the replacement in full — and leave the file where it is; the owner puts it in. This holds whether or not the work is in git: the owner asked for the step, and a version history is not what makes it worth keeping.';
    }
    return '**The agent makes the change.** Edit the document rather than describing the edit, then name every file changed in the hand-back and, for each, which section moved and what it said before. **Never delete a document, and never overwrite one you have not read this session:** move the old one aside, with the date in its name, and say where it went.';
  },
};

const COMMIT_POLICY: PracticeArea = {
  target: 'policy',
  languages: [],
  // Never re-asked: the `you` phase already settled it, and asking twice is how two
  // answers end up disagreeing. This area only renders what that answer implies.
  question: {
    ...question('commit-policy-practice', 'Who runs `git commit` in this repo?', [
      {
        value: 'inherit',
        label: 'As answered earlier',
        example: 'Uses your global commit policy',
      },
      { value: 'none', label: 'No rule here', example: 'This repo says nothing about commits' },
    ]),
    when: { never: true },
  },
  rule: () => null,
  policy: (value) => {
    if (value === 'no-rule' || value === 'none') return null;
    if (value === 'agent-commits') {
      return '**The agent may commit, never push.** Commit early, in small slices — after each leg lands, not once at the end. Never `git add -A`, never `git add .`: it sweeps up another session’s in-flight work. `git add -N` first for any file git has never seen — `--only` silently drops untracked paths, and the commit still typechecks. After a split commit, build HEAD in isolation before it is pushed: gates run against the working tree, so a partial commit can leave the branch unbuildable while the tree is green. Pushing is the owner’s.';
    }
    return '**Commits are the owner’s.** *Never run `git commit` or `git push`.* Several sessions run in one checkout and only the owner knows which uncommitted file belongs to which. When work is ready, run `git status --short`, then print exactly two copyable `bash` blocks, one command each: `git add <the exact files this session touched>` — never `-A`, never `.` — then `git commit <the same files> -m "<short, all lowercase>"`, because naming paths implies `--only` and a bare `git commit` sweeps in whatever another session has staged.';
  },
};

/**
 * `commit-policy-practice` stays last: it is the one area the short standard pulls *out* of
 * Preferences and into its git section, and Part 11 of the long standard has read it last since
 * 0.2.5. `edit-policy` sits beside the two house rules a non-coder actually answers.
 */
export const POLICY_AREAS: PracticeArea[] = [
  COPY_REGISTERS,
  DRIVE_BY_FIXES,
  EDIT_POLICY,
  COMMIT_POLICY,
];
