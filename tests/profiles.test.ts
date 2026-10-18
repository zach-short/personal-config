/**
 * Named profiles: the store, the presets, the manager's screens, and `profile apply` setting up
 * many folders in one batch that `doctor` then reads back clean. Every home and folder is a temp
 * directory; the CLI runs are the real bin in a child with `HOME` pointed at one.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROFILE_FLOW, runProfile } from '../src/commands/profile.ts';
import { parseCli } from '../src/lib/args.ts';
import { framePrompters } from '../src/lib/frame.ts';
import { profilesDir, repoRoot } from '../src/lib/paths.ts';
import { PRESETS, suggestedName } from '../src/lib/profile-presets.ts';
import {
  asProfile,
  listProfiles,
  nameProblem,
  profileKeys,
  profileQuestions,
  profileText,
  slugOf,
} from '../src/lib/profiles.ts';
import { setSink } from '../src/lib/ui.ts';
import { ALL_QUESTIONS } from '../src/questions/index.ts';
import { drive, KEY } from './frame-driver.ts';
import { cleanup, tempDir, withTty } from './helpers.ts';

const sandbox = process.env.HOME;

afterEach(() => {
  process.env.HOME = sandbox;
  setSink(null);
});

describe('the questions a profile asks', () => {
  test('the folder track and the folder questions, never the person’s', () => {
    const ids = profileQuestions().map((q) => q.id);
    expect(ids).toContain('work-kind');
    expect(ids).toContain('work-profile');
    expect(ids).toContain('comments');
    for (const personal of ['commit-policy', 'hooks', 'model-deep', 'chat-style', 'skills']) {
      expect(ids).not.toContain(personal);
    }
    for (const own of ['projects-dir', 'proof-line', 'off-limits']) {
      expect(ids).not.toContain(own);
    }
  });
});

describe('the presets', () => {
  test('every answer is a profile question’s, and one of its options', () => {
    const keys = profileKeys();
    for (const preset of PRESETS) {
      for (const [key, value] of Object.entries(preset.answers)) {
        expect(keys.has(key)).toBe(true);
        const options = ALL_QUESTIONS.filter((q) => q.configKey === key).flatMap(
          (q) => q.options?.map((o) => o.value) ?? [],
        );
        expect(options).toContain(String(value));
      }
    }
  });

  test('light, medium and heavy are offered by those names', () => {
    expect(PRESETS.map((p) => p.name)).toEqual([
      'Light setup',
      'Medium setup',
      'Heavy setup',
      'Writing setup',
    ]);
  });

  test('a taken name gets the first free number', () => {
    const heavy = PRESETS[2];
    if (heavy === undefined) throw new Error('no heavy preset');
    expect(suggestedName(heavy, [])).toBe('Heavy setup');
    expect(suggestedName(heavy, ['heavy-setup', 'heavy-setup-2'])).toBe('Heavy setup 3');
  });
});

describe('the profile store', () => {
  test('a name becomes its slug', () => {
    expect(slugOf('  Heavy Setup!  ')).toBe('heavy-setup');
  });

  test('an empty, taken or built-in name is refused', async () => {
    expect(await nameProblem('  ', [])).toContain('letter or digit');
    expect(await nameProblem('Heavy setup', ['heavy-setup'])).toContain('exists');
    expect(await nameProblem('Starter', [])).toContain('built-in');
    expect(await nameProblem('My setup', [])).toBeNull();
  });

  test('a hand edit that breaks a field is named', () => {
    expect(() => asProfile([], 'p.json')).toThrow('expected a JSON object');
    expect(() => asProfile({ name: 'x', answers: { a: 3 } }, 'p.json')).toThrow('answer "a"');
    expect(() => asProfile({ name: 'x', folders: 'here' }, 'p.json')).toThrow('"folders"');
  });

  test('the file keeps only profile answers, sorted, and each folder once', () => {
    const text = profileText({
      name: 'Mine',
      description: '',
      answers: { workKind: 'code', commitPolicy: 'no-rule', configWeight: 'full' },
      folders: ['/b', '/a', '/b'],
    });
    const saved = JSON.parse(text) as { answers: object; folders: string[] };
    expect(Object.keys(saved.answers)).toEqual(['configWeight', 'workKind']);
    expect(saved.folders).toEqual(['/a', '/b']);
  });

  test('a file that does not parse is a problem, and the rest still list', async () => {
    const home = await tempDir('pc-home-');
    process.env.HOME = home;
    try {
      await mkdir(profilesDir(), { recursive: true });
      await writeFile(join(profilesDir(), 'good.json'), JSON.stringify({ name: 'Good' }));
      await writeFile(join(profilesDir(), 'bad.json'), JSON.stringify({ answers: {} }));
      const { profiles, problems } = await listProfiles();
      expect(profiles.map((p) => p.name)).toEqual(['Good']);
      expect(problems).toHaveLength(1);
    } finally {
      await cleanup(home);
    }
  });
});

describe('the manager, through the frame', () => {
  test('new → Heavy setup → keep its answers → no folders saves the profile', async () => {
    const home = await tempDir('pc-home-');
    process.env.HOME = home;
    try {
      // The list starts with only `+ New profile` and Done; once saved, Done is two rows down.
      const driven = drive((screen) => {
        if (screen.includes('Heavy setup  ·  any model'))
          return `${KEY.down}${KEY.down}${KEY.enter}`;
        if (screen.includes('Start the new profile from')) return `${KEY.down}${KEY.down}\r`;
        return KEY.enter;
      });
      const frame = framePrompters(driven.io, PROFILE_FLOW);
      const code = await withTty(true, () =>
        frame.run(() => runProfile(parseCli(['profile']), frame)),
      );
      expect(code).toBe(0);
      const saved = JSON.parse(await readFile(join(profilesDir(), 'heavy-setup.json'), 'utf8'));
      expect(saved.name).toBe('Heavy setup');
      expect(saved.answers['practices.function-length']).toBe('house-6-15');
      expect(saved.folders).toEqual([]);
      const all = driven.written();
      expect(all).toContain('⬢ personal-config · profile');
      expect(all).toContain('Name this profile');
    } finally {
      await cleanup(home);
    }
  });
});

const CLI = join(repoRoot(), 'src', 'cli.ts');

async function cli(args: string[], home: string, cwd: string): Promise<string> {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd,
    env: { ...process.env, HOME: home },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  expect({ code: await proc.exited, err }).toEqual({ code: 0, err: '' });
  return out;
}

describe('global, then a profile applied to many folders', () => {
  test('one batch sets up both folders, records the profile, and doctor is clean', async () => {
    const root = await tempDir('pc-profiles-');
    const home = join(root, 'home');
    const [a, b] = [join(root, 'a'), join(root, 'b')];
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(join(b, 'notes.md'), '# notes\n');
    try {
      await cli(['global', '--yes'], home, root);
      await cli(['profile', 'new', 'Heavy setup', 'heavy', '--yes'], home, root);
      const applied = await cli(['profile', 'apply', 'heavy-setup', a, b, '--yes'], home, root);
      expect(applied).toContain('Wrote');
      for (const dir of [a, b]) {
        const record = JSON.parse(await readFile(join(dir, '.personal-config.json'), 'utf8'));
        expect(record.profile).toBe('heavy-setup');
      }
      const listed = await cli(['profile', 'list'], home, root);
      expect(listed).toContain('Heavy setup — any model, 2 folders');
      expect(await cli(['doctor', a, b], home, root)).toContain('no findings');
      const again = await cli(['profile', 'apply', 'heavy-setup', a, '--dry-run'], home, root);
      // Part 0's prompt names the docs it now finds there, as an `init` re-run does.
      expect(again).toContain('.personal-config.json  — per-repo config  [unchanged]');
    } finally {
      await cleanup(root);
    }
  });
});

describe('the model ceiling, per folder', () => {
  test('each capped tier recommends its own model, so defaults never cap at Opus', () => {
    const recommended = (id: string) =>
      ALL_QUESTIONS.find((q) => q.id === id)?.options?.find((o) => o.recommended)?.value;
    expect(recommended('model-ids-default')).toBe('opus');
    expect(recommended('model-ids-mechanical')).toBe('sonnet');
    expect(recommended('model-ids-light')).toBe('haiku');
  });

  test('Light allows no Opus or Fable, Medium no Fable, Heavy any model', async () => {
    const root = await tempDir('pc-ceiling-');
    const home = join(root, 'home');
    const dirs = { light: join(root, 'l'), medium: join(root, 'm'), heavy: join(root, 'h') };
    try {
      await cli(['global', '--yes'], home, root);
      for (const [preset, dir] of Object.entries(dirs)) {
        await mkdir(dir, { recursive: true });
        await cli(['profile', 'new', preset, preset, '--yes'], home, root);
        await cli(['profile', 'apply', preset, dir, '--yes'], home, root);
      }
      const allowed = async (dir: string) =>
        JSON.parse(await readFile(join(dir, '.claude', 'settings.local.json'), 'utf8'))
          .availableModels as string[];
      expect(await allowed(dirs.light)).toEqual(['sonnet']);
      expect(await allowed(dirs.medium)).toEqual(['sonnet', 'opus']);
      await expect(allowed(dirs.heavy)).rejects.toThrow();
      expect(await cli(['profile', 'list'], home, root)).toContain('light — up to sonnet');
    } finally {
      await cleanup(root);
    }
  });
});
