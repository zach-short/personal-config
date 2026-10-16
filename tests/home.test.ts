import { describe, expect, test } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type HomeFacts, homeMenu, readHome } from '../src/commands/home.ts';
import { configFile } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const ALL_FALSE: HomeFacts = {
  configLoads: true,
  hasFolderConfig: false,
  hasBoard: false,
  hasStandard: false,
};

function labels(facts: Partial<HomeFacts>): string[] {
  return homeMenu({ ...ALL_FALSE, ...facts }).map((entry) => entry.label);
}

describe('homeMenu', () => {
  test('a folder with nothing set up offers init, doctor, setup and quit', () => {
    expect(labels({})).toEqual([
      'Set up this folder',
      'Check this folder',
      'Run setup again',
      'Quit',
    ]);
  });

  test('a set-up folder with a board and a standard offers passoff and upgrade, not init', () => {
    expect(labels({ hasFolderConfig: true, hasBoard: true, hasStandard: true })).toEqual([
      'Check this folder',
      'Next board item',
      'What changed in the standard',
      'Run setup again',
      'Quit',
    ]);
  });

  test('each entry hands the real command its argv', () => {
    const menu = homeMenu({ ...ALL_FALSE, hasBoard: true, hasStandard: true });
    expect(menu.map((entry) => entry.argv)).toEqual([
      ['init', '.'],
      ['doctor', '.'],
      ['passoff', 'next'],
      ['upgrade', '.'],
      ['setup'],
      [],
    ]);
  });

  test('a config that does not load leaves only quit (D2)', () => {
    expect(labels({ configLoads: false, hasBoard: true })).toEqual(['Quit']);
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
        configLoads: true,
        hasFolderConfig: true,
        hasBoard: true,
        hasStandard: true,
      });
      expect(state.summary).toContainEqual(['Projects folder', '~/code']);
    });
  });
});
