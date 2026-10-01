/**
 * write-doc-ste Phase 2: `templates/write-doc/check.sh`, the check `/write-doc` runs on a saved
 * document.
 *
 * Two promises from `docs/incomplete/write-doc-ste/DESIGN.md`. Hazard 2: the script never prints
 * `PASS` on text it did not read, so a missing tool, a missing file and an unreadable file type
 * each exit non-zero with no `PASS`, and the message names the cause. Hazard 3: it runs under bash
 * 3.2, which is why every run here goes through `/bin/bash` rather than whatever `bash` is first on
 * `PATH`; on a Mac that is 3.2.57.
 *
 * A missing tool is simulated with a `PATH` of one directory holding links to every tool the
 * script uses except the one under test. The control case runs the same directory with nothing
 * left out, so a negative case cannot pass because some other tool was missing.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, tempDir } from './helpers.ts';

const CHECK = join(import.meta.dir, '..', 'templates', 'write-doc', 'check.sh');
const BASH = '/bin/bash';
const TOOLS = ['perl', 'grep', 'tr', 'sort', 'head', 'paste', 'cat', 'textutil'];
const HAS_TEXTUTIL = Bun.which('textutil') !== null;

type Run = { code: number; stdout: string; stderr: string };

let dir = '';

async function run(args: string[], path = process.env.PATH ?? ''): Promise<Run> {
  const proc = Bun.spawn([BASH, CHECK, ...args], {
    cwd: dir,
    env: { ...process.env, PATH: path },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}

/** A `PATH` holding every tool the script uses, minus `without`. */
async function pathWithout(without: string): Promise<string> {
  const bin = join(dir, `bin-without-${without}`);
  await mkdir(bin, { recursive: true });
  for (const tool of TOOLS) {
    const found = Bun.which(tool);
    if (tool !== without && found) await symlink(found, join(bin, tool));
  }
  return bin;
}

async function draft(name: string, text: string): Promise<string> {
  await writeFile(join(dir, name), text);
  return name;
}

beforeAll(async () => {
  dir = await tempDir('pc-check-');
});

afterAll(async () => {
  await cleanup(dir);
});

describe('each check fires and names itself', () => {
  test('a clean draft prints PASS and exits 0', async () => {
    const result = await run(['check', await draft('clean.md', 'A plain sentence.\n')]);
    expect(result).toEqual({ code: 0, stdout: 'PASS: clean.md\n', stderr: '' });
  });

  test('an em dash exits 1 and names the em dash', async () => {
    const result = await run(['check', await draft('dash.md', 'One part — two.\n')]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Em dash found.');
    expect(result.stdout).not.toContain('PASS');
  });

  test('a contraction exits 1 and names it, with a straight or a curly apostrophe', async () => {
    for (const [name, text] of [
      ['straight.md', "We don't stop.\n"],
      ['curly.md', 'We don’t stop.\n'],
    ]) {
      const result = await run(['check', await draft(name ?? '', text ?? '')]);
      expect(result.code, name).toBe(1);
      expect(result.stdout, name).toContain('Contraction found.');
    }
  });

  test('a banned word exits 1 and lists what it found, lowercased', async () => {
    const result = await run([
      'check',
      await draft('banned.md', 'This is Crucial. Moreover, the rest.\n'),
    ]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Banned words or phrases found: crucial, moreover.');
  });

  test('a banned phrase across words is caught', async () => {
    const result = await run([
      'check',
      await draft('phrase.md', 'It is not just fast, but cheap.\n'),
    ]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Banned words or phrases found');
  });

  test('every problem is reported, one line each', async () => {
    const result = await run(['check', await draft('all.md', "It's crucial — and more.\n")]);
    expect(result.code).toBe(1);
    expect(result.stdout.trim().split('\n')).toHaveLength(3);
  });

  test('code is not checked for contractions or banned words', async () => {
    const text = "Run `don't` here.\n\n```\nit's crucial\n```\n";
    const result = await run(['check', await draft('code.md', text)]);
    expect(result).toEqual({ code: 0, stdout: 'PASS: code.md\n', stderr: '' });
  });

  test('in a rule file under .claude/, banned words are skipped and the PASS line says so', async () => {
    const nested = join(dir, 'home', '.claude', 'rules');
    await mkdir(nested, { recursive: true });
    const file = join(nested, 'style.md');
    await writeFile(file, 'Do not write crucial.\n');
    const result = await run(['check', file]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(
      `PASS: ${file} (banned words not checked in a rule or skill file under .claude/)\n`,
    );
  });

  test('a relative and an absolute path to the same rule file agree', async () => {
    const result = await run(['check', 'home/.claude/rules/style.md']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('banned words not checked');
  });

  test('anything else under $HOME/.claude/ is skipped too, and nothing outside it', async () => {
    const home = join(dir, 'fake-home');
    await mkdir(join(home, '.claude', 'notes'), { recursive: true });
    const file = join(home, '.claude', 'notes', 'list.md');
    await writeFile(file, 'Do not write crucial.\n');
    const skipped = Bun.spawn([BASH, CHECK, 'check', file], {
      env: { ...process.env, HOME: home },
      stdout: 'pipe',
    });
    expect(await skipped.exited).toBe(0);
    const checked = Bun.spawn([BASH, CHECK, 'check', file], {
      env: { ...process.env, HOME: join(dir, 'another-home') },
      stdout: 'pipe',
    });
    expect(await checked.exited).toBe(1);
  });

  /**
   * Deep review finding 1, 2026-10-01: Claude Code puts a worktree at
   * `<repo>/.claude/worktrees/<name>/`, so a bare `/.claude/` match skipped the banned-word check
   * on every document written in one, and the PASS line made it look intended.
   */
  test('a document in a worktree under .claude/worktrees/ is checked in full', async () => {
    const nested = join(dir, 'repo', '.claude', 'worktrees', 'agent', 'skills');
    await mkdir(nested, { recursive: true });
    const file = join(nested, 'README.md');
    await writeFile(file, 'This is crucial.\n');
    const result = await run(['check', file]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Banned words or phrases found: crucial.');
  });

  /** Deep review finding 3: three backticks in a sentence paired with a later fence. */
  test('three backticks inside a sentence do not hide the prose after them', async () => {
    const text =
      "Type ``` to open a fence. It is crucial and we can't stop.\n\n```\ncode\n```\n";
    const result = await run(['check', await draft('stray.md', text)]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Contraction found.');
    expect(result.stdout).toContain('crucial');
  });

  test('an indented fence is still code, and a fence that never closes is checked', async () => {
    const indented = "- a step:\n\n  ```\n  it's crucial\n  ```\n";
    expect((await run(['check', await draft('indented.md', indented)])).code).toBe(0);
    const open = "```\nit's crucial\n";
    expect((await run(['check', await draft('open.md', open)])).code).toBe(1);
  });

  /** Deep review finding 5: grep reads one line at a time. */
  test('a phrase split across two lines is still found', async () => {
    for (const [name, text] of [
      ['wrapped-summary.md', 'And so, in\nsummary, it works.\n'],
      ['wrapped-not-only.md', 'It is not only this\nbut that.\n'],
    ]) {
      const result = await run(['check', await draft(name ?? '', text ?? '')]);
      expect(result.code, name).toBe(1);
      expect(result.stdout, name).toContain('Banned words or phrases found');
    }
  });
});

describe('hazard 2: it never prints PASS on text it did not read', () => {
  test('the control: the stub PATH with nothing left out still passes a clean draft', async () => {
    const result = await run(['check', 'clean.md'], await pathWithout('none'));
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('PASS: clean.md\n');
  });

  for (const tool of ['perl', 'grep', 'tr', 'sort', 'head', 'paste', 'cat']) {
    test(`with ${tool} off PATH: exit 2, no PASS, and ${tool} is named`, async () => {
      const result = await run(['check', 'clean.md'], await pathWithout(tool));
      expect(result.code).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(`${tool} was not found on PATH`);
    });
  }

  test('a .docx with textutil off PATH: exit 2, no PASS, and textutil is named', async () => {
    await draft('report.docx', 'not really a word file');
    const result = await run(['check', 'report.docx'], await pathWithout('textutil'));
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('textutil was not found on PATH');
  });

  /**
   * Found while building, 2026-10-01: `textutil` reads a file it cannot parse as plain text and
   * exits 0, so a misnamed or damaged `.docx` was checked as its raw bytes and printed PASS.
   */
  test('a .docx that is not a Word file: exit 2, no PASS, even with clean text inside', async () => {
    if (!HAS_TEXTUTIL) return;
    await draft('broken.docx', 'A plain sentence.\n');
    const result = await run(['check', 'broken.docx']);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('does not start the way a .docx file does');
  });

  test('a missing file: exit 2, no PASS', async () => {
    const result = await run(['check', 'absent.md']);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('no such file: absent.md');
  });

  test('an unreadable file: exit 2, no PASS', async () => {
    if (process.getuid?.() === 0) return; // root reads a 000 file, so the case cannot arise
    const name = await draft('locked.md', 'A plain sentence.\n');
    await Bun.spawn(['chmod', '000', join(dir, name)]).exited;
    const result = await run(['check', name]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
  });

  test('a directory: exit 2, no PASS', async () => {
    await mkdir(join(dir, 'folder.md'), { recursive: true });
    const result = await run(['check', 'folder.md']);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
  });

  test('a file type it does not read: exit 2, no PASS', async () => {
    const result = await run(['check', await draft('paper.pdf', 'A plain sentence.\n')]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('not a file type this check reads');
  });

  /**
   * Deep review findings 2 and 4, 2026-10-01: `grep -a` scanned the bytes of a binary file under a
   * text extension, found no word, and passed it; and bash drops a NUL from a command
   * substitution without a warning, which glued `crucial` and `ly` into a word no pattern
   * matched.
   */
  test('binary data under a text extension: exit 2, no PASS', async () => {
    for (const [name, bytes] of [
      ['zipped.md', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x41])],
      ['glued.md', new TextEncoder().encode('crucial\0ly\n')],
    ] as const) {
      await writeFile(join(dir, name), bytes);
      const result = await run(['check', name]);
      expect(result.code, name).toBe(2);
      expect(result.stdout, name).toBe('');
      expect(result.stderr, name).toContain('holds binary data');
    }
  });

  test('an empty file: exit 2, no PASS', async () => {
    const result = await run(['check', await draft('empty.md', '')]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('no text was read');
  });

  // `hook` left this list on 2026-10-01, when write-doc-ste Phase 3 made it a mode; its own
  // failures, an empty payload among them, are in `tests/write-doc-check.test.ts`.
  test('no mode, an unknown mode, or a missing file argument: exit 2, no PASS', async () => {
    for (const args of [[], ['lint'], ['check'], ['check', 'clean.md', 'extra']]) {
      const result = await run(args);
      expect(result.code, args.join(' ')).toBe(2);
      expect(result.stdout, args.join(' ')).toBe('');
      expect(result.stderr, args.join(' ')).toContain('usage: check.sh check FILE');
    }
  });

  test('a path that starts with a dash is read as a file, not an option', async () => {
    const result = await run(['check', await draft('-n.md', 'A plain sentence.\n')]);
    expect(result).toEqual({ code: 0, stdout: 'PASS: -n.md\n', stderr: '' });
  });
});

describe('Word files, where textutil exists', () => {
  test('a .docx with an em dash exits 1 and names it; a clean one passes', async () => {
    if (!HAS_TEXTUTIL) return;
    for (const [name, text, code] of [
      ['dashed', 'One part — two.', 1],
      ['plain', 'A plain sentence.', 0],
    ] as const) {
      await draft(`${name}.txt`, `${text}\n`);
      const made = Bun.spawn(['textutil', '-convert', 'docx', `${name}.txt`], { cwd: dir });
      expect(await made.exited).toBe(0);
      const result = await run(['check', `${name}.docx`]);
      expect(result.code, name).toBe(code);
    }
  });
});

describe('hazard 3: bash 3.2', () => {
  test('the script runs under /bin/bash, whatever its version', async () => {
    // An array named without an index is its first element, the major version.
    const proc = Bun.spawn([BASH, '-c', 'echo $BASH_VERSINFO'], { stdout: 'pipe' });
    const major = Number((await new Response(proc.stdout).text()).trim());
    // Recorded rather than asserted: on Linux /bin/bash is 5. On a Mac it is 3, and every test
    // above then ran the script under 3.2.
    expect(major).toBeGreaterThanOrEqual(3);
  });

  test('no construct that needs bash 4', async () => {
    const source = await Bun.file(CHECK).text();
    const code = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    expect(code).not.toMatch(/declare -A|local -A|\$\{\w+(\^\^|,,|\^|,)\}|mapfile|readarray/);
    expect(code).not.toMatch(/\|&|&>>|coproc|local -n|declare -n/);
  });
});
