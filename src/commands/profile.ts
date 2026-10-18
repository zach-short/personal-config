import { resolve } from 'node:path';
import { clackPrompter, defaultsPrompter, type Prompter } from '../lib/ask.ts';
import { loadConfig, savedUserConfig } from '../lib/config.ts';
import { scanProjectsDir } from '../lib/discover.ts';
import { stat } from '../lib/disk.ts';
import type { Flow, FrameMenu, MenuItem, SetupFrame } from '../lib/frame.ts';
import { contractHome, expandHome, home } from '../lib/paths.ts';
import { findPreset, PRESETS, type Preset, suggestedName } from '../lib/profile-presets.ts';
import {
  CEILING_IDS,
  ceilingOf,
  FOLDER_ONLY_IDS,
  findProfile,
  listProfiles,
  nameProblem,
  profileAnswers,
  profilePath,
  profileText,
  slugOf,
  TRACK_IDS,
  type UserProfile,
  withFolders,
} from '../lib/profiles.ts';
import type { Answers, Cli } from '../lib/types.ts';
import { say, short } from '../lib/ui.ts';
import { type PlannedChange, resolvePlan, resolveRemoval } from '../lib/write-plan.ts';
import { askPhase } from '../phases/run.ts';
import { plannedRecord } from '../render/context.ts';
import { initAnswers, insideOnly, planTarget } from './init.ts';
import { finish, planEverything, priorSource } from './setup.ts';

const STEP = {
  profile: 0,
  work: 1,
  ceiling: 2,
  folder: 3,
  practices: 4,
  folders: 5,
  review: 6,
  write: 7,
  done: 8,
};

/** The rail every `profile` screen draws on. */
export const PROFILE_FLOW: Flow = {
  view: 'profile',
  steps: [
    'Profile',
    'The work',
    'Model ceiling',
    'Each folder',
    'Practices',
    'Folders',
    'Review',
    'Write',
    'Done',
  ],
  stepOf: (q) => {
    if (CEILING_IDS.includes(q.id)) return STEP.ceiling;
    if (q.phase === 'you') return STEP.work;
    return q.phase === 'discover' ? STEP.folder : STEP.practices;
  },
  repo: null,
  pick: STEP.folders,
  review: STEP.review,
  write: STEP.write,
  done: STEP.done,
  doneTitle: 'Profiles are saved',
  next: [
    ['personal-config profile', 'make, change or apply another profile'],
    ['personal-config doctor <folder>', 'check what was written'],
    ['personal-config undo', 'put back what the last write changed'],
  ],
};

const USAGE = [
  'personal-config profile                         pick, make, change and apply profiles',
  'personal-config profile list                    the saved profiles and their folders',
  'personal-config profile new <name> [preset]     save one (presets: light, medium, heavy, writing)',
  'personal-config profile apply <name> <folder…>  set up folders from a profile, in one batch',
  'personal-config profile delete <name>           remove a profile; its folders keep their files',
].join('\n');

/**
 * `personal-config profile`. With a frame it is the manager: a list of profiles, and for each
 * one apply, change or delete. Without one, each action is a subcommand that asks nothing.
 */
export async function runProfile(cli: Cli, frame?: SetupFrame): Promise<number> {
  const [action, name, ...paths] = cli.paths;
  if (action === undefined) return frame ? manage(cli, frame) : list();
  if (action === 'list') return list();
  if (action === 'new')
    return frame ? create(cli, frame, name) : createQuietly(cli, name, paths[0]);
  if (action === 'apply') return applyNamed(cli, frame, name, paths);
  if (action === 'edit') return frame ? editNamed(cli, frame, name) : needsTerminal('edit');
  if (action === 'delete') return remove(cli, frame, name);
  say(`personal-config: profile does not know '${action}'.\n\n${USAGE}`);
  return 1;
}

function needsTerminal(action: string): number {
  say(
    `personal-config: profile ${action} asks questions, so it needs a terminal and no --yes.`,
  );
  return 1;
}

async function list(): Promise<number> {
  const { profiles, problems } = await listProfiles();
  if (profiles.length === 0)
    say('No profiles saved yet. Run `personal-config profile new <name>`.');
  for (const profile of profiles) {
    const about = `${ceilingOf(profile.answers)}, ${folderCount(profile)}`;
    say(`${slugOf(profile.name).padEnd(20)} ${profile.name} — ${about}`);
    for (const folder of profile.folders) say(`  ${folder}`);
  }
  for (const problem of problems) say(`✖ ${problem}`);
  return problems.length > 0 ? 1 : 0;
}

function folderCount(profile: UserProfile): string {
  const n = profile.folders.length;
  return n === 1 ? '1 folder' : `${n} folders`;
}

/** The manager's loop: the list, then what to do with the one picked, until Done. */
async function manage(cli: Cli, frame: SetupFrame): Promise<number> {
  for (;;) {
    frame.menu.at(STEP.profile);
    const { profiles, problems } = await listProfiles();
    for (const problem of problems) say(`✖ ${problem}`);
    const choice = await frame.menu.choose('Your profiles', mainItems(profiles));
    if (choice === 'done') return 0;
    if (choice === 'new') await create(cli, frame);
    const picked = profiles.find((p) => slugOf(p.name) === choice);
    if (picked) await profileActions(cli, frame, picked);
  }
}

function mainItems(profiles: UserProfile[]): MenuItem[] {
  return [
    ...profiles.map((p) => ({
      value: slugOf(p.name),
      label: `${p.name}  ·  ${ceilingOf(p.answers)}  ·  ${folderCount(p)}`,
      hint: p.description,
    })),
    {
      value: 'new',
      label: '+ New profile',
      hint: 'start from Light, Medium, Heavy or your own',
    },
    { value: 'done', label: 'Done' },
  ];
}

async function profileActions(
  cli: Cli,
  frame: SetupFrame,
  profile: UserProfile,
): Promise<void> {
  const action = await frame.menu.choose(`${profile.name}: what now?`, [
    { value: 'apply', label: 'Apply to folders', hint: 'pick folders, preview, write once' },
    { value: 'edit', label: 'Change its answers', hint: 'then re-apply to its folders' },
    { value: 'delete', label: 'Delete it', hint: 'folders keep the files it wrote' },
    { value: 'back', label: '← back' },
  ]);
  if (action === 'apply') await applyChosen(cli, frame, profile, []);
  if (action === 'edit') await edit(cli, frame, profile);
  if (action === 'delete') await remove(cli, frame, profile.name);
}

/** New: a starting point, a name, the questions (or the preset as it is), then folders. */
async function create(cli: Cli, frame: SetupFrame, given?: string): Promise<number> {
  const { profiles } = await listProfiles();
  const taken = profiles.map((p) => slugOf(p.name));
  const start = await startingPoint(frame.menu, profiles);
  const name = await askName(frame.menu, given ?? suggestion(start, taken), taken);
  const description = 'preset' in start ? start.preset.description : '';
  const answers = await maybeAsk(cli, frame, start);
  const profile: UserProfile = { name, description, answers, folders: [] };
  return applyChosen(cli, frame, profile, []);
}

type Start = { preset: Preset } | { copy: UserProfile } | { blank: true };

async function startingPoint(menu: FrameMenu, profiles: UserProfile[]): Promise<Start> {
  const choice = await menu.choose('Start the new profile from', [
    ...PRESETS.map((p) => ({ value: `preset:${p.id}`, label: p.name, hint: p.description })),
    ...profiles.map((p) => ({ value: `copy:${slugOf(p.name)}`, label: `A copy of ${p.name}` })),
    { value: 'blank', label: 'The recommended answers', hint: 'every question at its default' },
  ]);
  const preset = findPreset(choice.replace(/^preset:/, ''));
  if (preset) return { preset };
  const copy = profiles.find((p) => `copy:${slugOf(p.name)}` === choice);
  return copy ? { copy } : { blank: true };
}

function suggestion(start: Start, taken: string[]): string {
  if ('preset' in start) return suggestedName(start.preset, taken);
  if ('copy' in start) return `${start.copy.name} copy`;
  return 'My setup';
}

async function askName(menu: FrameMenu, initial: string, taken: string[]): Promise<string> {
  const validate = (value: string) => quickProblem(value, taken);
  for (;;) {
    const name = (await menu.text('Name this profile', { initial, validate })).trim();
    const problem = await nameProblem(name, taken);
    if (problem === null) return name;
    say(problem);
  }
}

/** The checks a keystroke can run without the disk; `nameProblem` runs the rest after enter. */
function quickProblem(value: string, taken: string[]): string | null {
  if (slugOf(value) === '') return 'Give the profile a name with a letter or digit.';
  return taken.includes(slugOf(value)) ? 'That name is taken.' : null;
}

async function maybeAsk(cli: Cli, frame: SetupFrame, start: Start): Promise<Answers> {
  const base =
    'preset' in start ? start.preset.answers : 'copy' in start ? start.copy.answers : {};
  if (!('blank' in start)) {
    const how = await frame.menu.choose('Use these answers as they are?', [
      { value: 'keep', label: 'Yes, use them as they are' },
      { value: 'ask', label: 'No, go through the questions', hint: 'each one starts at them' },
    ]);
    if (how === 'keep') return askProfile(cli, defaultsPrompter(), base);
  }
  return askProfile(cli, frame.ask, base);
}

/**
 * The profile's questions, from `base` over the saved and recommended answers. The `you` phase
 * asks only the three track questions, then the model ceiling, then the rest of `discover`
 * without what is each folder's own.
 */
export async function askProfile(
  cli: Cli,
  prompter: Prompter,
  base: Answers,
): Promise<Answers> {
  const config = await loadConfig({ ...cli, from: null }, null);
  const answers: Answers = { ...config.answers, ...base };
  await askPhase('you', prompter, answers, config, TRACK_IDS);
  await askPhase('discover', prompter, answers, config, CEILING_IDS);
  const asked = [...FOLDER_ONLY_IDS, ...CEILING_IDS];
  await askPhase('discover', prompter, answers, config, undefined, asked);
  await askPhase('practices', prompter, answers, config);
  return profileAnswers(answers);
}

async function edit(cli: Cli, frame: SetupFrame, profile: UserProfile): Promise<number> {
  const answers = await askProfile(cli, frame.ask, profile.answers);
  return applyChosen(cli, frame, { ...profile, answers }, profile.folders);
}

async function editNamed(
  cli: Cli,
  frame: SetupFrame,
  name: string | undefined,
): Promise<number> {
  const profile = await named(name);
  return profile ? edit(cli, frame, profile) : 1;
}

/** Folders to apply to, the ones `ticked` checked; then the save and every folder in one batch. */
async function applyChosen(
  cli: Cli,
  frame: SetupFrame,
  profile: UserProfile,
  ticked: string[],
): Promise<number> {
  frame.menu.at(STEP.folders);
  const items = await folderItems(cli, ticked);
  const ask = `Which folders get ${profile.name}? Leave all unticked to only save it.`;
  const folders = await frame.menu.many(ask, items, ticked.map(expandHome));
  return applyTo(cli, frame.confirm, profile, folders);
}

/**
 * The folders under the projects folder, the working folder, and every folder the profile was
 * applied to before, each once. A folder outside these is named on the command line instead.
 */
async function folderItems(cli: Cli, ticked: string[]): Promise<MenuItem[]> {
  const config = await loadConfig({ ...cli, from: null }, null);
  const dir = cli.projectsDir ?? String(config.answers.projectsDir ?? config.projectsDir);
  const scans = await scanProjectsDir(dir).catch(() => []);
  const paths = [process.cwd(), ...ticked.map(expandHome), ...scans.map((s) => s.path)];
  const usable = await Promise.all([...new Set(paths)].map(isTarget));
  return [...new Set(paths)]
    .filter((_, i) => usable[i])
    .map((path) => ({ value: path, label: short(path), hint: hintFor(path, scans) }));
}

function hintFor(path: string, scans: Awaited<ReturnType<typeof scanProjectsDir>>): string {
  if (path === process.cwd()) return 'the folder you are in';
  const scan = scans.find((s) => s.path === path);
  return scan ? [scan.kind === 'folder' ? 'folder' : 'git', ...scan.languages].join(', ') : '';
}

async function isTarget(path: string): Promise<boolean> {
  if (resolve(path) === resolve(home())) return false;
  const found = await stat(path).catch(() => null);
  return found?.isDirectory() === true;
}

async function applyNamed(
  cli: Cli,
  frame: SetupFrame | undefined,
  name: string | undefined,
  paths: string[],
): Promise<number> {
  if (name === undefined && frame) return applyHere(cli, frame);
  const profile = await named(name);
  if (profile === null) return 1;
  if (paths.length === 0 && frame) return applyChosen(cli, frame, profile, profile.folders);
  const targets = paths.map((path) => resolve(expandHome(path)));
  const refused = await refusals(targets);
  if (refused.length > 0) {
    for (const line of refused) say(line);
    return 1;
  }
  return applyTo(cli, frame?.confirm ?? clackPrompter(), profile, targets);
}

/** `profile apply` from the home menu: which profile, then the folders with this one ticked. */
async function applyHere(cli: Cli, frame: SetupFrame): Promise<number> {
  const { profiles } = await listProfiles();
  if (profiles.length === 0) return create(cli, frame);
  const choice = await frame.menu.choose('Which profile?', mainItems(profiles).slice(0, -1));
  const picked = profiles.find((p) => slugOf(p.name) === choice);
  if (picked === undefined) return create(cli, frame);
  return applyChosen(cli, frame, picked, [process.cwd()]);
}

async function refusals(targets: string[]): Promise<string[]> {
  if (targets.length === 0)
    return ['personal-config: name at least one folder to apply it to.'];
  const usable = await Promise.all(targets.map(isTarget));
  return targets
    .filter((_, i) => !usable[i])
    .map((t) => `personal-config: ${short(t)} is not a folder this can set up.`);
}

/** The save and every folder's files, previewed together and written in one confirm. */
async function applyTo(
  cli: Cli,
  confirm: Prompter,
  profile: UserProfile,
  folders: string[],
): Promise<number> {
  const changes = [...(await saveChange(withFolders(profile, folders.map(contractHome))))];
  for (const folder of folders) changes.push(...(await planFolder(cli, profile, folder)));
  if (folders.length > 0) say(`${profile.name} → ${folders.map(short).join(', ')}`);
  await finish(cli, changes, confirm);
  return 0;
}

async function saveChange(profile: UserProfile): Promise<PlannedChange[]> {
  const label = `profile "${profile.name}"`;
  return resolvePlan([plannedRecord(profilePath(profile.name), label, profileText(profile))]);
}

/**
 * One folder, as `init` plans it, with the profile's answers over the folder's own and the
 * person's saved ones (init BD-3). Its `.personal-config.json` records the profile by slug, so
 * `--profile <slug>` and a later `profile apply` read the same answers back.
 */
export async function planFolder(
  cli: Cli,
  profile: UserProfile,
  target: string,
): Promise<PlannedChange[]> {
  const loaded = await loadConfig({ ...cli, from: null, projectsDir: null }, target);
  const config = { ...loaded, profile: slugOf(profile.name) };
  const answers = { ...initAnswers(config, await savedUserConfig()), ...profile.answers };
  const plan = await planTarget(target, answers, config, defaultsPrompter());
  const changes = await planEverything(config, answers, [plan], priorSource(cli, [plan]));
  return insideOnly(changes, target);
}

/** `profile new <name> [preset]` with no terminal: the preset's answers over the defaults. */
async function createQuietly(
  cli: Cli,
  name: string | undefined,
  presetId: string | undefined,
): Promise<number> {
  const { profiles } = await listProfiles();
  const problem =
    name === undefined ? 'name the profile' : await nameProblem(name, taken(profiles));
  const preset = presetId === undefined ? null : findPreset(presetId);
  if (problem !== null || name === undefined || (presetId !== undefined && preset === null)) {
    say(`personal-config: ${problem ?? `no preset named '${presetId}'`}.\n\n${USAGE}`);
    return 1;
  }
  const answers = await askProfile(cli, defaultsPrompter(), preset?.answers ?? {});
  const description = preset?.description ?? '';
  return applyTo(cli, clackPrompter(), { name, description, answers, folders: [] }, []);
}

function taken(profiles: UserProfile[]): string[] {
  return profiles.map((p) => slugOf(p.name));
}

async function remove(cli: Cli, frame: SetupFrame | undefined, name?: string): Promise<number> {
  const profile = await named(name);
  if (profile === null) return 1;
  frame?.menu.at(STEP.review);
  const change = await resolveRemoval(profilePath(profile.name), `profile "${profile.name}"`);
  if (profile.folders.length > 0) {
    say(`${folderCount(profile)} keep the files it wrote: ${profile.folders.join(', ')}`);
  }
  await finish(cli, [change], frame?.confirm ?? clackPrompter());
  return 0;
}

async function named(name: string | undefined): Promise<UserProfile | null> {
  if (name === undefined) {
    say(`personal-config: name the profile.\n\n${USAGE}`);
    return null;
  }
  const profile = await findProfile(name);
  if (profile === null)
    say(`personal-config: no profile named '${name}'. See \`profile list\`.`);
  return profile;
}
