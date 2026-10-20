import { describe, expect, test } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type HomeFacts, homeMenu, readHome, screenOf } from '../src/commands/home.ts';
import { configFile } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const ALL_FALSE: HomeFacts = {
  hasConfig: true,
  configLoads: true,
  hasFolderConfig: false,
  hasBoard: false,
  hasStandard: false,
  profiles: 0,
};

function labels(facts: Partial<HomeFacts>): string[] {
  return homeMenu({ ...ALL_FALSE, ...facts }).map((entry) => entry.label);
}

/** The labels of the screen under `Other…`, then of each group's screen. */
function otherTree(facts: Partial<HomeFacts>): Record<string, string[]> {
  const other = homeMenu({ ...ALL_FALSE, ...facts }).find((entry) => entry.label === 'Other…');
  const groups = other?.children ?? [];
  return Object.fromEntries(
    groups.map((group) => [group.label, (group.children ?? []).map((entry) => entry.label)]),
  );
}

describe('homeMenu', () => {
  test('a machine with nothing saved is asked to set up, with Other above Quit', () => {
    expect(labels({ hasConfig: false })).toEqual(['Set up this machine', 'Other…', 'Quit']);
    const first = homeMenu({ ...ALL_FALSE, hasConfig: false })[0];
    expect(first?.argv).toEqual(['global']);
    expect(first?.followedBy).toEqual(['profile']);
  });

  test('a folder with nothing set up offers to set it up and to check it', () => {
    expect(labels({})).toEqual(['Set up this folder', 'Check this folder', 'Other…', 'Quit']);
  });

  test('with a profile saved, this folder is set up from a profile', () => {
    const menu = homeMenu({ ...ALL_FALSE, profiles: 2 });
    expect(menu[0]).toEqual({
      label: 'Set up this folder from a profile',
      argv: ['profile', 'apply'],
    });
  });

  test('a set-up folder with a board and a standard shows three primary actions', () => {
    expect(labels({ hasFolderConfig: true, hasBoard: true, hasStandard: true })).toEqual([
      'Check this folder',
      'Next board item',
      'What changed in the standard',
      'Other…',
      'Quit',
    ]);
  });

  test('Other holds what is not primary, in groups, and never repeats a primary row', () => {
    expect(otherTree({ hasFolderConfig: true, hasBoard: true, hasStandard: true })).toEqual({
      'Your setup': ['Profiles', 'Change your global setup', 'Run the full setup again'],
      'This tool': ['Update personal-config', 'Undo the last run'],
    });
    expect(otherTree({ hasConfig: false })['This folder']).toEqual(['Check this folder']);
  });

  test('no screen shows more than six rows, whatever the folder holds', () => {
    const states = [true, false].flatMap((on) =>
      [0, 2].map((profiles) => ({
        hasConfig: true,
        hasFolderConfig: on,
        hasBoard: on,
        hasStandard: on,
        profiles,
      })),
    );
    for (const facts of states) {
      const menu = homeMenu({ ...ALL_FALSE, ...facts });
      expect(menu.length).toBeLessThanOrEqual(6);
      for (const entry of menu) {
        expect((entry.children ?? []).length + 1).toBeLessThanOrEqual(6);
        for (const child of entry.children ?? []) {
          expect((child.children ?? []).length + 1).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  test('a config that does not load leaves Other (update, undo) and Quit', () => {
    expect(labels({ configLoads: false, hasBoard: true })).toEqual(['Other…', 'Quit']);
    expect(otherTree({ configLoads: false })).toEqual({
      'This tool': ['Update personal-config', 'Undo the last run'],
    });
  });

  test('a leaf hands the real command its argv, and the way back is added below the top', () => {
    const other = homeMenu(ALL_FALSE).find((entry) => entry.label === 'Other…');
    const setup = other?.children?.find((entry) => entry.label === 'Your setup');
    expect(setup?.children?.map((entry) => entry.argv)).toEqual([
      ['profile'],
      ['global'],
      ['setup'],
    ]);
    expect(screenOf(setup?.children ?? [], 2).at(-1)?.label).toBe('← Back');
    expect(screenOf(homeMenu(ALL_FALSE), 0).some((entry) => entry.label === '← Back')).toBe(
      false,
    );
  });
});

/**
 * Each case gets its own home: the preload's sandbox is shared by every file in the run, and a
 * `config.json` left in it changes what `setup`'s golden tests render.
 */
async function withHome(body: (folder: string) => Promise<void>): Promise<void> {
  const before = process.env.HOME;
  const home = await tempDir('pc-home-');
  const folder = await tempDir();
  process.env.HOME = home;
  try {
    await mkdir(join(configFile(), '..'), { recursive: true });
    await body(folder);
  } finally {
    process.env.HOME = before;
    await cleanup(home);
    await cleanup(folder);
  }
}

describe('readHome', () => {
  test('a config.json that fails to parse is reported and left byte for byte', async () => {
    await withHome(async (folder) => {
      const broken = '{ "answers": { ';
      await writeFile(configFile(), broken);
      const state = await readHome(folder);
      expect(state.facts.configLoads).toBe(false);
      expect(state.error).not.toBeNull();
      expect(await readFile(configFile(), 'utf8')).toBe(broken);
    });
  });

  test('reads the board and the standard from the folder', async () => {
    await withHome(async (folder) => {
      await writeFile(configFile(), JSON.stringify({ answers: { projectsDir: '~/code' } }));
      await writeFile(join(folder, 'PASSOFF.md'), '# board\n');
      await writeFile(join(folder, 'STD.md'), '# standard\n');
      await writeFile(join(folder, '.personal-config.json'), '{ "standardPath": "STD.md" }\n');
      const state = await readHome(folder);
      expect(state.facts).toEqual({
        hasConfig: true,
        configLoads: true,
        hasFolderConfig: true,
        hasBoard: true,
        hasStandard: true,
        profiles: 0,
      });
      expect(state.summary).toContainEqual(['Projects folder', '~/code']);
    });
  });

  test('an empty model id is not listed as a model', async () => {
    await withHome(async (folder) => {
      await writeFile(configFile(), JSON.stringify({ models: { deep: '', default: 'm-1' } }));
      const state = await readHome(folder);
      expect(state.summary).toContainEqual(['Models', 'm-1']);
    });
  });
});
