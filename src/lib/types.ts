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
  /**
   * The opt-in fourth tier, below Mechanical (`model-tiers` DESIGN D1/D2). Required rather than
   * optional even though most people never set it: every other tier is empty-when-unasked too,
   * and an optional field would let a writer of this object forget the key instead of stating
   * that it is empty — the one failure mode a fourth tier's plumbing can have silently.
   */
  light: string;
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
  /**
   * The items folder this repo already keeps, one file per board item (per-item-board
   * `DESIGN.md` D1, D7), or null where there is none. A folder on disk is what makes a repo
   * 2.0.0 (D12), so `setup` reads it to keep a 1.x repo 1.x and a migrated one migrated.
   */
  itemsDoc: string | null;
  /** `ledgerFrozenAt` from the repo's config, which a re-run of `setup` must carry over (D5). */
  ledgerFrozenAt: number | null;
  /**
   * `gateCommand` and `archiveHome` from the repo's config, for the same reason: a re-run has no
   * answer for the first and may have an empty one for the second, and writing `""` over either
   * loses a value a person set by hand.
   */
  gateCommand: string | null;
  archiveHome: string | null;
  /**
   * The code standard this repo already keeps per language, as a repo-relative path, under
   * whatever name — `{ typescript: 'docs/conventions-ts.md' }` (standard §0.2). A language absent
   * here gets the default name.
   */
  conventionsDocs: Record<string, string>;
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
  /**
   * What proves work here is sound, in the owner's words (setup-tracks `DESIGN.md` D7); empty
   * until they write one. Per target, because it is a property of the work, not of the person.
   */
  proofLine: string;
  /**
   * What the agent must not read or copy here, in the owner's words (setup-tracks `DESIGN.md`
   * D23). Per target for the proof line's reason — it is a property of the work, not of the
   * person — and empty is a complete answer rather than an unanswered one.
   */
  offLimits: string;
  /**
   * Per-repo tier ceiling. 'deep' means no ceiling; 'default' or 'mechanical' caps the models
   * available in this repo via `.claude/settings.local.json`.
   */
  tierCeiling: 'deep' | 'default' | 'mechanical';
};

export type Config = {
  profile: string;
  identity: { githubLogin: string | null };
  models: ModelTiers;
  answers: Answers;
  projectsDir: string;
  archiveHome: string;
};

/**
 * One layer of `loadConfig`'s merge, as a document on disk is allowed to state it — narrowed
 * into this shape by `config-layer.ts` and by nothing else.
 *
 * Deliberately not `Partial<Config>`, which the layer readers claimed to return until
 * 2026-09-22. A layer may name one model tier and leave the other two to the layer below —
 * `mergeLayer` spreads both objects, and a `--from` document over a named profile is exactly
 * that case — but `Partial<Config>` makes only the top-level keys optional, so any `models` it
 * carried had to hold all three. The cast hid the difference; narrowing cannot.
 */
export type ConfigLayer = {
  profile?: string;
  identity?: Partial<Config['identity']>;
  models?: Partial<ModelTiers>;
  answers?: Answers;
  projectsDir?: string;
  archiveHome?: string;
  /**
   * `config.json` only: the `you` answers the global files were last rendered from (init-command
   * D10). A record, not a layer: `mergeLayer` never reads it, so it is never a default and never
   * reaches `configHash`. Absent from a file written before 2026-10-16.
   */
  globalAnswers?: Answers;
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
  /** `upgrade` only: also write `UPGRADE-PROMPT.md` at each target's root. */
  write: boolean;
  /** `fold` only: how many of the newest ledger steps keep their bodies. */
  keep: number;
  /** `fold` only: log lines older than this many days leave a migrated ledger (DIAL-4). */
  logDays: number;
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
  /**
   * JSON merge rather than overwrite (settings.json), or append (ignore files) — or
   * `mark-adapted`, which prepends the adapted stamp line in `contents` to a file that has none
   * and adds the marker to a stamp that lacks it, keeping every other byte. Only `doctor --fix`
   * plans that one, for a file whose own header says a Part 0 session rewrote it (D3).
   */
  strategy: 'overwrite' | 'merge-json' | 'append-lines' | 'mark-adapted';
  /**
   * Permission bits this file needs, absent where the filesystem default will do. Set for the
   * hook scripts, which `settings.json` registers by bare path: a `command` entry invoking a
   * 0644 file exits 126 rather than running (verified 2026-09-18), so the bit is the difference
   * between an installed hook and one that has never fired.
   */
  mode?: number;
  /**
   * Items a `merge-json` write removes after it merges `contents` (setup-hook-leftovers BD-3):
   * each `item` is taken out of the array at path `at`, matched by `sameJson`. Only `setup`
   * sets it, for the hook entries in `~/.claude/settings.json` that no target wants.
   *
   * A field and not a fifth strategy, because the file is still merged: a new strategy would need
   * its own branch in every reader of `strategy`, and `declinedHookHelp` would lose the merge it
   * reads. `contents` keeps holding additions only, so that help never prints a removal as an add.
   */
  prune?: Prune[];
  /**
   * How far a re-run may go with a stamped file already on disk (record-overwrite, 2026-10-16).
   * Absent is the stamp guard alone: a stamped file is replaced. `never` is a seed that becomes a
   * person's record once written, such as the ledger, the board and the archive index, which
   * later commands grow in place and never re-stamp. `if-unedited` replaces the file only where
   * its bytes are what this tool renders at its own stamp, for the router, the standard and the
   * conventions docs: files a later answer must still reach, and that a session may rewrite.
   *
   * A field and not a fifth strategy, for the reason `prune` gives: the file is still an
   * overwrite where it is written, and every reader of `strategy` would need a new branch.
   */
  replace?: 'never' | 'if-unedited';
  /**
   * A change the stamp guard admits whatever stamp the file carries. Set by `passoff claim`
   * alone: its edit is one cell of a row it parsed and one note line, so an `adapted` board is as
   * safe to claim on as any other. Without the mark the guard read the board's own stamp in the
   * edited contents, and on a board stamped `adapted` a claim printed "Claimed", wrote the item
   * note, and left the status cell `OPEN` (2026-10-16). `fold` and `archive` leave it unset on
   * purpose: they restructure a document, and an adapted one is the repo's own to restructure
   * (`tests/fold-items.test.ts`, "an adapted board holds the item whole").
   */
  inPlace?: true;
  /**
   * A line only an unadapted copy holds, so a file that still has it as a whole line is replaced
   * whatever else differs. The standard's `{{WORKTREE_SETUP}}`, alone in its fence: Part 0 fills
   * it, so a standard that still has that line was never adapted, and an older version of it
   * still takes the new one.
   */
  unadaptedMark?: string;
};

/** One item a `merge-json` write removes, and the path to the array that holds it. */
export type Prune = { at: string[]; item: unknown };

/** A global file a renderer can write, named the way that renderer labels it in the preview. */
export type GlobalFile = { path: string; label: string };

export type Finding = {
  rule: string;
  /** The standard's rule ID where one exists — `R1`, `§0.2` — else null. */
  standardId: string | null;
  file: string;
  line: number;
  message: string;
  fixable: boolean;
  /**
   * Present and true is the whole signal, the way `PlannedFile.mode` is: this finding is
   * reported and does not fail the run (stamp-provenance `DESIGN.md` D4). Only a standard-version
   * lag in an adapted file carries it — work to schedule rather than a defect in the repo, and
   * the one finding most likely to sit for weeks — and every other finding keeps its non-zero
   * exit by leaving it out.
   */
  advisory?: boolean;
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
