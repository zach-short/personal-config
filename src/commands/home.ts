import { join, resolve } from 'node:path';
import { isCancel, SelectPrompt } from '@clack/core';
import { savedUserConfig } from '../lib/config.ts';
import { exists } from '../lib/disk.ts';
import { docRoots } from '../lib/doc-roots.ts';
import { configFile, expandHome } from '../lib/paths.ts';
import { listProfiles } from '../lib/profiles.ts';
import { readDocNames, readStandardPath } from '../lib/repo-config.ts';
import { type HomeView, homeScreen, painter, sizeOf, toneFor } from '../lib/screens.ts';
import type { ConfigLayer } from '../lib/types.ts';
import { clearScreen, short } from '../lib/ui.ts';

/** What the menu depends on, read once before it is drawn (bare-command-home BD-3). */
export type HomeFacts = {
  /** `config.json` is on disk: the machine setup (`global`) has been run. */
  hasConfig: boolean;
  configLoads: boolean;
  hasFolderConfig: boolean;
  hasBoard: boolean;
  hasStandard: boolean;
  /** How many profiles are saved (`personal-config profile`). */
  profiles: number;
};

/**
 * One menu row: its words, and the argv it hands to the real command. Quit has none. A row with
 * `children` opens a screen of them instead of running anything, so no screen shows more than a
 * handful of rows (3 to 6) and the long list is a tree a person walks one step at a time. `followedBy`
 * is a second command line run when the first exits 0, for a guided pair such as the machine
 * setup followed by the profiles.
 */
export type MenuEntry = {
  label: string;
  argv: string[];
  followedBy?: string[];
  children?: MenuEntry[];
};

export type HomeState = {
  facts: HomeFacts;
  summary: Array<[label: string, value: string]>;
  error: string | null;
};

/** Runs a command line exactly as typed, so a menu entry adds no logic of its own (D2, D4). */
export type Runner = (argv: string[]) => Promise<number>;

const QUIT: MenuEntry = { label: 'Quit', argv: [] };
const BACK: MenuEntry = { label: '← Back', argv: [] };

/**
 * The first screen: a few primary actions chosen by where the person is (a machine with nothing
 * saved, a folder not yet set up, a folder that is), then `Other…` and `Quit`. Everything not
 * primary is one step down under `Other…`, in groups. A config that does not load leaves only the
 * entries that never read it.
 */
export function homeMenu(facts: HomeFacts): MenuEntry[] {
  const primary = primaryEntries(facts);
  const groups = otherGroups(facts, new Set(primary.map((entry) => entry.label)));
  const other: MenuEntry[] =
    groups.length > 0 ? [{ label: 'Other…', argv: [], children: groups }] : [];
  return [...primary, ...other, QUIT];
}

/** The screen a `children` row opens: its rows, then the way back. */
export function screenOf(entries: MenuEntry[], depth: number): MenuEntry[] {
  return depth === 0 ? entries : [...entries, BACK];
}

function primaryEntries(facts: HomeFacts): MenuEntry[] {
  if (!facts.configLoads) return [];
  if (!facts.hasConfig) return [setUpMachine()];
  if (!facts.hasFolderConfig) return [setUpHere(facts), CHECK];
  return [
    CHECK,
    ...(facts.hasBoard ? [NEXT_ITEM] : []),
    ...(facts.hasStandard ? [STANDARD_CHANGES] : []),
  ];
}

const CHECK: MenuEntry = { label: 'Check this folder', argv: ['doctor', '.'] };
const NEXT_ITEM: MenuEntry = { label: 'Next board item', argv: ['passoff', 'next'] };
const STANDARD_CHANGES: MenuEntry = {
  label: 'What changed in the standard',
  argv: ['upgrade', '.'],
};

/** What the machine needs first: the answers that are yours, then the profiles that use them. */
function setUpMachine(): MenuEntry {
  return { label: 'Set up this machine', argv: ['global'], followedBy: ['profile'] };
}

/** With a profile saved, a folder is set up from one; before that, from the saved answers. */
function setUpHere(facts: HomeFacts): MenuEntry {
  return facts.profiles > 0
    ? { label: 'Set up this folder from a profile', argv: ['profile', 'apply'] }
    : { label: 'Set up this folder', argv: ['init', '.'] };
}

/** The rest, in up to three groups of at most five rows. A group with nothing in it is dropped. */
function otherGroups(facts: HomeFacts, shown: Set<string>): MenuEntry[] {
  const reads = facts.configLoads;
  const folder: MenuEntry[] = [
    ...(reads ? [CHECK] : []),
    ...(reads && facts.hasBoard ? [NEXT_ITEM] : []),
    ...(reads && facts.hasStandard ? [STANDARD_CHANGES] : []),
  ];
  const setup: MenuEntry[] = reads
    ? [
        { label: 'Profiles', argv: ['profile'] },
        { label: 'Change your global setup', argv: ['global'] },
        { label: 'Run the full setup again', argv: ['setup'] },
      ]
    : [];
  const tool: MenuEntry[] = [
    { label: 'Update personal-config', argv: ['update'] },
    { label: 'Undo the last run', argv: ['undo'] },
  ];
  return [
    group('This folder', folder, shown),
    group('Your setup', setup, shown),
    group('This tool', tool, shown),
  ].flatMap((entry) => (entry === null ? [] : [entry]));
}

function group(label: string, entries: MenuEntry[], shown: Set<string>): MenuEntry | null {
  const children = entries.filter((entry) => !shown.has(entry.label));
  return children.length === 0 ? null : { label, argv: [], children };
}

export async function readHome(cwd: string): Promise<HomeState> {
  const loaded = await loadSaved();
  const folder = await folderFacts(cwd);
  const hasConfig = await exists(configFile());
  if ('error' in loaded) {
    return {
      facts: { hasConfig, configLoads: false, ...folder },
      summary: [],
      error: loaded.error,
    };
  }
  return {
    facts: { hasConfig, configLoads: true, ...folder },
    summary: summaryOf(loaded.layer),
    error: null,
  };
}

/** Only reads: a file that fails to parse is reported and left byte for byte (D2). */
async function loadSaved(): Promise<{ layer: ConfigLayer } | { error: string }> {
  try {
    return { layer: await savedUserConfig() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function folderFacts(dir: string): Promise<Omit<HomeFacts, 'configLoads' | 'hasConfig'>> {
  const { config, docs } = await docRoots(dir);
  const { profiles } = await listProfiles();
  const names = await readDocNames(config);
  const standard = await readStandardPath(config);
  return {
    hasFolderConfig: await exists(join(config, '.personal-config.json')),
    hasBoard: await exists(join(docs, names.board)),
    hasStandard: standard !== null && (await exists(resolve(config, expandHome(standard)))),
    profiles: profiles.length,
  };
}

function summaryOf(layer: ConfigLayer): Array<[string, string]> {
  const answers = layer.answers ?? {};
  // A tier saved as '' is a tier left to the profile, not a model to list.
  const models = Object.values(layer.models ?? {}).filter(
    (id) => typeof id === 'string' && id !== '',
  );
  const projects = answers.projectsDir ?? layer.projectsDir;
  return [
    ['Saved answers', String(Object.keys(answers).length)],
    ['Models', models.length > 0 ? models.join(', ') : 'the profile defaults'],
    ['Projects folder', typeof projects === 'string' ? projects : 'not saved'],
  ];
}

/** The words around the menu: a machine with nothing saved is welcomed, not told it is set up. */
function viewOf(state: HomeState, menu: MenuEntry[], cursor: number): HomeView {
  const base: HomeView = {
    configPath: short(configFile()),
    summary: state.summary,
    error: state.error,
    menu: menu.map((entry) => entry.label),
    cursor,
  };
  if (state.facts.hasConfig || state.error !== null) return base;
  return {
    ...base,
    title: 'Welcome',
    lead: [
      'Nothing is saved on this machine yet.',
      'Setting up takes two steps: the answers that are yours, then the profiles that set up your folders.',
    ],
  };
}

async function choose(state: HomeState, menu: MenuEntry[]): Promise<MenuEntry | undefined> {
  const paint = painter(toneFor(process.env));
  const where = short(process.cwd());
  clearScreen();
  const choice = await new SelectPrompt({
    options: menu.map((_, index) => ({ value: index })),
    render() {
      const size = sizeOf(process.stdout.columns, process.stdout.rows);
      return homeScreen(paint, viewOf(state, menu, this.cursor), size, where);
    },
  }).prompt();
  return typeof choice === 'number' && !isCancel(choice) ? menu[choice] : undefined;
}

/**
 * The home screen. It draws, waits for one choice, and then gets out of the way: the screen is
 * cleared and the command runs with its own output and its own exit code (D4, dial 3). A row with
 * children opens a screen of them, and `← Back` returns to the one above.
 */
export async function runHome(run: Runner): Promise<number> {
  const state = await readHome(process.cwd());
  const trail: MenuEntry[][] = [homeMenu(state.facts)];

  for (;;) {
    const current = trail.at(-1) ?? [];
    const entry = await choose(state, screenOf(current, trail.length - 1));
    if (entry === undefined || entry === QUIT) return 0;
    if (entry === BACK) trail.pop();
    else if (entry.children !== undefined) trail.push(entry.children);
    else return runEntry(run, entry);
  }
}

async function runEntry(run: Runner, entry: MenuEntry): Promise<number> {
  clearScreen();
  const code = await run(entry.argv);
  return code === 0 && entry.followedBy !== undefined ? run(entry.followedBy) : code;
}
