/**
 * The shapes every phase shares. Questions are data, not control flow: a phase picks which
 * questions to ask, the runner asks them, and renderers read the answers. That split is what
 * lets the whole wizard run non-interactively in tests, where no terminal exists.
 */

export type Phase = 'you' | 'discover' | 'practices' | 'render';

export type AnswerValue = string | boolean | string[];

/** One selectable answer. `example` is the practical one-liner clack shows as a hint. */
export type QuestionOption = {
  value: string;
  label: string;
  example: string;
  recommended?: boolean;
};

export type QuestionKind = 'select' | 'multiselect' | 'text' | 'confirm';

export type Question = {
  id: string;
  phase: Phase;
  kind: QuestionKind;
  /** The one-line question. */
  ask: string;
  options?: QuestionOption[];
  /** Placeholder for `text` questions. */
  placeholder?: string;
  /** Long form lives at `docs/choices/<readMore>.md`; the `Read more…` option prints it. */
  readMore: string;
  /** Dotted path into the config this question reads its default from and writes back to. */
  configKey: string;
  /** Asked only when this returns true for the answers so far. */
  when?: (answers: Answers) => boolean;
};

export type Answers = Record<string, AnswerValue>;

export type ModelTiers = {
  deep: string;
  default: string;
  fast: string;
};

/** A repo found by discovery. Everything here is read off the disk, never asked. */
export type RepoScan = {
  path: string;
  name: string;
  languages: string[];
  packageManager: string | null;
  hasCi: boolean;
  migrations: string[];
  existingDocs: string[];
  /** The ledger and board this repo already keeps, under whatever name (standard §0.2). */
  ledgerDoc: string | null;
  boardDoc: string | null;
  worktrees: number;
  remoteOwner: string | null;
  /** Set when an existing ledger/board/project-folder fixes the profile (standard §0.2). */
  impliedProfile: WorkProfile | null;
};

export type WorkProfile = 'ledger' | 'folders';

export type TrackMode = 'tracked' | 'untracked';

/** Per-repo answers, merged from discovery plus the `discover` phase's questions. */
export type RepoPlan = {
  scan: RepoScan;
  workProfile: WorkProfile;
  trackMode: TrackMode;
  archiveHome: string;
  owned: boolean;
};

export type Config = {
  profile: string;
  identity: { githubLogin: string | null };
  models: ModelTiers;
  answers: Answers;
  projectsDir: string;
  archiveHome: string;
};

export type Cli = {
  command: string;
  profile: string;
  yes: boolean;
  dryRun: boolean;
  force: boolean;
  fix: boolean;
  /** `archive` only: perform the move as well as planning it. */
  move: boolean;
  projectsDir: string | null;
  /** `context` only: the phrase that proves a transcript is this conversation. */
  sentinel: string | null;
  paths: string[];
};

/** One file the run intends to write. Nothing is written until the whole batch is confirmed. */
export type PlannedFile = {
  path: string;
  contents: string;
  /** What this file is, in the preview tree. */
  label: string;
  /** JSON merge rather than overwrite (settings.json), or append (ignore files). */
  strategy: 'overwrite' | 'merge-json' | 'append-lines';
};

export type Finding = {
  rule: string;
  /** The standard's rule ID where one exists — `R1`, `§0.2` — else null. */
  standardId: string | null;
  file: string;
  line: number;
  message: string;
  fixable: boolean;
};

/** One rule as the standard's §8.1 shape requires: ID, enforcement tag, pair, provenance. */
export type ConventionRule = {
  id: string;
  title: string;
  body: string;
  /** lint · gate · CI · review — tells a reader whether a clean run means anything. */
  enforcement: 'lint' | 'gate' | 'CI' | 'review';
  provenance: 'STANDARD' | 'COMMON' | 'OURS';
  correct: string;
  incorrect: string;
};

/**
 * A practice area is a question plus what its answer renders into. Keeping the two together
 * is what stops the catalog drifting from the files it produces.
 */
export type PracticeArea = {
  question: Question;
  target: 'conventions' | 'policy';
  /** Empty means every language; otherwise only these get the rule. */
  languages: string[];
  rule: (value: string, language: string) => ConventionRule | null;
  /** For `policy` areas: the Part 11 paragraph this answer produces. */
  policy?: (value: string) => string | null;
};
