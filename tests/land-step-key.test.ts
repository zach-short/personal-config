/**
 * Owner decision 13, 2026-10-16: `/delegate`'s prose land step renders only for a profile that
 * sets `landStep: "prose"`. Without the key a board under `agent-pushes` lands as project folders
 * do: the sign-off closes with one sentence saying the lead lands the branch, and step 6 lands
 * and removes. No skill names the land step, so no user of the shipped default depends on it.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { readText } from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';
import type { Answers, PlannedFile } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import { DEFAULT_ANSWERS, PROSE_LAND_STEP, testContext, testRepoPlan } from './helpers.ts';

const LAND_HEADING = '## 6. Land it';
const LEAD_LANDS =
  'This session, the lead, then lands the branch in step 6, by fast-forward and push.';

async function render(
  profileKeys: Answers,
  commitPolicy = 'agent-pushes',
): Promise<PlannedFile[]> {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    ...profileKeys,
    workKind: 'code',
    configWeight: 'full',
    usesGit: 'yes',
    skills: 'all',
    commitPolicy,
  };
  return renderAll(testContext(answers, testRepoPlan()));
}

function skill(files: PlannedFile[], name: string): string {
  return files.find((f) => f.path.endsWith(join(name, 'SKILL.md')))?.contents ?? '';
}

/** A sentence wrapped across two lines must still match, so whitespace reads as one space. */
function flat(text: string): string {
  return text.replace(/\s+/g, ' ');
}

describe('the land step renders only where the profile sets it', () => {
  test('passes: with `landStep: "prose"` /delegate holds the land step and no lead sentence', async () => {
    const delegate = skill(await render(PROSE_LAND_STEP), 'delegate');
    expect(delegate).toContain(`${LAND_HEADING}\n`);
    expect(delegate).toContain('## 7. Remove the worktrees this run made');
    expect(flat(delegate)).not.toContain(LEAD_LANDS);
  });

  test('violates the old default: without the key the heading is absent and the lead lands', async () => {
    const delegate = skill(await render({}), 'delegate');
    expect(delegate).not.toContain(LAND_HEADING);
    expect(delegate).toContain(
      "item's loop is independent.\n\n## 6. Remove the worktrees this run made\n",
    );
    const text = flat(delegate);
    expect(text).toContain(LEAD_LANDS);
    // The sentence closes the sign-off, so it sits before the blocking-findings bullet.
    expect(text.indexOf(LEAD_LANDS)).toBeLessThan(text.indexOf('- **Blocking findings.**'));
    expect(text).toContain('run `git merge --ff-only <branch>`, then `git push`.');
    // The claim is still committed, because step 6's fast-forward is refused over it.
    expect(text).toContain('Step 6 fast-forwards the primary checkout');
    // The builder commits the sign-off lines, so the fast-forward carries them.
    expect(text).toContain('send these lines to the builder with `SendMessage`');
    expect(text).toContain('"not audited: <tier>, no trigger". Its brief');
  });

  test('violates the old default: without the key no skill names the land step', async () => {
    for (const name of ['delegate', 'autopilot', 'close-out', 'clean-up']) {
      const text = flat(skill(await render({}), name));
      expect(text, name).not.toBe('');
      expect(text, name).not.toMatch(/land step|Land it/i);
    }
  });

  test('passes: any other value of the key omits the step too', async () => {
    expect(skill(await render({ landStep: 'wk' }), 'delegate')).not.toContain(LAND_HEADING);
  });

  test('passes: under agent-commits the key changes nothing', async () => {
    const without = skill(await render({}, 'agent-commits'), 'delegate');
    expect(skill(await render(PROSE_LAND_STEP, 'agent-commits'), 'delegate')).toBe(without);
  });
});

/**
 * Board row 132 moved these lines of `templates/skills/delegate.md` into tokens, so that
 * `landStep: "wk"` can replace them. Each is the template's text on `main` at d453fe8, before the
 * move, so a render with the key absent or set to "prose" still carries main's bytes. Item 132's
 * close-out records the wider check: all 576 skill renders of a 96-answer grid, diffed against
 * main's, changed only under `agent-pushes` with `landStep: "wk"`.
 */
const MAIN_PASSAGES = [
  [
    'Spawn one Agent with `model` from the tiers above and `isolation: "worktree"`. A worktree holds',
    'only the files git tracks, and an agent in one cannot run git on another worktree. So before you',
    'write the brief:',
  ],
  [
    "- Write the base branch's name and the patch path where the rules below say `<base>` and",
    '  `<patch>`.',
  ],
  [
    "- Before the first gate, run the fresh-checkout recipe in the repo's working standard, and bring",
    "  the worktree to the base branch: from your worktree's own directory, run",
    '  `git merge --ff-only <base>` as one plain command, with the branch name written out, never',
    '  through a shell variable or `git -C`. A worktree can start from a stale base, and its gates then',
    '  report on old code.',
  ],
  [
    'Spawn a second Agent with its own `isolation: "worktree"`, never the builder\'s. A subagent in a',
    'shared worktree edits source even when it is told only to review. Use the Default tier, or Deep',
  ],
  [
    '- Bring your own worktree to the base branch with `git merge --ff-only <base>`, run from your',
    "  worktree's own directory as one plain command, then reproduce the change there.",
    "  Take it from the builder's branch: from your worktree's own directory, run",
  ],
  [
    "  Never run `git -C` on the builder's worktree: worktree isolation refuses it. Where the change",
    "  does not apply, report the command's output, and never copy files across by hand.",
  ],
].map((lines) => lines.join('\n'));

describe("the prose and direct renders keep main's bytes", () => {
  test('passes: without the key and with "prose", /delegate holds every moved passage', async () => {
    for (const keys of [{}, PROSE_LAND_STEP]) {
      const delegate = skill(await render(keys), 'delegate');
      for (const passage of MAIN_PASSAGES) expect(delegate).toContain(`${passage}\n`);
    }
  });

  test('passes: a value the engine does not know renders as the key absent', async () => {
    for (const name of ['delegate', 'autopilot', 'close-out', 'clean-up']) {
      const without = skill(await render({}), name);
      expect(skill(await render({ landStep: 'queue' }), name), name).toBe(without);
    }
  });
});

describe('only a named profile sets the key', () => {
  for (const name of ['starter', 'pro'])
    test(`passes: profiles/${name}.json leaves it out, so its default is the lead's landing`, async () => {
      const profile = JSON.parse(await readText(join(repoRoot(), 'profiles', `${name}.json`)));
      expect(profile.answers.landStep).toBeUndefined();
    });
});
