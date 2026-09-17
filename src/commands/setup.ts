import { spawn } from 'node:child_process';
import * as p from '@clack/prompts';
import {
  cancelMessage,
  cancelRun,
  checkpointing,
  clackPrompter,
  defaultsPrompter,
  type Prompter,
} from '../lib/ask.ts';
import { configHash, loadConfig, savedUserConfig } from '../lib/config.ts';
import { today } from '../lib/date.ts';
import { scanProjectsDir } from '../lib/discover.ts';
import { githubLogin, ownsRepo } from '../lib/git.ts';
import { configFile, expandHome } from '../lib/paths.ts';
import {
  clearCheckpoint,
  describeCheckpoint,
  type ResumeEntry,
  type RunOutcome,
  readCheckpoint,
  retiresCheckpoint,
} from '../lib/resume.ts';
import type { Answers, Cli, Config, RepoPlan, RepoScan, TrackMode } from '../lib/types.ts';
import { previewTree, renderDiff, say, short, targetList } from '../lib/ui.ts';
import { version } from '../lib/version.ts';
import { commitPlan, type PlannedChange, resolvePlan } from '../lib/write-plan.ts';
import { askPhase } from '../phases/run.ts';
import type { RenderContext } from '../render/context.ts';
import { declinedHookHelp } from '../render/hooks.ts';
import { renderAll } from '../render/index.ts';
import { standardVersion } from '../render/standard.ts';

export async function runSetup(cli: Cli): Promise<number> {
  const interactive = process.stdout.isTTY === true && !cli.yes;
  const asking: Prompter = interactive ? clackPrompter() : defaultsPrompter();

  if (interactive) p.intro('personal-config — setup');
  else say('personal-config — setup (non-interactive)');

  const config = await loadConfig(cli, null);
  const answers: Answers = { ...config.answers };
  await reportSaved();

  // Only a person can be interrupted mid-question; `--yes` has no run worth recovering.
  const prompter = interactive ? checkpointing(asking, await offerResume(asking)) : asking;

  await askPhase('you', prompter, answers, config);
  const repos = await chooseRepos(cli, config, answers, prompter, interactive);
  if (repos.length === 0) {
    say('No repos selected — global rules only.');
  }

  await askPhase('practices', prompter, answers, config);

  const changes = await planEverything(config, answers, repos);
  // The batch confirm is not one of the questions, so it must not ride on the question
  // prompter: under `--yes` that is `defaultsPrompter`, which would answer it `true` without a
  // person ever seeing it — a confirm in name only. `confirmBatch` returns early where there is
  // no TTY, so this is never asked of a terminal that is not there.
  return finish(cli, changes, clackPrompter());
}

/**
 * Saved answers are *offered*, never slipped in. They are already this run's defaults by the
 * time the first question is asked — they are a merge layer — so the only honest thing left is
 * to say so out loud, and where they came from, before the person starts confirming them.
 */
async function reportSaved(): Promise<void> {
  const saved = await savedUserConfig();
  const count = Object.keys(saved.answers ?? {}).length;
  if (count === 0) return;
  say(`Loaded ${count} saved answer(s) from ${short(configFile())} — this run's defaults.`);
}

/**
 * The one place that decides whether an unfinished run is picked up. Declining clears the
 * checkpoint: a run abandoned on purpose should not be offered back every time setup starts.
 */
async function offerResume(prompter: Prompter): Promise<ResumeEntry[]> {
  const offer = await readCheckpoint();
  if (offer.kind === 'stale') {
    say(
      `Discarded an unfinished run from v${offer.version} — its questions were a different set.`,
    );
    await clearCheckpoint();
    return [];
  }
  if (offer.kind === 'none') return [];

  const found = describeCheckpoint(offer.checkpoint);
  if (await prompter.confirm(`Pick up the run you left unfinished (${found})?`, true)) {
    return offer.checkpoint.entries;
  }
  await clearCheckpoint();
  return [];
}

async function chooseRepos(
  cli: Cli,
  config: Config,
  answers: Answers,
  prompter: Prompter,
  interactive: boolean,
): Promise<RepoPlan[]> {
  await askPhase('discover', prompter, answers, config, ['projects-dir']);
  const dir = cli.projectsDir ?? String(answers.projectsDir ?? config.projectsDir);
  const scans = await scanProjectsDir(dir);

  if (scans.length === 0) {
    // Not "no git repos": discovery looks for plain directories too now (D5), so naming only
    // the half that was searched would send someone off to `git init` a folder that qualifies.
    say(`No repos or folders found one level under ${short(expandHome(dir))}.`);
    return [];
  }

  say(targetList(scans, short(expandHome(dir))));

  const picked = interactive ? await pickRepos(scans) : scans.slice(0, 1);
  // Everything after this is asked once per repo under the same question ids, so a resumed run
  // that picked a different set here must stop replaying rather than answer for the wrong repo.
  await prompter.mark?.('repos', repoKey(picked));
  const login = config.identity.githubLogin ?? (await githubLogin());

  const plans: RepoPlan[] = [];
  for (const scan of picked) {
    plans.push(await planRepo(scan, login, answers, config, prompter));
  }
  return plans;
}

/** The picked set as one order-independent string, which is all a replay needs to compare. */
function repoKey(scans: RepoScan[]): string {
  return scans
    .map((s) => s.path)
    .sort()
    .join(',');
}

async function pickRepos(scans: RepoScan[]): Promise<RepoScan[]> {
  const chosen = await p.multiselect({
    message: 'Which repos should be set up?',
    // A folder says so in its hint: the list is otherwise name-only, and a folder's languages
    // and package manager are usually both empty, so nothing else here distinguishes the two.
    options: scans.map((s) => ({
      value: s.path,
      label: s.name,
      hint: [...(s.kind === 'folder' ? ['folder'] : []), ...s.languages].join(', '),
    })),
    required: false,
  });
  if (p.isCancel(chosen)) cancelRun();
  return scans.filter((s) => (chosen as string[]).includes(s.path));
}

/**
 * The ownership guard. A remote whose owner is not the signed-in login forces untracked mode
 * and the tracked question is never asked — writing a rule file into someone else's repo is
 * not a thing the user should have to remember to decline.
 *
 * **A plain folder is `owned`, and that is a decision rather than a fallthrough** (D5, and the
 * same class of problem DIAL-11 names). `ownsRepo(login, null)` answers `false` for a folder,
 * because a folder has no remote and `ownsRepo`'s contract is that ownership needs proof — but
 * that `false` would mean "someone else's", print `remote owner unknown ≠ you` at a directory
 * that has no remote to have an owner, and force a `trackMode` that DIAL-11 says has no
 * referent here. The evidence that makes a target *not* yours is a remote naming somebody
 * else, and a folder cannot acquire one. So the guard is answered rather than left to decide a
 * case it was not written for.
 *
 * `track-mode` is then skipped by id rather than by its `when`. Its condition is
 * `owned && usesGit` (D14), and `usesGit` is a fact about the *person* from the `you` phase —
 * true of them while still being false of this one target. A per-target derived key would have
 * to be read by the browser too, which has no filesystem to derive it from, so the skip lives
 * here, where the target is.
 *
 * Exported as an internal seam, not as API: DIAL-11's whole claim is about what is asked and
 * what is recorded for one target, and neither is observable from `runSetup`, which needs a
 * scanned directory and a terminal. Every input is already a parameter, `src/cli.ts` stays this
 * package's only public surface, and `tests/folder-targets.test.ts` is the caller.
 */
export async function planRepo(
  scan: RepoScan,
  login: string | null,
  answers: Answers,
  config: Config,
  prompter: Prompter,
): Promise<RepoPlan> {
  const folder = scan.kind === 'folder';
  const owned = folder ? true : ownsRepo(login, scan.remoteOwner);
  const perRepo: Answers = { ...answers, owned };

  if (scan.impliedProfile) {
    perRepo.workProfile = scan.impliedProfile;
    say(
      `  ${scan.name}: existing ${scan.existingDocs.join(', ')} — keeping that shape, not renaming.`,
    );
  }
  if (folder) {
    perRepo.trackMode = 'n/a';
    say(`  ${scan.name}: a folder, not a repo — nothing to track or exclude.`);
  }
  if (!owned) {
    perRepo.trackMode = 'untracked';
    say(
      `  ${scan.name}: remote owner ${scan.remoteOwner ?? 'unknown'} ≠ you — untracked mode.`,
    );
  }

  const unasked = folder ? ['projects-dir', 'track-mode'] : ['projects-dir'];
  await askPhase('discover', prompter, perRepo, config, undefined, unasked);
  Object.assign(answers, pickShared(perRepo));

  return {
    scan,
    workProfile: perRepo.workProfile === 'folders' ? 'folders' : 'ledger',
    trackMode: trackModeFor(perRepo, folder),
    archiveHome: archiveFor(perRepo, scan.name),
    owned,
  };
}

/** A folder's mode is settled by what it is, so no answer can have overwritten it (DIAL-11). */
function trackModeFor(perRepo: Answers, folder: boolean): TrackMode {
  if (folder) return 'n/a';
  return perRepo.trackMode === 'untracked' ? 'untracked' : 'tracked';
}

/** Answers that are about the person, not the repo, flow back so they are asked once. */
function pickShared(perRepo: Answers): Answers {
  return { mode: perRepo.mode ?? 'solo', tracker: perRepo.tracker ?? '' };
}

function archiveFor(answers: Answers, repoName: string): string {
  const raw = String(answers.archiveHome ?? '');
  return raw.replaceAll('<repo>', repoName);
}

async function planEverything(
  config: Config,
  answers: Answers,
  repos: RepoPlan[],
): Promise<PlannedChange[]> {
  const merged: Config = { ...config, answers, models: modelsFrom(answers, config) };
  const targets: (RepoPlan | null)[] = repos.length > 0 ? repos : [null];
  const contexts = await Promise.all(targets.map((repo) => contextFor(merged, answers, repo)));
  const planned = (await Promise.all(contexts.map(renderAll))).flat();
  return resolvePlan(dedupe(planned));
}

/**
 * One stamp per repo, not one per run, because `archiveHome` is resolved per repo — `<repo>`
 * becomes the repo's own name — and the resolved value is what `.personal-config.json` saves.
 * Hashing the unresolved profile template instead stamped every repo with a hash `doctor`
 * could never reproduce. Found 2026-09-15, and only by a profile carrying a real archive home:
 * where that answer is empty both forms are the empty string, and the bug hides.
 */
async function contextFor(
  merged: Config,
  answers: Answers,
  repo: RepoPlan | null,
): Promise<RenderContext> {
  const config: Config = repo ? { ...merged, archiveHome: repo.archiveHome } : merged;
  const stamp = {
    version: await version(),
    date: today(),
    configHash: await configHash(config),
    standardVersion: await standardVersion(),
  };
  return { config, answers, stamp, date: today(), repo };
}

/** Global files are produced once per repo context; the first wins, the rest are identical. */
function dedupe<T extends { path: string }>(files: T[]): T[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (seen.has(file.path)) return false;
    seen.add(file.path);
    return true;
  });
}

function modelsFrom(answers: Answers, config: Config): Config['models'] {
  return {
    deep: String(answers['models.deep'] ?? config.models.deep),
    default: String(answers['models.default'] ?? config.models.default),
    fast: String(answers['models.fast'] ?? config.models.fast),
  };
}

/**
 * The end of a run: preview, confirm, write — or decline and write nothing. The decline is the
 * one path that must never reach `commitPlan`, and it was the one path nothing drove end to end,
 * because a terminal run cannot be driven from a test: clack reads raw key input that a pipe
 * does not satisfy.
 *
 * So this carries an `export` it has no production caller for. It is an internal seam, not API —
 * the bin in `src/cli.ts` is this package's only public surface and nothing here widens it. No
 * restructuring was needed to open it: every input the decline depends on is already a
 * parameter, including the prompter, and the one thing it reads from the world outside them is
 * `process.stdout.isTTY`, which a test can define over. `tests/decline-seam.test.ts` is the
 * caller, and what it pins is that the confirm happens at all — see `confirmBatch` below.
 */
export async function finish(
  cli: Cli,
  changes: PlannedChange[],
  prompter: Prompter,
): Promise<number> {
  const real = changes.filter((c) => c.before !== c.after);
  const guarded = changes.filter((c) => c.guard === 'no-stamp');

  say('\nThis run would write:\n');
  say(previewTree(changes));
  const current = changes.length - real.length - guarded.length;
  say(`\n${real.length} file(s) to write, ${current} already current.`);
  if (guarded.length > 0) say(leftAlone(guarded));

  if (cli.dryRun) {
    say('\n--dry-run: nothing was written.');
    return endRun('dry-run');
  }
  if (real.length === 0) {
    say(guarded.length > 0 ? '\nNothing left to write.' : '\nEverything is already current.');
    return endRun('already-current');
  }

  // Declining the preview keeps the checkpoint on purpose, so say so rather than implying the
  // thirty answers behind this confirmation went with it.
  if (!(await confirmBatch(cli, real, prompter))) {
    say(cancelMessage());
    const hookHelp = declinedHookHelp(changes.map((c) => c.file.path));
    if (hookHelp !== null) say(hookHelp);
    return endRun('declined');
  }

  const result = await commitPlan(changes);
  say(`\nWrote ${result.written.length} file(s).`);
  if (result.manifest) {
    say(
      `Backed up ${result.manifest.entries.length} overwritten file(s) — \`personal-config undo\` restores them.`,
    );
  }
  await copyPart0(changes);
  return endRun('written');
}

/**
 * Every ending goes through one place, so which of them leaves a run to pick up is a single
 * decision rather than four scattered returns — which is how "already current" kept a
 * checkpoint and offered to resume a run that had reached its end (found 2026-09-15).
 */
async function endRun(outcome: RunOutcome): Promise<number> {
  if (retiresCheckpoint(outcome)) await clearCheckpoint();
  return 0;
}

/**
 * Named rather than counted. A file the stamp guard refused is the one outcome a person cannot
 * infer from what was written — it looks identical to "already current" in a total — and the
 * way out of it is a choice only they can make.
 */
function leftAlone(guarded: PlannedChange[]): string {
  return [
    `\n${guarded.length} file(s) left alone — no stamp, so this tool did not write them:`,
    ...guarded.map((c) => `  ${short(c.file.path)}`),
    'Delete one to have it generated fresh; leave it and no re-run will touch it.',
  ].join('\n');
}

/**
 * The gate in front of the batch write, and the only one — `finish` calls it unconditionally.
 *
 * `--force` skips it, and with no TTY there is nobody to ask, so the preview printed above is
 * the whole contract. That is the rule `confirmWrite` already states for `archive` and
 * `passoff`. `setup` was the one command that never read `--force` at all: it gated the confirm
 * on `interactive`, which is `isTTY && !cli.yes`. So `--yes` alone skipped this entirely —
 * contradicting its own help text, "still previews, still confirms" — and `--force` changed
 * nothing here at all. Both found 2026-09-17.
 *
 * It takes `cli` rather than a bare `force` so a test can drive real flag combinations through
 * it, and the prompter stays a parameter rather than a `clackPrompter()` reached for in here,
 * so the seam can be answered without a raw TTY.
 *
 * "Unconditionally" is the half of that first line that `tests/confirm-gate.test.ts` cannot see,
 * because it calls this directly: an `interactive &&` back in front of the call in `finish`
 * leaves every case there green. `tests/decline-seam.test.ts` is what pins it, by declining a
 * `--yes` run through `finish` — the exact combination the old gate let through unasked.
 */
export async function confirmBatch(
  cli: Cli,
  real: PlannedChange[],
  prompter: Prompter,
): Promise<boolean> {
  if (cli.force || process.stdout.isTTY !== true) return true;
  const seeDiffs = await prompter.confirm('Show the per-file diff first?', false);
  if (seeDiffs) {
    for (const change of real) {
      p.note(renderDiff(change), short(change.file.path));
    }
  }
  return prompter.confirm(`Write these ${real.length} file(s)?`, true);
}

/** `pbcopy` where it exists; the file is on disk either way, so failure is not an error. */
async function copyPart0(changes: PlannedChange[]): Promise<void> {
  const part0 = changes.find((c) => c.file.path.endsWith('PART0-PROMPT.md'));
  if (!part0) return;
  try {
    await toClipboard(part0.after);
    say(
      `\n${short(part0.file.path)} is on your clipboard — paste it into a fresh session in that repo.`,
    );
  } catch {
    say(`\nPaste ${short(part0.file.path)} into a fresh session in that repo.`);
  }
}

/**
 * Rejects rather than hanging when `pbcopy` is absent, which is every non-macOS machine: a
 * missing binary surfaces as an `error` event, not a throw from `spawn`, so the caller's
 * `try/catch` only sees it because this waits on both events.
 */
async function toClipboard(text: string): Promise<void> {
  const proc = spawn('pbcopy', { stdio: ['pipe', 'ignore', 'ignore'] });
  const finished = new Promise<void>((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`pbcopy exited ${code}`)),
    );
  });
  proc.stdin?.end(text);
  await finished;
}
