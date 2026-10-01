/**
 * Board row 76, the finding HANDOFF 93 left open: a declined run hands over every hook entry the
 * planned `settings.json` merge holds. The snippet used to be inferred from the plan's paths, and
 * the `PostToolUse` entry that `write-doc-check: every` adds runs a script the plan holds under
 * either answer, so the paths could not show it and the snippet left it out.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { finish } from '../src/commands/setup.ts';
import { parseCli } from '../src/lib/args.ts';
import { cancelMessage } from '../src/lib/ask.ts';
import {
  claudeHooksDir,
  claudeSettingsFile,
  claudeSkillsDir,
  contractHome,
} from '../src/lib/paths.ts';
import type { Answers, PlannedFile } from '../src/lib/types.ts';
import { resolvePlan } from '../src/lib/write-plan.ts';
import { declinedHookHelp } from '../src/render/hooks.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  recordingPrompter,
  tempDir,
  testContext,
  testRepoPlan,
  testScan,
  withTty,
} from './helpers.ts';

const HOOKS = claudeHooksDir();
const CHECK = join(claudeSkillsDir(), 'write-doc', 'check.sh');

/** The reproduction from HANDOFF 93: the lighter setup, for other work, with every save checked. */
const EVERY: Answers = {
  ...DEFAULT_ANSWERS,
  workKind: 'non-code',
  configWeight: 'light',
  usesGit: 'no',
  hooks: 'commit-guard',
  skills: 'all',
  writeDoc: 'yes',
  writeDocCheck: 'every',
};

/** The one answer set that plans all five entries: both guards, the check, the banner, the gate. */
const ALL_FIVE: Answers = {
  ...EVERY,
  configWeight: 'full',
  usesGit: 'yes',
  hooks: 'both',
};

function mergedHooks(plan: PlannedFile[]): Record<string, unknown> {
  const merge = plan.find(
    (f) => f.path === claudeSettingsFile() && f.strategy === 'merge-json',
  );
  if (!merge) throw new Error('the plan holds no settings.json merge');
  return (JSON.parse(merge.contents) as { hooks: Record<string, unknown> }).hooks;
}

/** The `"hooks": { … }` block alone, from its opening line to the brace that closes it. */
function snippetOf(help: string): string {
  const start = help.indexOf('"hooks": {');
  const end = help.indexOf('\n}\n', start);
  if (start < 0 || end < 0) throw new Error(`no hooks block in:\n${help}`);
  return help.slice(start, end + 2);
}

function commandsIn(hooks: Record<string, unknown>): string[] {
  const text = JSON.stringify(hooks);
  return [...text.matchAll(/"command":("(?:[^"\\]|\\.)*")/g)].map(
    (m) => JSON.parse(m[1] as string) as string,
  );
}

describe('a declined run hands over every event the planned merge holds', () => {
  test('the PostToolUse entry write-doc-check: every adds is in the snippet', async () => {
    const plan = await renderAll(testContext(EVERY));
    expect(Object.keys(mergedHooks(plan))).toContain('PostToolUse');

    const help = declinedHookHelp(plan) ?? '';
    expect(help).toContain('  "PostToolUse": [');
    expect(help).toContain(
      `{ "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "${CHECK} hook" }] }`,
    );
  });

  test.each([
    ['the reproduction', EVERY],
    ['all five entries', ALL_FIVE],
    ['code work, both hooks', { ...DEFAULT_ANSWERS, hooks: 'both' }],
    [
      'the lighter setup on code work',
      { ...DEFAULT_ANSWERS, configWeight: 'light', hooks: 'banner' },
    ],
    ['other work, the check only inside /write-doc', { ...ALL_FIVE, writeDocCheck: 'skill' }],
  ] as [string, Answers][])(
    '%s: pasted inside braces, the snippet is the merge',
    async (_, answers) => {
      const plan = await renderAll(testContext(answers));
      const hooks = mergedHooks(plan);
      const snippet = snippetOf(declinedHookHelp(plan) ?? '');

      // The strongest form of "every event": the block a person pastes is the value a run merges,
      // key order included, so nothing the merge holds can be missing from it.
      expect(JSON.parse(`{${snippet}}`)).toEqual({ hooks });
      expect(Object.keys(JSON.parse(`{${snippet}}`).hooks)).toEqual(Object.keys(hooks));
      for (const command of commandsIn(hooks))
        expect(snippet).toContain(JSON.stringify(command));
    },
  );

  /**
   * The `gateCommand` comment in `src/render/hooks.ts`: an entry string is fixed once a release
   * carries it. These are the lines the path-based snippet printed for the four entries it knew,
   * captured from `0b5c3a8` before the change, with the new entry in the same spacing.
   */
  test('the entries that were there before print byte for byte as they did', async () => {
    const plan = await renderAll(testContext(ALL_FIVE));
    expect(snippetOf(declinedHookHelp(plan) ?? '')).toBe(
      [
        '"hooks": {',
        '  "PreToolUse": [',
        `    { "matcher": "Bash", "hooks": [{ "type": "command", "command": "${join(HOOKS, 'commit-guard.sh')}" }] },`,
        `    { "matcher": "Bash", "hooks": [{ "type": "command", "command": "${join(HOOKS, 'delete-guard.sh')}" }] }`,
        '  ],',
        '  "PostToolUse": [',
        `    { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "${CHECK} hook" }] }`,
        '  ],',
        '  "SessionStart": [',
        `    { "matcher": "startup|resume", "hooks": [{ "type": "command", "command": "${join(HOOKS, 'session-banner.sh')}", "timeout": 5 }] }`,
        '  ],',
        '  "Stop": [',
        `    { "hooks": [{ "type": "command", "command": "bash \\"${join(HOOKS, 'completion-gate.sh')}\\"", "timeout": 120 }] }`,
        '  ]',
        '}',
      ].join('\n'),
    );
  });

  test('the closing line names the folder of every script the entries run', async () => {
    const every = declinedHookHelp(await renderAll(testContext(EVERY))) ?? '';
    expect(every).toContain(
      `Its scripts are written to ${contractHome(HOOKS)} and ${contractHome(join(claudeSkillsDir(), 'write-doc'))} when you accept a run.`,
    );

    const code = declinedHookHelp(
      await renderAll(testContext({ ...DEFAULT_ANSWERS, hooks: 'both' })),
    );
    expect(code).toContain(
      `Its scripts are written to ${contractHome(HOOKS)} when you accept a run.`,
    );
  });

  test('a merge that holds only the output style hands over nothing', async () => {
    const plan = await renderAll(
      testContext({ ...DEFAULT_ANSWERS, hooks: 'none', outputStyle: 'proactive' }),
    );
    expect(plan.some((f) => f.path === claudeSettingsFile())).toBe(true);
    expect(declinedHookHelp(plan)).toBeNull();
  });
});

async function captured(run: () => Promise<number>): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    return { code: await run(), out: lines.join('\n') };
  } finally {
    console.log = original;
  }
}

/**
 * The same promise through the call `setup` makes (`src/commands/setup.ts`, the decline branch of
 * `finish`), so a fix to the helper that the call site never passes the merge to still fails here.
 */
describe("through setup's own decline", () => {
  test('a no at the confirm prints the PostToolUse entry with the others', async () => {
    const dir = await tempDir('pc-decline-every-');
    try {
      const repo = testRepoPlan({ scan: testScan({ path: dir, kind: 'folder' }) });
      const changes = await resolvePlan(await renderAll(testContext(EVERY, repo)));
      const { prompter } = recordingPrompter([false, false]);
      const { code, out } = await captured(() =>
        withTty(true, () => finish(parseCli(['setup']), changes, prompter)),
      );

      expect(code).toBe(0);
      expect(out).toContain(cancelMessage());
      expect(out).toContain('  "PreToolUse": [');
      expect(out).toContain('  "PostToolUse": [');
      expect(out).toContain('  "Stop": [');
      expect(out).toContain(`"command": "${CHECK} hook"`);
    } finally {
      await cleanup(dir);
    }
  });
});
