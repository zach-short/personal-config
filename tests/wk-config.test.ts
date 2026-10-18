import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { wkConfig } from '../src/doctor/rules/wk-config.ts';
import { home } from '../src/lib/paths.ts';
import { cleanup, tempDir, WK_LAND_STEP } from './helpers.ts';

// `~/.wk` sits under `$HOME`, which `tests/preload.ts` points at a sandbox (X2).
afterEach(async () => {
  await rm(join(home(), '.wk'), { recursive: true, force: true });
});

async function withRepo(toml: string | null): Promise<ReturnType<typeof wkConfig>> {
  const dir = await tempDir();
  try {
    if (toml !== null) {
      await mkdir(join(home(), '.wk'), { recursive: true });
      await Bun.write(join(home(), '.wk', `${basename(dir)}.toml`), toml);
    }
    return await wkConfig(dir, WK_LAND_STEP);
  } finally {
    await cleanup(dir);
  }
}

const GOOD = `[landing]
enabled = true # turn the queue on

[[gates.run]]
name = "test"
run = ["bun", "test"]
`;

describe('wk-config', () => {
  test('flags a config with landing off and no gate', async () => {
    const found = await withRepo('[landing]\nenabled = false\n\n[gates]\nbatch_max = 1\n');
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('[landing] enabled = true');
    expect(found[0]?.message).toContain('[[gates.run]]');
  });

  test('flags a missing config', async () => {
    const found = await withRepo(null);
    expect(found[0]?.message).toContain('does not exist');
  });

  test('passes a config with landing on and a gate', async () => {
    expect(await withRepo(GOOD)).toEqual([]);
  });

  test('says nothing for a profile that does not set landStep wk', async () => {
    const dir = await tempDir();
    try {
      expect(await wkConfig(dir, {})).toEqual([]);
    } finally {
      await cleanup(dir);
    }
  });
});
