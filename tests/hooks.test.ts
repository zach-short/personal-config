import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { cleanup, tempDir } from './helpers.ts';

const HOOKS = join(import.meta.dir, '..', 'templates', 'hooks');

/** Exit 2 is what Claude Code reads as "blocked"; 0 lets the tool call through. */
async function guard(toolInput: Record<string, unknown>): Promise<number> {
  const proc = Bun.spawn(['bash', join(HOOKS, 'commit-guard.sh')], {
    stdin: new TextEncoder().encode(
      JSON.stringify({ tool_name: 'Bash', tool_input: toolInput }),
    ),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return proc.exited;
}

const BLOCKED = 2;
const ALLOWED = 0;

describe('the commit guard blocks what it claims to', () => {
  const blocked: Array<[string, string]> = [
    ['a bare commit', 'git commit -m x'],
    ['a push', 'git push origin main'],
    ['a commit behind a global option that takes an argument', 'git -C . commit -m x'],
    ['a commit behind -c', 'git -c user.name=x commit -m y'],
    ['staging everything', 'git add -A'],
    ['staging everything, in a flag cluster', 'git add -Av'],
    ['staging everything by long flag', 'git add --all'],
    ['staging the whole directory', 'git add .'],
    ['a commit after another command', 'ls && git commit -m x'],
    ['a commit on a second line', 'echo hi\ngit push'],
    ['a commit inside a shell wrapper', 'sh -c "git commit -m x"'],
    ['a commit with the binary spelled out', '/usr/bin/git commit -m x'],
  ];

  for (const [what, command] of blocked) {
    test(`violates: ${what}`, async () => {
      expect(await guard({ command })).toBe(BLOCKED);
    });
  }
});

describe('the commit guard lets through what writes nothing', () => {
  const allowed: Array<[string, Record<string, unknown>]> = [
    // The payload carries the description too, and matching it blocked plain `ls`.
    [
      'a command whose description mentions a commit',
      { command: 'ls -la', description: 'look before we git commit' },
    ],
    ['a search for the phrase', { command: 'grep "git commit" PASSOFF.md' }],
    ['printing the phrase', { command: 'echo "git commit"' }],
    ['the status call the ritual starts with', { command: 'git status --short' }],
    ['staging named files', { command: 'git add src/x.ts tests/x.test.ts' }],
    ['reading the log', { command: 'git log --oneline -5' }],
    ['a tool call with no command at all', { file_path: '/tmp/x' }],
  ];

  for (const [what, toolInput] of allowed) {
    test(`passes: ${what}`, async () => {
      expect(await guard(toolInput)).toBe(ALLOWED);
    });
  }
});

/** The banner reads the repo's own `.personal-config.json`, so every case needs a repo. */
async function banner(board: string | null): Promise<string> {
  const dir = await tempDir();
  try {
    await Bun.write(
      join(dir, '.personal-config.json'),
      `${JSON.stringify({ ledgerFile: 'HANDOFF.md', boardFile: 'PASSOFF.md' })}\n`,
    );
    await Bun.write(join(dir, 'HANDOFF.md'), '# H\n');
    if (board !== null) await Bun.write(join(dir, 'PASSOFF.md'), board);

    const proc = Bun.spawn(['bash', join(HOOKS, 'session-banner.sh')], {
      cwd: dir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return out;
  } finally {
    await cleanup(dir);
  }
}

const HEADER = [
  '| # | Task | Status | Model | Lane | Waits on | Files it owns |',
  '|---|------|--------|-------|------|----------|---------------|',
].join('\n');

const VOCABULARY =
  'Status vocabulary, and no other words: `OPEN` · `IN FLIGHT` · `DONE — HANDOFF n` · `HELD`.';

describe('the session banner announces a board row', () => {
  test('violates the old behaviour: the vocabulary sentence is never the open item', async () => {
    const out = await banner(
      `${VOCABULARY}\n\n${HEADER}\n| 1 | Ship it | \`OPEN\` | D | A | — | — |\n`,
    );
    expect(out).not.toContain('Status vocabulary');
    expect(out).toContain('| 1 | Ship it |');
  });

  test('passes: a board whose first row is DONE announces the first OPEN one', async () => {
    const rows = [
      '| 1 | Done thing | `DONE — HANDOFF 2` | D | A | — | — |',
      '| 2 | Open thing | `OPEN` | D | A | — | — |',
    ].join('\n');
    const out = await banner(`${VOCABULARY}\n\n${HEADER}\n${rows}\n`);
    expect(out).toContain('| 2 | Open thing |');
    expect(out).not.toContain('Done thing');
  });

  test('passes: a board with no open rows says so', async () => {
    const out = await banner(
      `${VOCABULARY}\n\n${HEADER}\n| 1 | Done thing | \`DONE — HANDOFF 2\` | D | A | — | — |\n`,
    );
    expect(out).toContain('no OPEN rows');
  });

  test('passes: a repo with no board file at all prints only the ledger line', async () => {
    const out = await banner(null);
    expect(out).toContain('Ledger: HANDOFF.md');
    expect(out).not.toContain('Board:');
  });
});
