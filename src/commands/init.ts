import { join, resolve, sep } from 'node:path';
import * as p from '@clack/prompts';
import { clackPrompter, defaultsPrompter, type Prompter } from '../lib/ask.ts';
import { loadConfig, personalAnswers, savedUserConfig } from '../lib/config.ts';
import { scanRepo } from '../lib/discover.ts';
import { exists, readdir, stat } from '../lib/disk.ts';
import { githubLogin, isGitRepo } from '../lib/git.ts';
import { hiddenByIgnore } from '../lib/hidden-tracked.ts';
import { claudeDir, configDir, configFile, expandHome, home } from '../lib/paths.ts';
import type { Answers, Cli, Config, ConfigLayer, RepoPlan } from '../lib/types.ts';
import { say, short } from '../lib/ui.ts';
import type { PlannedChange } from '../lib/write-plan.ts';
import { askPhase } from '../phases/run.ts';
import { finish, planEverything, planRepo, priorSource } from './setup.ts';

/** The three `you` answers that belong to the folder rather than the person (D4). */
const TRACK = ['work-kind', 'config-weight', 'uses-git'];
const TRACK_KEYS = ['workKind', 'configWeight', 'usesGit'] as const;

/**
 * The `you` answers outside `PERSONAL_ANSWERS` that shape only global files (PLAN §0 F3). They
 * still enter every stamp hash, so `init` takes them from the record `setup` left (D10) or its
 * stamps would differ from `setup`'s for the same folder.
 */
const RECORDED = ['outputStyle', 'chatStyle', 'writeDoc', 'writeDocCheck'];

/**
 * `personal-config init [path]`: one folder, set up with the person's saved answers, and nothing
 * outside it written (init-command D1, D2). The same `planRepo`, `planEverything` and `finish`
 * as `setup` (D8, BD-8), so a folder set up by either is the same bytes.
 */
export async function runInit(cli: Cli): Promise<number> {
  const target = resolve(expandHome(cli.paths[0] ?? process.cwd()));
  const refusal = await refusalFor(cli, target);
  if (refusal !== null) {
    say(refusal);
    return 1;
  }

  const interactive = process.stdin.isTTY === true && !cli.yes;
  const prompter: Prompter = interactive ? clackPrompter() : defaultsPrompter();
  if (interactive) p.intro('personal-config — init');
  else say('personal-config — init (non-interactive)');

  const saved = await savedUserConfig();
  const config = await loadConfig(cli, target);
  const answers = initAnswers(config, saved);
  await askPhase('you', prompter, answers, config, TRACK);
  const notice = trackNotice(answers, saved);
  if (notice !== null) say(notice);

  const plan = await planTarget(target, answers, config, prompter);
  await askPhase('practices', prompter, answers, config);
  const changes = insideOnly(
    await planEverything(config, answers, [plan], priorSource(cli, [plan])),
    target,
  );
  // `finish`'s outcome is not passed to `setup`'s `endRun`: `init` keeps no checkpoint, and
  // reaching its own end must not discard an unfinished `setup` run (BD-4, PLAN §0 F10).
  await finish(cli, changes, clackPrompter(), await hiddenByIgnore([plan], changes));
  return 0;
}

/**
 * Every refusal, before the first question and cheapest first (BD-2). None depends on another,
 * so the order only decides which one a person sees when two apply.
 */
async function refusalFor(cli: Cli, target: string): Promise<string | null> {
  return (
    ignoredFlag(cli) ??
    tooManyPaths(cli) ??
    (await notADirectory(target)) ??
    homeDirectory(target) ??
    (await projectsDirectory(target)) ??
    (await noSavedConfig())
  );
}

/** BD-6: flags are global (F6), so `setup`'s two would be accepted here and silently ignored. */
function ignoredFlag(cli: Cli): string | null {
  const flag = cli.from !== null ? 'from' : cli.projectsDir !== null ? 'projects-dir' : null;
  if (flag === null) return null;
  return `personal-config: init does not take --${flag}. It sets up one folder with your saved answers.`;
}

function tooManyPaths(cli: Cli): string | null {
  if (cli.paths.length <= 1) return null;
  return `personal-config: init sets up one folder, and was given ${cli.paths.length} paths.`;
}

async function notADirectory(target: string): Promise<string | null> {
  const found = await stat(target).catch(() => null);
  return found?.isDirectory() ? null : `personal-config: ${short(target)} is not a directory.`;
}

/** DIAL-3, always. The copy is `DESIGN.md` D11's. */
function homeDirectory(target: string): string | null {
  if (target !== resolve(home())) return null;
  return '`init` does not set up your home directory. Run it inside a project folder.';
}

/** DIAL-2: two or more git repos one level down is a projects directory, which is `setup`'s. */
async function projectsDirectory(target: string): Promise<string | null> {
  const entries = await readdir(target, { withFileTypes: true }).catch(() => []);
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
  const repos = await Promise.all(dirs.map((e) => isGitRepo(join(target, e.name))));
  const n = repos.filter(Boolean).length;
  if (n < 2) return null;
  const path = short(target);
  return `${path} holds ${n} git repos. \`init\` sets up one project. To set up all of them, run \`personal-config setup --projects-dir ${path}\`.`;
}

/** D3: without the saved answers there is no record of what is installed for this folder to name. */
async function noSavedConfig(): Promise<string | null> {
  if (await exists(configFile())) return null;
  return 'No saved answers found. Run `personal-config setup` once to set up your machine, then run `personal-config init` in each project.';
}

/**
 * BD-3: the folder's own file supplies the per-folder defaults (D5), and the person's answers come
 * from the saved config over it (D4). `loadConfig` puts the folder above the saved config, so an
 * old folder's copy of `commitPolicy` would otherwise beat the person's current one (F4).
 */
export function initAnswers(config: Config, saved: ConfigLayer): Answers {
  const recorded = saved.globalAnswers ?? {};
  const fromRecord = Object.fromEntries(
    RECORDED.flatMap((key) => (recorded[key] === undefined ? [] : [[key, recorded[key]]])),
  );
  return { ...config.answers, ...personalAnswers(saved.answers ?? {}), ...fromRecord };
}

/**
 * D6 and D11: said once, never asked, and nothing changes because of it. A `config.json` written
 * before D10 has no record to compare against, and then there is nothing to say.
 */
function trackNotice(answers: Answers, saved: ConfigLayer): string | null {
  const recorded = saved.globalAnswers;
  if (recorded === undefined) return null;
  const folder = trackName(answers);
  const global = trackName(recorded);
  if (folder === global) return null;
  return `This folder is set up as ${folder}; your global rules and skills were set up for ${global}. \`init\` leaves them as they are. Run \`personal-config setup\` to change them.`;
}

/** An absent answer reads as `trackOf`'s default, so a record missing a key is not a mismatch. */
function trackName(answers: Answers): string {
  const [kind, weight, git] = TRACK_KEYS.map((key) => answers[key]);
  return [kind ?? 'code', weight ?? 'full', git === 'no' ? 'no git' : 'git'].join(', ');
}

/**
 * BD-7 and BD-5. `admitsFolder` is not applied, because the person named this folder. A plain
 * folder is owned by definition (`planRepo`), so only a git target needs the login, and only a
 * git target makes the network call for it.
 */
export async function planTarget(
  target: string,
  answers: Answers,
  config: Config,
  prompter: Prompter,
): Promise<RepoPlan> {
  const kind = (await isGitRepo(target)) ? 'git' : 'folder';
  const scan = await scanRepo(target, kind);
  const login = kind === 'git' ? (config.identity.githubLogin ?? (await githubLogin())) : null;
  return planRepo(scan, login, answers, config, prompter);
}

/**
 * BD-1: `renderAll` runs unchanged and the plan keeps only what is inside the target, which drops
 * the global rules, skills, `/write-doc`, hooks, `settings.json` and `config.json` in one rule.
 *
 * The check after it is D2 rather than the filter restated: a target inside `~/.claude` would keep
 * its own files through the filter and still write there, so that is refused outright.
 */
export function insideOnly(changes: PlannedChange[], target: string): PlannedChange[] {
  const kept = changes.filter((change) => isUnder(change.file.path, target));
  const global = kept.filter(
    (c) => isUnder(c.file.path, claudeDir()) || isUnder(c.file.path, configDir()),
  );
  if (global.length > 0) {
    throw new Error(
      `init never writes ${short(claudeDir())}, and this run would write ${short(global[0]?.file.path ?? '')}`,
    );
  }
  return kept;
}

function isUnder(path: string, dir: string): boolean {
  const full = resolve(path);
  const root = resolve(dir);
  return full === root || full.startsWith(`${root}${sep}`);
}
