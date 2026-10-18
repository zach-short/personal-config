/**
 * Board row 132: a profile that sets `landStep: "wk"` lands `/delegate`'s work through wk's queue
 * under `agent-pushes`. The lead makes the builder's workspace with `wk new`, submits it with
 * `wk submit` after the audit, and leaves the removal to `wk gc --apply`, so no sentence tells the
 * lead to merge, push or remove a worktree by hand. Under any other policy the key changes nothing.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { Answers, PlannedFile } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import { DEFAULT_ANSWERS, testContext, testRepoPlan, WK_LAND_STEP } from './helpers.ts';

async function render(
  profileKeys: Answers,
  commitPolicy = 'agent-pushes',
  shape: Answers = {},
): Promise<PlannedFile[]> {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    ...profileKeys,
    workKind: 'code',
    configWeight: 'full',
    usesGit: 'yes',
    skills: 'all',
    commitPolicy,
    ...shape,
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

/** `git merge-base --is-ancestor` only reads, so it is not the merge this ban is about. */
const HAND_MERGE = /git merge(?![-\w])/;

describe('/delegate under landStep "wk"', () => {
  test('passes: the lead makes, submits and removes through wk', async () => {
    const text = flat(skill(await render(WK_LAND_STEP), 'delegate'));
    expect(text).toContain('run `wk new <n>`');
    expect(text).toContain('wk submit -m "<message>" --row <n>');
    expect(text).toContain('`wk gc --apply`');
    expect(text).toContain("## 6. Submit it to wk's queue");
    expect(text).toContain('## 7. Let wk remove the workspaces this run made');
    // Review finding 4a: a stopped worker leaves the changeset `submitted`, so the wait has a limit
    // and the stop has its own next actions.
    expect(text).toContain('Never a wait with no limit');
    expect(text).toContain('**Still `submitted`, `landing` or `gated` when the wait ends**');
    expect(text).toContain('`every gate skipped`');
    expect(text).toContain('`diverged from <base>`');
    expect(text).toContain('`wk land --loop`');
  });

  test('violates nothing: it never tells the lead to merge, push or isolate by hand', async () => {
    const text = skill(await render(WK_LAND_STEP), 'delegate');
    expect(text).not.toMatch(HAND_MERGE);
    expect(text).not.toContain('git push');
    expect(text).not.toContain('isolation: "worktree"');
    // The skill names `git worktree remove` only to forbid it; the command block is what is banned.
    expect(text).not.toContain('git worktree remove <worktree>');
  });

  test('passes: the builder commits and never submits', async () => {
    const text = flat(skill(await render(WK_LAND_STEP), 'delegate'));
    expect(text).toContain('Never merge, never push, and never run `wk submit`');
  });
});

describe('/close-out and /clean-up under landStep "wk"', () => {
  for (const name of ['close-out', 'clean-up'])
    test(`passes: /${name} names \`wk status\` and \`wk gc\``, async () => {
      const text = flat(skill(await render(WK_LAND_STEP), name));
      expect(text, name).not.toBe('');
      expect(text, name).toContain('`wk status`');
      expect(text, name).toContain('`wk gc`');
      expect(text, name).not.toContain('git worktree remove <worktree>');
    });
});

// Audit 1, B1: a repository that never landed through wk has no landing ref, and `wk status` prints
// it as `missing`. A wait that names only the other two states never ends there.
describe('a landing ref that does not exist yet', () => {
  for (const name of ['delegate', 'clean-up'])
    test(`passes: /${name} lets a commit on the base go ahead while the ref is \`missing\``, async () => {
      const text = flat(skill(await render(WK_LAND_STEP), name));
      expect(text, name).toContain(
        'as `missing`, `at <base>; nothing to land` or `behind <base>`',
      );
    });
});

// Re-audit, non-blocking 1: a diverged ref stops the worker and never clears, so a wait that names
// only the states that clear would wait for ever on it.
describe('a landing ref that has diverged from the base', () => {
  for (const name of ['delegate', 'clean-up'])
    test(`passes: /${name} stops on \`diverged from <base>\` and leaves it to the owner`, async () => {
      const text = flat(skill(await render(WK_LAND_STEP), name));
      expect(text, name).toContain(
        'A ref shown as `diverged from <base>` never clears by waiting',
      );
    });
});

// Re-audit, non-blocking 2: wk counts `submitted`, `landing` and `gated` as in flight, so the case for
// a wait that ends names all three.
describe('a changeset still in flight when the wait ends', () => {
  test('passes: /delegate names every in-flight state', async () => {
    const text = flat(skill(await render(WK_LAND_STEP), 'delegate'));
    expect(text).toContain('**Still `submitted`, `landing` or `gated` when the wait ends**');
  });
});

// Audit 1, B2: only `/delegate` runs `wk submit`, so a shape it does not render for keeps the text it
// has without the key. Otherwise `/close-out` says wk lands work that nothing ever submits.
describe('the key needs a shape that renders /delegate', () => {
  const shapes: Record<string, Answers> = {
    'the light track': { configWeight: 'light' },
    'non-code work': { workKind: 'non-code' },
    'no git': { usesGit: 'no' },
  };
  for (const [label, shape] of Object.entries(shapes))
    for (const name of ['close-out', 'clean-up', 'handoff'])
      test(`passes: on ${label} /${name} renders as it does without the key`, async () => {
        const without = skill(await render({}, 'agent-pushes', shape), name);
        const withKey = skill(await render(WK_LAND_STEP, 'agent-pushes', shape), name);
        expect(withKey, `${label} ${name}`).toBe(without);
        expect(withKey, `${label} ${name}`).not.toContain('wk submit');
      });
});

describe('the key needs agent-pushes', () => {
  for (const name of ['delegate', 'autopilot', 'close-out', 'clean-up'])
    test(`passes: under agent-commits /${name} renders as it does without the key`, async () => {
      const without = skill(await render({}, 'agent-commits'), name);
      expect(without, name).not.toBe('');
      expect(skill(await render(WK_LAND_STEP, 'agent-commits'), name), name).toBe(without);
    });
});
