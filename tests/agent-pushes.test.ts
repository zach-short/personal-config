/**
 * The fourth commit policy, `agent-pushes` (the owner's answers of 2026-10-16). Under the other
 * three no answer let the agent commit and push freely: `print-blocks` and `no-rule` block every
 * commit, and `agent-commits` allows one commit shape and blocks every push. The owner removed
 * the guard and the rule by hand, and the next `setup` would have written both back.
 *
 * `agent-pushes` writes one line in place of the ban, keeps the attribution rule, and installs
 * no commit guard at all (the owner chose that over keeping the guard for the discard commands).
 * A re-run prunes a guard an earlier run installed.
 *
 * A file of its own rather than lines appended to a suite another lane owns (X1).
 */
import { describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { exists, readText } from '../src/lib/disk.ts';
import { claudeRulesDir, repoRoot } from '../src/lib/paths.ts';
import type { Answers, PlannedFile } from '../src/lib/types.ts';
import { declinedHookHelp, renderHooks } from '../src/render/hooks.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  PROSE_LAND_STEP,
  tempDir,
  testContext,
  testRepoPlan,
} from './helpers.ts';

const CODE_FULL_GIT: Answers = {
  ...DEFAULT_ANSWERS,
  workKind: 'code',
  configWeight: 'full',
  usesGit: 'yes',
  hooks: 'commit-guard',
  skills: 'all',
};

const MAY_PUSH =
  'Claude may run any git command, including `git add`, `git commit`, `git merge` and `git push`.';
/** The line before the owner's statement of 2026-10-16 that git is Claude's to run in full. */
const THREE_VERBS = 'Claude may run `git add`, `git commit` and `git push`.';
const BAN = 'Never run `git commit`';

async function render(overrides: Answers): Promise<PlannedFile[]> {
  return renderAll(testContext({ ...CODE_FULL_GIT, ...overrides }, testRepoPlan()));
}

function contentsAt(files: PlannedFile[], path: string): string {
  const found = files.find((f) => f.path === path);
  if (!found) throw new Error(`nothing planned at ${path}`);
  return found.contents;
}

function names(files: PlannedFile[]): string[] {
  return files.map((f) => basename(f.path));
}

describe('agent-pushes writes a permission, not a ban', () => {
  test('violates the old rule: commits.md holds the one line and no ban', async () => {
    const files = await render({ commitPolicy: 'agent-pushes' });
    const rule = contentsAt(files, join(claudeRulesDir(), 'commits.md'));
    expect(rule).toContain(MAY_PUSH);
    expect(rule).not.toContain(BAN);
    expect(rule).not.toContain('Never run `git push`');
  });

  test('passes: the attribution rule the attribution answer controls is kept', async () => {
    const none = await render({ commitPolicy: 'agent-pushes', attribution: 'none' });
    expect(contentsAt(none, join(claudeRulesDir(), 'commits.md'))).toContain(
      'Never add a `Co-Authored-By:` trailer.',
    );
    const trailer = await render({ commitPolicy: 'agent-pushes', attribution: 'co-authored' });
    expect(contentsAt(trailer, join(claudeRulesDir(), 'commits.md'))).toContain(
      'Agent commits carry a `Co-Authored-By:` trailer.',
    );
  });

  test('passes: print-blocks still writes the ban', async () => {
    const files = await render({ commitPolicy: 'print-blocks' });
    expect(contentsAt(files, join(claudeRulesDir(), 'commits.md'))).toContain(BAN);
  });

  test("violates the old router: the repo's CLAUDE.md says the agent may push", async () => {
    const files = await render({ commitPolicy: 'agent-pushes' });
    const router = contentsAt(files, join(testRepoPlan().scan.path, 'CLAUDE.md'));
    expect(router).toContain(`- ${MAY_PUSH}`);
    expect(router).not.toContain(BAN);
  });

  test("violates the old Part 11: the standard's owner policy says the agent may push", async () => {
    const files = await render({ commitPolicy: 'agent-pushes' });
    const standard = files.find((f) => f.contents.includes('# Part 11 — Owner policy'));
    expect(standard?.contents).toContain('**The agent may commit and push.**');
    expect(standard?.contents).not.toContain('**Commits are the owner’s.**');
  });

  test('violates the three-verb line: every rendered copy names any git command', async () => {
    const files = await render({ commitPolicy: 'agent-pushes' });
    const rendered = files.map((f) => f.contents).join('\n');
    expect(rendered).not.toContain(THREE_VERBS);
    const carriers = files
      .filter((f) => f.contents.includes(MAY_PUSH))
      .map((f) => basename(f.path));
    expect(carriers).toEqual(expect.arrayContaining(['commits.md', 'CLAUDE.md']));
    const standard = files.find((f) => f.contents.includes('# Part 11 — Owner policy'));
    expect(standard?.contents).toContain(MAY_PUSH);
  });
});

describe('agent-pushes installs no commit guard', () => {
  test('violates the old plan: the hook answer alone no longer installs the guard', async () => {
    const files = await renderHooks(
      testContext({ ...CODE_FULL_GIT, commitPolicy: 'agent-pushes' }),
    );
    expect(names(files)).not.toContain('commit-guard.sh');
    expect(names(files)).not.toContain('commit-policy');
    expect(names(files)).toContain('completion-gate.sh');
    const merge = files.find((f) => basename(f.path) === 'settings.json');
    const body = JSON.parse(merge?.contents ?? '{}') as { hooks?: Record<string, unknown> };
    expect(Object.keys(body.hooks ?? {})).toEqual(['Stop']);
  });

  test('passes: the banner and the gate are still installed under both', async () => {
    const files = await renderHooks(
      testContext({ ...CODE_FULL_GIT, hooks: 'both', commitPolicy: 'agent-pushes' }),
    );
    expect(
      names(files)
        .filter((n) => n.endsWith('.sh'))
        .sort(),
    ).toEqual(['completion-gate.sh', 'session-banner.sh']);
  });

  test('passes: non-code work in git keeps the delete guard, which is not a commit guard', async () => {
    const files = await renderHooks(
      testContext({ ...CODE_FULL_GIT, workKind: 'non-code', commitPolicy: 'agent-pushes' }),
    );
    expect(names(files)).toContain('delete-guard.sh');
    expect(names(files)).not.toContain('commit-guard.sh');
  });

  test('passes: agent-commits still installs the guard and its policy file', async () => {
    const files = await renderHooks(
      testContext({ ...CODE_FULL_GIT, commitPolicy: 'agent-commits' }),
    );
    expect(names(files)).toContain('commit-guard.sh');
    expect(names(files)).toContain('commit-policy');
  });

  test('passes: a declined run hands over no commit-guard snippet', async () => {
    const files = await renderHooks(
      testContext({ ...CODE_FULL_GIT, commitPolicy: 'agent-pushes' }),
    );
    const help = declinedHookHelp(files);
    expect(help).not.toContain('commit-guard.sh');
    expect(help).not.toContain('PreToolUse');
  });
});

/**
 * Autonomous-autopilot Phase 1 (design 4.5, G44): `agent-pushes` lands a row, so its skills differ
 * from `agent-commits` by the land step, and G40's two sentences render only under the latter.
 */
describe('the skills land a row under agent-pushes, and only there', () => {
  const G40 = ['Never push and never merge.', 'No branch is pushed or merged.'];
  const LANDS: Record<string, string> = { delegate: '## 6. Land it', autopilot: '**Landed**' };

  const read = async (skill: string, policy: string) =>
    (await render({ commitPolicy: policy, ...PROSE_LAND_STEP })).find((f) =>
      f.path.endsWith(join(skill, 'SKILL.md')),
    )?.contents ?? '';

  for (const [skill, lands] of Object.entries(LANDS)) {
    test(`passes: /${skill} under agent-pushes lands, with neither G40 sentence`, async () => {
      const text = (await read(skill, 'agent-pushes')).replace(/\s+/g, ' ');
      expect(text).toContain(lands);
      for (const sentence of G40) expect(text, sentence).not.toContain(sentence);
    });

    test(`violates: /${skill} under agent-commits has no land step, and keeps its G40 sentence`, async () => {
      const text = (await read(skill, 'agent-commits')).replace(/\s+/g, ' ');
      expect(text).not.toContain(lands);
      expect(G40.some((sentence) => text.includes(sentence))).toBe(true);
    });
  }

  test('passes: /delegate under agent-commits renders the same bytes twice', async () => {
    const first = await read('delegate', 'agent-commits');
    expect(first).not.toBe('');
    expect(await read('delegate', 'agent-commits')).toBe(first);
  });
});

/**
 * The real bin in a child process, with `HOME` in a temp directory this file made: a run under
 * `print-blocks` installs the guard, and a run under `agent-pushes` takes it out again. The owner's
 * migration is exactly this re-run, in each project (a hand edit of the saved answer is drift).
 */
describe('a re-run under agent-pushes removes an installed guard', () => {
  const CLI = join(repoRoot(), 'src', 'cli.ts');

  async function setup(home: string, answers: Answers): Promise<string> {
    const starter = JSON.parse(await readText(join(repoRoot(), 'profiles', 'starter.json')));
    starter.answers = { ...starter.answers, ...CODE_FULL_GIT, skills: 'none', ...answers };
    const name = `run-${Math.random().toString(36).slice(2)}`;
    const projects = join(home, name);
    await mkdir(projects);
    const from = join(home, `${name}.json`);
    await writeFile(from, JSON.stringify(starter, null, 2));
    const proc = Bun.spawn(
      ['bun', 'run', CLI, 'setup', '--from', from, '--projects-dir', projects, '--yes'],
      { cwd: repoRoot(), env: { ...process.env, HOME: home }, stdout: 'pipe', stderr: 'pipe' },
    );
    const stdout = await new Response(proc.stdout).text();
    await new Response(proc.stderr).text();
    expect(await proc.exited).toBe(0);
    return stdout;
  }

  test('violates the old behaviour: the guard, its policy and its entry go; the gate stays', async () => {
    const home = await tempDir('pc-agent-pushes-');
    expect(home.startsWith(tmpdir())).toBe(true);
    try {
      const hooks = join(home, '.claude', 'hooks', 'personal-config');
      await setup(home, { commitPolicy: 'print-blocks' });
      expect(await exists(join(hooks, 'commit-guard.sh'))).toBe(true);
      expect(await exists(join(hooks, 'commit-policy'))).toBe(true);

      await setup(home, { commitPolicy: 'agent-pushes' });
      expect(await exists(join(hooks, 'commit-guard.sh'))).toBe(false);
      expect(await exists(join(hooks, 'commit-policy'))).toBe(false);
      expect(await exists(join(hooks, 'completion-gate.sh'))).toBe(true);
      const settings = JSON.parse(await readText(join(home, '.claude', 'settings.json')));
      expect(Object.keys(settings.hooks ?? {})).toEqual(['Stop']);
      const rule = await readText(join(home, '.claude', 'rules', 'commits.md'));
      expect(rule).toContain(MAY_PUSH);
      expect(rule).not.toContain(BAN);
    } finally {
      await cleanup(home);
    }
  });
});
