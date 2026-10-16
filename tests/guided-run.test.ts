/**
 * A whole bare-command setup through the frame writes what `setup --yes` writes, given the same
 * answers (bare-command-home PLAN.md Phase 2). The frame is a `Prompter` pair and a sink, so the
 * files cannot differ unless it answers a question differently or loses a step.
 *
 * Both runs are in this process, each with `HOME` and the projects folder in its own temp
 * directory, refused if either is anywhere else. Each run starts from a fresh copy of the fixture
 * repos, because a run writes into them.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { runSetup } from '../src/commands/setup.ts';
import { parseCli } from '../src/lib/args.ts';
import { framePrompters } from '../src/lib/frame.ts';
import { setSink } from '../src/lib/ui.ts';
import { drive, KEY } from './frame-driver.ts';
import { cleanup, tempDir, withTty } from './helpers.ts';
import { makeFixtures } from './make-fixtures.ts';

const sandbox = process.env.HOME;

afterEach(() => {
  process.env.HOME = sandbox;
  setSink(null);
});

type Run = { home: string; projects: string };

async function freshRun(): Promise<Run> {
  const root = await tempDir('pc-guided-');
  expect(root.startsWith(tmpdir())).toBe(true);
  const home = join(root, 'home');
  const projects = await makeFixtures(join(root, 'projects'));
  process.env.HOME = home;
  return { home, projects };
}

/** Every file a run left, keyed by where it is, with the run's own folders taken out. */
async function tree(run: Run): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const [label, base] of [
    ['home', run.home],
    ['projects', run.projects],
  ] as const) {
    for (const path of await walk(base)) {
      files[scrub(run, `${label}/${relative(base, path)}`)] = scrub(
        run,
        await readFile(path, 'utf8'),
      );
    }
  }
  return files;
}

/**
 * The run's own folders, and the second the backup was taken: the backup folder is named for it
 * and each backed-up file for its flattened path, so two runs differ there and nowhere else.
 */
function scrub(run: Run, text: string): string {
  return text
    .replaceAll(run.home, '<home>')
    .replaceAll(run.projects, '<projects>')
    .replaceAll(run.projects.replaceAll('/', '_'), '<projects>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}[-:]\d{2}[-:]\d{2}([-.:]\d{3})?Z?/g, '<when>');
}

/**
 * Git's own files differ between any two `git init`s; what setup writes in `.git` is
 * `info/exclude`. `gh`, which `setup` asks for the login, keeps a device id of its own in `HOME`.
 */
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => []);
  return entries
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .filter((path) => !path.includes('/.git/') || path.endsWith('/.git/info/exclude'))
    .filter((path) => !path.includes('/.local/state/gh/'))
    .sort();
}

describe('a guided run through the frame', () => {
  test('writes the same files as --yes with the same answers', async () => {
    const yes = await freshRun();
    try {
      const said: string[] = [];
      setSink((line) => said.push(line));
      const cli = parseCli(['setup', '--yes', '--projects-dir', yes.projects]);
      expect(await withTty(false, () => runSetup(cli))).toBe(0);
      setSink(null);
      expect(said.join('\n')).toContain('Wrote ');
    } finally {
      process.env.HOME = sandbox;
    }

    const guided = await freshRun();
    // Every repo is picked, as `--yes` picks them; every other screen takes its default, which
    // for the review is "no diffs", then "write".
    const { io, screens, written } = drive((screen) =>
      screen.includes('Which repos should be set up?') ? `a${KEY.enter}` : KEY.enter,
    );
    try {
      const frame = framePrompters(io);
      const cli = parseCli(['setup', '--projects-dir', guided.projects]);
      const code = await withTty(true, () => frame.run(() => runSetup(cli, frame)));
      expect(code).toBe(0);
      expect(written()).toContain('Setup is done');
      expect(screens.some((s) => s.includes('Show the per-file diff first?'))).toBe(true);
    } finally {
      process.env.HOME = sandbox;
    }

    try {
      const [mine, theirs] = [await tree(guided), await tree(yes)];
      expect(Object.keys(mine).length).toBeGreaterThan(10);
      expect(Object.keys(mine)).toEqual(Object.keys(theirs));
      expect(mine).toEqual(theirs);
    } finally {
      await cleanup(join(yes.home, '..'));
      await cleanup(join(guided.home, '..'));
    }
  });
});
