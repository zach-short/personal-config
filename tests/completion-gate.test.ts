import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { renderHooks } from '../src/render/hooks.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testContext } from './helpers.ts';

const HOOK = join(import.meta.dir, '..', 'templates', 'hooks', 'completion-gate.sh');

const BLOCKED = 2;
const ALLOWED = 0;

/**
 * The markers are assembled rather than written out, and that is not style: the gate scans the
 * changed source files of whatever repo it runs in, and this file is one of them. A test fixture
 * spelled literally would make every session in this repo block on this file — the same reason
 * the hook skips `hooks/` and skips `.md`.
 */
const REST_OF = `// ... ${'rest'} of the ${'implementation'}`;
const ELIDED = `// ${'...'} existing ${'code'} ...`;
const PROSE = `the ${'rest'} of the ${'file'} is unchanged, as documents often are`;

type Fired = { code: number; stdout: string; stderr: string };

/** A Stop payload, as the harness sends it. Only `stop_hook_active` is read. */
function payload(active: boolean): string {
  return JSON.stringify({
    session_id: 'test',
    transcript_path: '/dev/null',
    hook_event_name: 'Stop',
    stop_hook_active: active,
  });
}

async function fire(dir: string, active = false): Promise<Fired> {
  const proc = Bun.spawn(['bash', HOOK], {
    cwd: dir,
    stdin: new TextEncoder().encode(payload(active)),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, stdout, stderr };
}

async function run(dir: string, args: string[]): Promise<void> {
  const proc = Bun.spawn(args, { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
  await proc.exited;
}

/** A git repo with one committed file, so `git status --porcelain` has a baseline to report against. */
async function gitRepo(): Promise<string> {
  const dir = await tempDir('pc-gate-');
  await run(dir, ['git', 'init', '-q', '.']);
  await run(dir, ['git', 'config', 'user.email', 'test@example.invalid']);
  await run(dir, ['git', 'config', 'user.name', 'test']);
  await Bun.write(join(dir, 'a.ts'), 'export function a(): number {\n  return 1;\n}\n');
  await run(dir, ['git', 'add', 'a.ts']);
  await run(dir, ['git', 'commit', '-qm', 'init']);
  return dir;
}

async function withGate(dir: string, command: string): Promise<void> {
  await Bun.write(
    join(dir, '.personal-config.json'),
    `${JSON.stringify({ gateCommand: command }, null, 2)}\n`,
  );
}

describe('the completion gate blocks a turn that left work unfinished', () => {
  test('violates: a placeholder marker in a changed source file blocks, and the reason names it', async () => {
    const dir = await gitRepo();
    try {
      await Bun.write(join(dir, 'b.ts'), `export function b() {\n  ${REST_OF}\n}\n`);
      const { code, stderr } = await fire(dir);
      expect(code).toBe(BLOCKED);
      expect(stderr).toContain('placeholder');
      expect(stderr).toContain('b.ts');
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: a file summarised instead of edited blocks too', async () => {
    const dir = await gitRepo();
    try {
      await Bun.write(join(dir, 'a.ts'), `export function a() {\n  ${ELIDED}\n}\n`);
      expect((await fire(dir)).code).toBe(BLOCKED);
    } finally {
      await cleanup(dir);
    }
  });

  /**
   * The documented self-loop. Claude Code sets `stop_hook_active` once a Stop hook has already
   * continued the turn; a hook that blocks again there fights itself until the 8-block cap ends
   * the turn for it. The same tree that blocks above must pass here, or the flag is not read.
   */
  test('passes: `stop_hook_active` short-circuits the same tree that would otherwise block', async () => {
    const dir = await gitRepo();
    try {
      await Bun.write(join(dir, 'b.ts'), `export function b() {\n  ${REST_OF}\n}\n`);
      expect((await fire(dir, true)).code).toBe(ALLOWED);
    } finally {
      await cleanup(dir);
    }
  });

  test('passes: a clean tree with a passing gate command does not block', async () => {
    const dir = await gitRepo();
    try {
      await withGate(dir, 'exit 0');
      expect((await fire(dir)).code).toBe(ALLOWED);
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: a failing gate command blocks, and the reason quotes the command', async () => {
    const dir = await gitRepo();
    try {
      await withGate(dir, 'echo suite red; exit 1');
      const { code, stderr } = await fire(dir);
      expect(code).toBe(BLOCKED);
      expect(stderr).toContain('gate command');
      expect(stderr).toContain('echo suite red');
      expect(stderr).toContain('suite red');
    } finally {
      await cleanup(dir);
    }
  });

  /**
   * The deliberate choice, asserted rather than left to a comment: a repo with no gate command
   * configured is not a repo whose work is unproven. Every folder target and every repo set up
   * before the key existed is in that state, and a hook that refused them would be uninstalled
   * before it ever caught anything.
   */
  test('passes: no gate command configured runs no gate and blocks nothing', async () => {
    const dir = await gitRepo();
    try {
      expect((await fire(dir)).code).toBe(ALLOWED);
      await withGate(dir, '');
      expect((await fire(dir)).code).toBe(ALLOWED);
    } finally {
      await cleanup(dir);
    }
  });

  test('passes: the same marker in prose is not a placeholder, and markdown is not scanned', async () => {
    const dir = await gitRepo();
    try {
      await Bun.write(join(dir, 'NOTES.md'), `# Notes\n\n${PROSE}\n`);
      expect((await fire(dir)).code).toBe(ALLOWED);
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: a plain folder with no git is still scanned', async () => {
    const dir = await tempDir('pc-gate-folder-');
    try {
      await Bun.write(join(dir, 'x.py'), `def f():\n    ${REST_OF.replace('//', '#')}\n`);
      expect((await fire(dir)).code).toBe(BLOCKED);
    } finally {
      await cleanup(dir);
    }
  });
});

function paths(files: { path: string }[]): string[] {
  return files.map((f) => f.path.split('/').at(-1) ?? '');
}

function settings(files: { path: string; contents: string }[]): Record<string, unknown> {
  const file = files.find((f) => f.path.endsWith('settings.json'));
  return JSON.parse(file?.contents ?? '{}') as Record<string, unknown>;
}

describe('every track that installs hooks installs the gate', () => {
  test('passes: the full track keeps both existing hooks and adds Stop', async () => {
    const files = await renderHooks(testContext({ ...DEFAULT_ANSWERS, hooks: 'both' }));
    expect(paths(files)).toEqual([
      'commit-guard.sh',
      'session-banner.sh',
      'completion-gate.sh',
      'settings.json',
    ]);
    const hooks = settings(files).hooks as Record<string, unknown>;
    expect(Object.keys(hooks).sort()).toEqual(['PreToolUse', 'SessionStart', 'Stop']);
  });

  /**
   * D16's supersession of D6, in one assertion. D6 cut every hook from the light track on a
   * context-budget argument; a shell script spends no context, so the gate survives the cut and
   * the git-specific commit guard does not.
   */
  test('violates the old cut: the light track writes the gate and nothing else', async () => {
    const files = await renderHooks(
      testContext({ ...DEFAULT_ANSWERS, hooks: 'both', configWeight: 'light' }),
    );
    expect(paths(files)).toEqual(['completion-gate.sh', 'settings.json']);
    expect(Object.keys(settings(files).hooks as Record<string, unknown>)).toEqual(['Stop']);
  });

  test('passes: answering no hooks still means no hooks, on either track', async () => {
    const full = await renderHooks(testContext({ ...DEFAULT_ANSWERS, hooks: 'none' }));
    const light = await renderHooks(
      testContext({ ...DEFAULT_ANSWERS, hooks: 'none', configWeight: 'light' }),
    );
    expect(full).toEqual([]);
    expect(light).toEqual([]);
  });

  test('passes: the Stop entry runs the script through bash, which needs no executable bit', async () => {
    const files = await renderHooks(testContext({ ...DEFAULT_ANSWERS, hooks: 'commit-guard' }));
    const stop = JSON.stringify((settings(files).hooks as Record<string, unknown>).Stop);
    expect(stop).toContain('bash ');
    expect(stop).toContain('completion-gate.sh');
  });
});

describe('the output-style answer reaches settings.json by the one merge', () => {
  test('violates the default: answering "act" writes the documented style name', async () => {
    const files = await renderHooks(
      testContext({ ...DEFAULT_ANSWERS, hooks: 'both', outputStyle: 'proactive' }),
    );
    expect(settings(files).outputStyle).toBe('Proactive');
  });

  /**
   * "Check first" writes no key at all rather than a second style name: an absent `outputStyle`
   * is the documented default, so inventing a value for the recommended answer would change
   * behaviour for everyone who re-runs the wizard and answers the way they already had.
   */
  test('passes: answering "check first" writes no output style key', async () => {
    const files = await renderHooks(
      testContext({ ...DEFAULT_ANSWERS, hooks: 'both', outputStyle: 'check-first' }),
    );
    expect('outputStyle' in settings(files)).toBe(false);
  });

  test('passes: a style with no hooks still lands, through the same merge and not a second one', async () => {
    const files = await renderHooks(
      testContext({ ...DEFAULT_ANSWERS, hooks: 'none', outputStyle: 'proactive' }),
    );
    expect(paths(files)).toEqual(['settings.json']);
    expect(settings(files)).toEqual({ outputStyle: 'Proactive' });
  });
});
