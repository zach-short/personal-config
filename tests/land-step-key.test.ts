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

describe('only a named profile sets the key', () => {
  for (const name of ['starter', 'pro'])
    test(`passes: profiles/${name}.json leaves it out, so its default is the lead's landing`, async () => {
      const profile = JSON.parse(await readText(join(repoRoot(), 'profiles', `${name}.json`)));
      expect(profile.answers.landStep).toBeUndefined();
    });
});
