import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const HOOK = join(import.meta.dir, '..', 'templates', 'hooks', 'delete-guard.sh');

/** Exit 2 is what Claude Code reads as "blocked"; 0 lets the tool call through. */
const BLOCKED = 2;
const ALLOWED = 0;

type Fired = { code: number; stderr: string };

async function fire(toolInput: Record<string, unknown>): Promise<Fired> {
  const proc = Bun.spawn(['bash', HOOK], {
    stdin: new TextEncoder().encode(
      JSON.stringify({ tool_name: 'Bash', tool_input: toolInput }),
    ),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stderr = await new Response(proc.stderr).text();
  return { code: await proc.exited, stderr };
}

async function guard(toolInput: Record<string, unknown>): Promise<number> {
  return (await fire(toolInput)).code;
}

/**
 * The commit guard's analogue for work that is not in a repository (setup-tracks `DESIGN.md`
 * D25, ratified 2026-09-22). The verb table is the only thing that differs: a repo's
 * irreversible step is a commit, and a folder's is a delete.
 *
 * The cases below are the commit guard's own, transposed — every form its parser sees
 * `git commit` in, this one must see `rm` in — because the parser is copied rather than
 * reinvented (G34), and a copy that drifts is worth less than no copy at all.
 */
describe('the delete guard blocks what it claims to', () => {
  const blocked: Array<[string, string]> = [
    ['a bare delete', 'rm notes.md'],
    ['a recursive delete', 'rm -rf drafts'],
    ['rmdir', 'rmdir drafts'],
    ['unlink', 'unlink notes.md'],
    ['a delete behind sudo', 'sudo rm notes.md'],
    ['a delete after another command', 'ls && rm notes.md'],
    ['a delete on a second line', 'echo hi\nrm notes.md'],
    ['a delete inside a shell wrapper', 'sh -c "rm notes.md"'],
    ['a delete with the binary spelled out', '/bin/rm notes.md'],
    ['a delete fed through xargs', 'find . -name "*.tmp" | xargs rm'],
    ['a delete behind an environment assignment', 'FOO=1 rm notes.md'],
  ];

  for (const [what, command] of blocked) {
    test(`violates: ${what}`, async () => {
      expect(await guard({ command })).toBe(BLOCKED);
    });
  }

  test('violates: the refusal names the alternative rather than only refusing', async () => {
    const { code, stderr } = await fire({ command: 'rm notes.md' });
    expect(code).toBe(BLOCKED);
    expect(stderr).toContain('mv');
    expect(stderr).toContain('Trash');
  });
});

describe('the delete guard lets through what deletes nothing', () => {
  const allowed: Array<[string, Record<string, unknown>]> = [
    // Lesson 1 of the commit guard's header, transposed: the payload carries the tool's own
    // description, and matching it blocked a plain `ls`.
    [
      'a command whose description mentions a delete',
      { command: 'ls -la', description: 'look before we rm the drafts folder' },
    ],
    ['a search for the word', { command: 'grep "rm" notes.md' }],
    ['printing the word', { command: 'echo "rm -rf drafts"' }],
    ['the move the refusal asks for', { command: 'mv notes.md ~/.Trash/' }],
    ['moving a file beside itself', { command: 'mv notes.md notes.md.2026-09-22' }],
    ['a word that merely ends in the verb', { command: 'npm run charm' }],
    ['a tool call with no command at all', { file_path: '/tmp/x' }],
  ];

  for (const [what, toolInput] of allowed) {
    test(`passes: ${what}`, async () => {
      expect(await guard(toolInput)).toBe(ALLOWED);
    });
  }
});

/**
 * §10.6 reserves these deliberately: `trash`, `find -delete` and `git clean` are recorded in the
 * long form as **not caught**, because a guard that grows by objection becomes the parallel
 * exclusion list D5 refused. They are asserted here so that adding one later is a decision
 * someone takes against a red test, rather than a quiet widening of the verb table.
 */
describe('the delete guard stops where the design says it stops', () => {
  const reserved: Array<[string, string]> = [
    ['find -delete', 'find . -name "*.tmp" -delete'],
    ['git clean', 'git clean -fd'],
    ['a truncating redirect', 'echo "" > notes.md'],
    ['a script that deletes when it runs', './tidy.sh'],
  ];

  for (const [what, command] of reserved) {
    test(`passes, and is recorded as not caught: ${what}`, async () => {
      expect(await guard({ command })).toBe(ALLOWED);
    });
  }
});
