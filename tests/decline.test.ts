import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { claudeDir, claudeSettingsFile } from '../src/lib/paths.ts';
import type { PlannedFile } from '../src/lib/types.ts';
import { declinedHookHelp, renderHooks } from '../src/render/hooks.ts';
import { DEFAULT_ANSWERS, testContext } from './helpers.ts';

const UNRELATED: PlannedFile = {
  path: join(claudeDir(), 'CLAUDE.md'),
  contents: '# rules\n',
  label: 'a global rule',
  strategy: 'overwrite',
};

/**
 * What `renderHooks` plans for one answer to the hooks question. A list of paths no longer
 * stands in for a plan here: the helper reads the planned `settings.json` merge (board row 76),
 * and only the renderer can say what that merge holds.
 */
function hooksPlan(choice: string): Promise<PlannedFile[]> {
  return renderHooks(testContext({ ...DEFAULT_ANSWERS, hooks: choice }));
}

describe('a declined run hands over the hook snippet it did not merge', () => {
  test('a plan with no hooks in it prints nothing extra', () => {
    expect(declinedHookHelp([UNRELATED])).toBeNull();
    expect(declinedHookHelp([])).toBeNull();
  });

  test('the commit guard alone yields the PreToolUse entry and not the other', async () => {
    const help = declinedHookHelp([...(await hooksPlan('commit-guard')), UNRELATED]);
    expect(help).toContain('PreToolUse');
    expect(help).toContain('commit-guard.sh');
    expect(help).not.toContain('SessionStart');
  });

  test('the banner alone yields the SessionStart entry and not the other', async () => {
    const help = declinedHookHelp([...(await hooksPlan('banner')), UNRELATED]);
    expect(help).toContain('SessionStart');
    expect(help).toContain('session-banner.sh');
    expect(help).not.toContain('PreToolUse');
  });

  test('both yield both, as one "hooks" object that could be pasted whole', async () => {
    const help = declinedHookHelp(await hooksPlan('both'));
    expect(help).toContain('PreToolUse');
    expect(help).toContain('SessionStart');
    expect(help).toContain('"hooks": {');
  });

  test('it names the file to paste into', async () => {
    const help = declinedHookHelp(await hooksPlan('commit-guard'));
    // Contracted to `~`, which is how every other path this tool prints is spelled.
    expect(help).toContain('settings.json');
    expect(help).not.toContain(claudeSettingsFile());
  });

  // The confirm covers the whole batch, so the scripts are unwritten too. Saying or implying
  // otherwise would point the snippet at files that are not there.
  test('it does not claim anything was written', async () => {
    const help = declinedHookHelp(await hooksPlan('both')) ?? '';
    expect(help).toContain('untouched');
    expect(help).toContain('when you accept a run');
    // Past tense only: "are written to X when you accept a run" is a promise, not a claim.
    expect(help).not.toMatch(
      /\bwas written\b|\bwere written\b|\bwrote\b|\bhas been written\b/i,
    );
  });
});

/**
 * The gap the unit tests can miss: `setup` passes the plan it actually holds, and this helper
 * finds the merge by `claudeSettingsFile()` and the `merge-json` strategy. If the renderer ever
 * plans the merge under another path or strategy, a declined run silently prints nothing.
 *
 * These stood in for the real confirm while nothing could drive it. `tests/decline-seam.test.ts`
 * drives it now, through the `finish` seam, and these stay: they prove the merge the helper reads
 * is the one `renderHooks` would really plan.
 */
describe('the merge the renderer plans is the merge this reads', () => {
  test.each([
    ['commit-guard', 'PreToolUse'],
    ['banner', 'SessionStart'],
    ['both', 'PreToolUse'],
  ])('answering hooks=%s produces a plan this recognises', async (choice, expected) => {
    const help = declinedHookHelp(await hooksPlan(choice));
    expect(help).not.toBeNull();
    expect(help).toContain(expected as string);
  });

  // `renderHooks(... hooks: 'none' ...) === []` is pinned in `tests/completion-gate.test.ts`
  // ("passes: answering no hooks still means no hooks, on either track"); what this test adds
  // is that `declinedHookHelp` reads that real, empty plan as nothing to hand over too.
  test('answering hooks=none produces a plan with nothing to hand over', async () => {
    expect(declinedHookHelp(await hooksPlan('none'))).toBeNull();
  });
});
