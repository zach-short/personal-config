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

/**
 * A question's condition, as data rather than a predicate. It is data because `catalog.json`
 * has to carry it to a browser that cannot serialize a closure (D6) — and because one
 * declarative form is the only way the catalog cannot drift from what the wizard asks.
 *
 * `all` is a conjunction, and nesting is allowed: `{ all: [spec, spec] }` holds when every
 * member holds. It exists because one question can need two conditions — `track-mode` is asked
 * only when the target is owned *and* git is in play (setup-tracks `DESIGN.md` D14/O3a) — and a
 * derived composite key was rejected because the browser has no repos to derive one from.
 *
 * `any:` and `not:` are deliberately absent: every form that crosses the npm pin costs a
 * publish, and neither has a caller (setup-tracks `DESIGN.md` §8).
 */
export type WhenSpec =
  /** Never asked: the value is derived elsewhere. */
  | { never: true }
  | { key: string; is: AnswerValue }
  | { key: string; isNot: AnswerValue }
  | { all: WhenSpec[] };

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
  /** Asked only when this matches the answers so far. Data, so the catalog can carry it. */
  when?: WhenSpec;
};

export type Answers = Record<string, AnswerValue>;

/** One question's long form, as `docs/choices/<id>.md` holds it. */
export type CatalogChoice = {
  id: string;
  body: string;
};

/**
 * What `bun run catalog` emits and the site pins (D6). A pin means the site can lag the wizard;
 * that is the point — alignment becomes a deliberate bump with a diff.
 */
export type Catalog = {
  catalogVersion: string;
  questions: Question[];
  choices: CatalogChoice[];
};

export type ModelTiers = {
  deep: string;
  default: string;
  fast: string;
};

/**
 * What discovery found a target to be. A git repo carries a remote, an exclude file and a
 * history; a plain folder carries none of the three, and a renderer that assumes otherwise
 * writes into a `.git` that is not there (setup-tracks `DESIGN.md` D5).
 */
export type TargetKind = 'git' | 'folder';

/** A repo found by discovery. Everything here is read off the disk, never asked. */
export type RepoScan = {
  path: string;
  name: string;
  /** Git repo or plain directory. Set by the scan, never asked, never inferred later. */
  kind: TargetKind;
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

/**
 * `n/a` is a folder target's answer, not a missing one (setup-tracks `DESIGN.md` DIAL-11).
 * There is no `.git/info/exclude` to write to, so the question has no referent and is never
 * asked — but it is recorded rather than left out, so a renderer reads a value that says *why*
 * there is no mode instead of an absence it has to guess at.
 */
export type TrackMode = 'tracked' | 'untracked' | 'n/a';

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
  /** `setup` only: a profile to start from — a local path, an https URL, or a short id. */
  from: string | null;
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
