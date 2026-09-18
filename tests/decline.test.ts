import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { claudeDir, claudeHooksDir, claudeSettingsFile } from '../src/lib/paths.ts';
import { declinedHookHelp, renderHooks } from '../src/render/hooks.ts';
import { DEFAULT_ANSWERS, testContext } from './helpers.ts';

const HOOKS_DIR = claudeHooksDir();
const GUARD = join(HOOKS_DIR, 'commit-guard.sh');
const BANNER = join(HOOKS_DIR, 'session-banner.sh');
const UNRELATED = join(claudeDir(), 'CLAUDE.md');

describe('a declined run hands over the hook snippet it did not merge', () => {
  test('a plan with no hooks in it prints nothing extra', () => {
    expect(declinedHookHelp([UNRELATED])).toBeNull();
    expect(declinedHookHelp([])).toBeNull();
  });

  test('the commit guard alone yields the PreToolUse entry and not the other', () => {
    const help = declinedHookHelp([GUARD, UNRELATED]);
    expect(help).toContain('PreToolUse');
    expect(help).toContain('commit-guard.sh');
    expect(help).not.toContain('SessionStart');
  });

  test('the banner alone yields the SessionStart entry and not the other', () => {
    const help = declinedHookHelp([BANNER, UNRELATED]);
    expect(help).toContain('SessionStart');
    expect(help).toContain('session-banner.sh');
    expect(help).not.toContain('PreToolUse');
  });

  test('both yield both, as one "hooks" object that could be pasted whole', () => {
    const help = declinedHookHelp([GUARD, BANNER]);
    expect(help).toContain('PreToolUse');
    expect(help).toContain('SessionStart');
    expect(help).toContain('"hooks": {');
  });

  test('it names the file to paste into', () => {
    // Contracted to `~`, which is how every other path this tool prints is spelled.
    expect(declinedHookHelp([GUARD])).toContain('settings.json');
    expect(declinedHookHelp([GUARD])).not.toContain(claudeSettingsFile());
  });

  // The confirm covers the whole batch, so the scripts are unwritten too. Saying or implying
  // otherwise would point the snippet at files that are not there.
  test('it does not claim anything was written', () => {
    const help = declinedHookHelp([GUARD, BANNER]) ?? '';
    expect(help).toContain('untouched');
    expect(help).toContain('when you accept a run');
    // Past tense only: "are written to X when you accept a run" is a promise, not a claim.
    expect(help).not.toMatch(
      /\bwas written\b|\bwere written\b|\bwrote\b|\bhas been written\b/i,
    );
  });
});

/**
 * The gap the tests above cannot see: `setup` passes the paths its plan actually holds, and this
 * helper matches on paths it builds itself. If the renderer ever spells one differently, every
 * test above still passes and a declined run silently prints nothing.
 *
 * These stood in for the real confirm while nothing could drive it. `tests/decline-seam.test.ts`
 * drives it now, through the `finish` seam, and these stay: it declines a plan holding a hook
 * path, where this pair is what proves that path is the one `renderHooks` would really plan.
 */
describe('the paths the renderer plans are the paths this matches on', () => {
  test.each([
    ['commit-guard', 'PreToolUse'],
    ['banner', 'SessionStart'],
    ['both', 'PreToolUse'],
  ])('answering hooks=%s produces a plan this recognises', async (choice, expected) => {
    const ctx = testContext({ ...DEFAULT_ANSWERS, hooks: choice });
    const planned = await renderHooks(ctx);
    const help = declinedHookHelp(planned.map((f) => f.path));
    expect(help).not.toBeNull();
    expect(help).toContain(expected as string);
  });

  // `renderHooks(... hooks: 'none' ...) === []` is pinned in `tests/completion-gate.test.ts`
  // ("passes: answering no hooks still means no hooks, on either track"); what this test adds
  // is that `declinedHookHelp` reads that real, empty plan as nothing to hand over too.
  test('answering hooks=none produces a plan with nothing to hand over', async () => {
    const ctx = testContext({ ...DEFAULT_ANSWERS, hooks: 'none' });
    const planned = await renderHooks(ctx);
    expect(declinedHookHelp(planned.map((f) => f.path))).toBeNull();
  });
});
