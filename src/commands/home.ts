import { join, resolve } from 'node:path';
import { isCancel, SelectPrompt } from '@clack/core';
import { savedUserConfig } from '../lib/config.ts';
import { exists } from '../lib/disk.ts';
import { configFile, expandHome } from '../lib/paths.ts';
import { readDocNames, readStandardPath } from '../lib/repo-config.ts';
import { type HomeView, homeScreen, painter, toneFor } from '../lib/screens.ts';
import type { ConfigLayer } from '../lib/types.ts';
import { clearScreen, short } from '../lib/ui.ts';

/** What the menu depends on, read once before it is drawn (bare-command-home BD-3). */
export type HomeFacts = {
  configLoads: boolean;
  hasFolderConfig: boolean;
  hasBoard: boolean;
  hasStandard: boolean;
};

/** One menu row: its words, and the argv it hands to the real command. Quit has none. */
export type MenuEntry = { label: string; argv: string[] };

export type HomeState = {
  facts: HomeFacts;
  summary: Array<[label: string, value: string]>;
  error: string | null;
};

/** Runs a command line exactly as typed, so a menu entry adds no logic of its own (D2, D4). */
export type Runner = (argv: string[]) => Promise<number>;

const QUIT: MenuEntry = { label: 'Quit', argv: [] };

/**
 * D2's menu. A config that does not load leaves only Quit, because every other entry would
 * read it; the rest appear where the working folder has the thing they act on.
 */
export function homeMenu(facts: HomeFacts): MenuEntry[] {
  if (!facts.configLoads) return [QUIT];
  return [
    ...(facts.hasFolderConfig ? [] : [{ label: 'Set up this folder', argv: ['init', '.'] }]),
    { label: 'Check this folder', argv: ['doctor', '.'] },
    ...(facts.hasBoard ? [{ label: 'Next board item', argv: ['passoff', 'next'] }] : []),
    ...(facts.hasStandard
      ? [{ label: 'What changed in the standard', argv: ['upgrade', '.'] }]
      : []),
    { label: 'Run setup again', argv: ['setup'] },
    QUIT,
  ];
}

export async function readHome(cwd: string): Promise<HomeState> {
  const loaded = await loadSaved();
  const folder = await folderFacts(cwd);
  if ('error' in loaded) {
    return { facts: { configLoads: false, ...folder }, summary: [], error: loaded.error };
  }
  return {
    facts: { configLoads: true, ...folder },
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

async function folderFacts(cwd: string): Promise<Omit<HomeFacts, 'configLoads'>> {
  const names = await readDocNames(cwd);
  const standard = await readStandardPath(cwd);
  return {
    hasFolderConfig: await exists(join(cwd, '.personal-config.json')),
    hasBoard: await exists(join(cwd, names.board)),
    hasStandard: standard !== null && (await exists(resolve(cwd, expandHome(standard)))),
  };
}

function summaryOf(layer: ConfigLayer): Array<[string, string]> {
  const answers = layer.answers ?? {};
  const models = Object.values(layer.models ?? {}).filter((id) => typeof id === 'string');
  const projects = answers.projectsDir ?? layer.projectsDir;
  return [
    ['Saved answers', String(Object.keys(answers).length)],
    ['Models', models.length > 0 ? models.join(', ') : 'the profile defaults'],
    ['Projects folder', typeof projects === 'string' ? projects : 'not saved'],
  ];
}

/**
 * The home screen. It draws, waits for one choice, and then gets out of the way: the screen is
 * cleared and the command runs with its own output and its own exit code (D4, dial 3).
 */
export async function runHome(run: Runner): Promise<number> {
  const state = await readHome(process.cwd());
  const menu = homeMenu(state.facts);
  const paint = painter(toneFor(process.env));
  const where = short(process.cwd());
  const view = (cursor: number): HomeView => ({
    configPath: short(configFile()),
    summary: state.summary,
    error: state.error,
    menu: menu.map((entry) => entry.label),
    cursor,
  });

  clearScreen();
  const choice = await new SelectPrompt({
    options: menu.map((_, index) => ({ value: index })),
    render() {
      return homeScreen(paint, view(this.cursor), terminalSize(), where);
    },
  }).prompt();

  const entry = typeof choice === 'number' && !isCancel(choice) ? menu[choice] : undefined;
  if (entry === undefined || entry.argv.length === 0) return 0;
  clearScreen();
  return run(entry.argv);
}

function terminalSize(): { columns: number; rows: number } {
  return { columns: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 };
}
