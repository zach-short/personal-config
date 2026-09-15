import * as p from '@clack/prompts';
import { clackPrompter, defaultsPrompter, type Prompter } from '../lib/ask.ts';
import { configHash, loadConfig } from '../lib/config.ts';
import { today } from '../lib/date.ts';
import { scanProjectsDir } from '../lib/discover.ts';
import { githubLogin, ownsRepo } from '../lib/git.ts';
import { expandHome } from '../lib/paths.ts';
import type { Answers, Cli, Config, RepoPlan, RepoScan } from '../lib/types.ts';
import { previewTree, renderDiff, say, short } from '../lib/ui.ts';
import { version } from '../lib/version.ts';
import { commitPlan, type PlannedChange, resolvePlan } from '../lib/write-plan.ts';
import { askPhase } from '../phases/run.ts';
import type { RenderContext } from '../render/context.ts';
import { renderAll } from '../render/index.ts';
import { standardVersion } from '../render/standard.ts';

export async function runSetup(cli: Cli): Promise<number> {
  const interactive = process.stdout.isTTY === true && !cli.yes;
  const prompter: Prompter = interactive ? clackPrompter() : defaultsPrompter();

  if (interactive) p.intro('personal-config — setup');
  else say('personal-config — setup (non-interactive)');

  const config = await loadConfig(cli, null);
  const answers: Answers = { ...config.answers };

  await askPhase('you', prompter, answers, config);
  const repos = await chooseRepos(cli, config, answers, prompter, interactive);
  if (repos.length === 0) {
    say('No repos selected — global rules only.');
  }

  await askPhase('practices', prompter, answers, config);

  const changes = await planEverything(config, answers, repos);
  return finish(cli, changes, prompter, interactive);
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
    say(`No git repos found one level under ${short(expandHome(dir))}.`);
    return [];
  }

  say(`\nFound ${scans.length} repo(s) under ${short(expandHome(dir))}:\n`);
  say(repoTable(scans));

  const picked = interactive ? await pickRepos(scans) : scans.slice(0, 1);
  const login = config.identity.githubLogin ?? (await githubLogin());

  const plans: RepoPlan[] = [];
  for (const scan of picked) {
    plans.push(await planRepo(scan, login, answers, config, prompter));
  }
  return plans;
}

function repoTable(scans: RepoScan[]): string {
  const rows = scans.map((s) => {
    const langs = s.languages.join('+') || '—';
    const docs = s.existingDocs.length > 0 ? s.existingDocs.join(',') : '—';
    return `  ${s.name.padEnd(22)} ${langs.padEnd(18)} ${(s.packageManager ?? '—').padEnd(6)} ${
      s.hasCi ? 'CI' : '  '
    }  ${docs}`;
  });
  return [
    `  ${'repo'.padEnd(22)} ${'languages'.padEnd(18)} ${'pm'.padEnd(6)}      existing`,
    ...rows,
  ].join('\n');
}

async function pickRepos(scans: RepoScan[]): Promise<RepoScan[]> {
  const chosen = await p.multiselect({
    message: 'Which repos should be set up?',
    options: scans.map((s) => ({ value: s.path, label: s.name, hint: s.languages.join(', ') })),
    required: false,
  });
  if (p.isCancel(chosen)) {
    p.cancel('Nothing was written.');
    process.exit(0);
  }
  return scans.filter((s) => (chosen as string[]).includes(s.path));
}

/**
 * The ownership guard. A remote whose owner is not the signed-in login forces untracked mode
 * and the tracked question is never asked — writing a rule file into someone else's repo is
 * not a thing the user should have to remember to decline.
 */
async function planRepo(
  scan: RepoScan,
  login: string | null,
  answers: Answers,
  config: Config,
  prompter: Prompter,
): Promise<RepoPlan> {
  const owned = ownsRepo(login, scan.remoteOwner);
  const perRepo: Answers = { ...answers, owned };

  if (scan.impliedProfile) {
    perRepo.workProfile = scan.impliedProfile;
    say(
      `  ${scan.name}: existing ${scan.existingDocs.join(', ')} — keeping that shape, not renaming.`,
    );
  }
  if (!owned) {
    perRepo.trackMode = 'untracked';
    say(
      `  ${scan.name}: remote owner ${scan.remoteOwner ?? 'unknown'} ≠ you — untracked mode.`,
    );
  }

  await askPhase('discover', prompter, perRepo, config, undefined, ['projects-dir']);
  Object.assign(answers, pickShared(perRepo));

  return {
    scan,
    workProfile: perRepo.workProfile === 'folders' ? 'folders' : 'ledger',
    trackMode: perRepo.trackMode === 'untracked' ? 'untracked' : 'tracked',
    archiveHome: archiveFor(perRepo, scan.name),
    owned,
  };
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
  const stamp = {
    version: await version(),
    date: today(),
    configHash: await configHash(merged),
    standardVersion: await standardVersion(),
  };

  const contexts: RenderContext[] = repos.length
    ? repos.map((repo) => ({ config: merged, answers, stamp, date: today(), repo }))
    : [{ config: merged, answers, stamp, date: today(), repo: null }];

  const planned = (await Promise.all(contexts.map(renderAll))).flat();
  return resolvePlan(dedupe(planned));
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

async function finish(
  cli: Cli,
  changes: PlannedChange[],
  prompter: Prompter,
  interactive: boolean,
): Promise<number> {
  const real = changes.filter((c) => c.before !== c.after);

  say('\nThis run would write:\n');
  say(previewTree(changes));
  say(`\n${real.length} file(s) to write, ${changes.length - real.length} already current.`);

  if (cli.dryRun) {
    say('\n--dry-run: nothing was written.');
    return 0;
  }
  if (real.length === 0) {
    say('\nEverything is already current.');
    return 0;
  }

  if (interactive && !(await confirmBatch(real, prompter))) {
    say('Nothing was written.');
    return 0;
  }

  const result = await commitPlan(changes);
  say(`\nWrote ${result.written.length} file(s).`);
  if (result.manifest) {
    say(
      `Backed up ${result.manifest.entries.length} overwritten file(s) — \`personal-config undo\` restores them.`,
    );
  }
  await copyPart0(changes);
  return 0;
}

async function confirmBatch(real: PlannedChange[], prompter: Prompter): Promise<boolean> {
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
    const proc = Bun.spawn(['pbcopy'], { stdin: 'pipe' });
    proc.stdin.write(part0.after);
    await proc.stdin.end();
    await proc.exited;
    say(
      `\n${short(part0.file.path)} is on your clipboard — paste it into a fresh session in that repo.`,
    );
  } catch {
    say(`\nPaste ${short(part0.file.path)} into a fresh session in that repo.`);
  }
}
