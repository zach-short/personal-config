/**
 * write-doc-ste Phase 3: the `write-doc-check` question, the `PostToolUse` entry it adds, and the
 * `hook` mode of `templates/write-doc/check.sh` that the entry runs.
 *
 * The promises from `docs/incomplete/write-doc-ste/`. D7 with BD-2 and D10: asked only for non-code
 * work with the skill installed, hooks allowed and skills installed, and the entry planned under
 * exactly the same conditions, whatever answer is saved. BD-6: the command is the script's absolute
 * path and `hook`, and a second merge adds nothing. BD-8: every outcome the agent must see exits 2,
 * a missing `jq` included, and hook mode never prints `PASS`. Design hazard 1: the stamp skip is a
 * port of `stampIndex`, so one fixture set runs through `readStamp` and through the script, and
 * each fixture must get the same verdict from both.
 *
 * Every run of the script goes through `/bin/bash`, so on a Mac it runs under bash 3.2.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { catalogPath } from '../src/lib/catalog.ts';
import { exists, readText, writeText } from '../src/lib/disk.ts';
import { claudeSettingsFile, claudeSkillsDir } from '../src/lib/paths.ts';
import {
  readStamp,
  type StampParts,
  stampAfterFrontmatter,
  stampLine,
  withStamp,
} from '../src/lib/stamp.ts';
import { storedProfileDefault } from '../src/lib/stored-profile-defaults.ts';
import type { Answers, Catalog, PlannedFile, Question } from '../src/lib/types.ts';
import { matchesWhen } from '../src/lib/when.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { defaultFor } from '../src/phases/run.ts';
import { ALL_QUESTIONS } from '../src/questions/index.ts';
import { renderHooks } from '../src/render/hooks.ts';
import { renderAll } from '../src/render/index.ts';
import { renderWriteDoc } from '../src/render/write-doc.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testConfig, testContext } from './helpers.ts';

const CHECK = join(import.meta.dir, '..', 'templates', 'write-doc', 'check.sh');
const BASH = '/bin/bash';
const TOOLS = ['perl', 'grep', 'tr', 'sort', 'head', 'paste', 'cat', 'jq'];
const INSTALLED = join(claudeSkillsDir(), 'write-doc', 'check.sh');
const DASHED = 'One part — two.\n';

type Run = { code: number; stdout: string; stderr: string };

let dir = '';

beforeAll(async () => {
  dir = await tempDir('pc-doc-hook-');
});

afterAll(async () => {
  await cleanup(dir);
});

function question(): Question {
  const found = ALL_QUESTIONS.find((q) => q.id === 'write-doc-check');
  if (!found) throw new Error('write-doc-check is not in the question set');
  return found;
}

async function spawn(argv: string[], stdin: string, path: string): Promise<Run> {
  const proc = Bun.spawn(argv, {
    cwd: dir,
    env: { ...process.env, PATH: path },
    stdin: new TextEncoder().encode(stdin),
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

/** The script in hook mode, with `payload` on stdin as Claude Code sends it. */
function hook(payload: string | object, path = process.env.PATH ?? ''): Promise<Run> {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return spawn([BASH, CHECK, 'hook'], body, path);
}

function write(file: string, content: string): object {
  return {
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: file, content },
  };
}

function edit(file: string, newString: string): object {
  return {
    hook_event_name: 'PostToolUse',
    tool_name: 'Edit',
    tool_input: { file_path: file, old_string: 'x', new_string: newString, replace_all: false },
  };
}

/** A file on disk, as the save left it. Hook mode reads the stamp from here. */
async function saved(name: string, text: string): Promise<string> {
  const path = join(dir, name);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, text);
  return path;
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

/** Answers under which every condition holds, so each negative case changes exactly one. */
const EVERY: Answers = {
  ...DEFAULT_ANSWERS,
  workKind: 'non-code',
  configWeight: 'full',
  usesGit: 'yes',
  hooks: 'commit-guard',
  skills: 'all',
  writeDoc: 'yes',
  writeDocCheck: 'every',
};

async function settingsMerge(answers: Answers): Promise<PlannedFile | undefined> {
  return (await renderHooks(testContext(answers))).find((f) => f.strategy === 'merge-json');
}

async function postToolUse(answers: Answers): Promise<unknown[] | undefined> {
  const merge = await settingsMerge(answers);
  if (!merge) return undefined;
  const body = JSON.parse(merge.contents) as { hooks?: Record<string, unknown[]> };
  return body.hooks?.PostToolUse;
}

async function skillText(answers: Answers): Promise<string> {
  const skill = (await renderWriteDoc(testContext(answers))).find((f) =>
    f.path.endsWith('SKILL.md'),
  );
  if (!skill) throw new Error('SKILL.md was not planned');
  return skill.contents.replace(/\s+/g, ' ');
}

describe('D7, BD-2 and D10: who is asked', () => {
  const ASKED: Answers = {
    workKind: 'non-code',
    writeDoc: 'yes',
    hooks: 'both',
    skills: 'all',
  };

  test('it sits directly after write-doc in the you phase (DIAL-12)', () => {
    const ids = ALL_QUESTIONS.filter((q) => q.phase === 'you').map((q) => q.id);
    expect(ids[ids.indexOf('write-doc') + 1]).toBe('write-doc-check');
  });

  test('asked when all four conditions hold, on both weights', () => {
    for (const configWeight of ['full', 'light']) {
      expect(matchesWhen(question().when, { ...ASKED, configWeight }), configWeight).toBe(true);
    }
  });

  const negatives: Array<[string, Answers]> = [
    ['code work, where a saved yes to the skill stays live (BD-2)', { workKind: 'code' }],
    ['a no to the skill', { writeDoc: 'no' }],
    ['no hooks, whose option promises nothing reaches settings.json', { hooks: 'none' }],
    ['no workflow skills (D10)', { skills: 'none' }],
  ];
  for (const [name, change] of negatives) {
    test(`not asked after ${name}`, () => {
      expect(matchesWhen(question().when, { ...ASKED, ...change })).toBe(false);
    });
  }

  test('the copy is D8 word for word, with skill recommended', () => {
    const q = question();
    expect(q.ask).toBe(
      'Should your agent check every document it saves, or only what /write-doc writes?',
    );
    expect(q.configKey).toBe('writeDocCheck');
    expect(q.readMore).toBe('write-doc');
    expect(q.options?.map((o) => [o.value, o.label, o.example, o.recommended])).toEqual([
      ['skill', 'Only what /write-doc writes', 'no hook is installed', true],
      [
        'every',
        'Every document it saves',
        'a hook flags em dashes, contractions and stock AI phrases; files this setup generated are skipped',
        false,
      ],
    ]);
  });

  test('the wizard, the site and a stored profile all start on skill', async () => {
    expect(storedProfileDefault('writeDocCheck')).toBeNull();
    expect(defaultFor(question(), {}, testConfig())).toBe('skill');
    const catalog = (await Bun.file(catalogPath()).json()) as Catalog;
    const onSite = catalog.questions
      .find((q) => q.id === 'write-doc-check')
      ?.options?.find((o) => o.recommended)?.value;
    expect(onSite).toBe('skill');
  });
});

describe('the PostToolUse entry follows the answers, whatever is saved', () => {
  test('every: one entry on Write|Edit running the installed script in hook mode (BD-6)', async () => {
    expect(await postToolUse(EVERY)).toEqual([
      { matcher: 'Write|Edit', hooks: [{ type: 'command', command: `${INSTALLED} hook` }] },
    ]);
  });

  test('every on the lighter setup: the same entry', async () => {
    const light = { ...EVERY, configWeight: 'light', usesGit: 'no' };
    expect(await postToolUse(light)).toHaveLength(1);
  });

  test('the entry runs the script the skill folder plans, at the same path', async () => {
    const planned = (await renderWriteDoc(testContext(EVERY))).map((f) => f.path);
    expect(planned).toContain(INSTALLED);
  });

  test('skill, and an absent answer, add no entry', async () => {
    expect(await postToolUse({ ...EVERY, writeDocCheck: 'skill' })).toBeUndefined();
    const { writeDocCheck: _, ...absent } = EVERY;
    expect(await postToolUse(absent)).toBeUndefined();
  });

  test('a saved every under hooks none: nothing reaches settings.json', async () => {
    expect(await renderHooks(testContext({ ...EVERY, hooks: 'none' }))).toEqual([]);
  });

  const negatives: Array<[string, Answers]> = [
    ['a later code run (BD-2)', { workKind: 'code' }],
    ['a no to the skill', { writeDoc: 'no' }],
    ['no workflow skills (D10)', { skills: 'none' }],
  ];
  for (const [name, change] of negatives) {
    test(`a saved every adds no entry on ${name}, where no script is planned`, async () => {
      expect(await postToolUse({ ...EVERY, ...change })).toBeUndefined();
      const scripts = (await renderAll(testContext({ ...EVERY, ...change }))).filter(
        (f) => f.path === INSTALLED,
      );
      expect(scripts).toEqual([]);
    });
  }

  /** The merge de-duplicates by exact JSON, so this is what holds BD-6 once a release ships. */
  test('a second merge over what the first wrote adds nothing', async () => {
    const previous = (await exists(claudeSettingsFile()))
      ? await readText(claudeSettingsFile())
      : null;
    try {
      const merge = await settingsMerge(EVERY);
      if (!merge) throw new Error('no settings merge was planned');
      await writeText(claudeSettingsFile(), merge.contents);
      const [change] = await resolvePlan([merge]);
      const after = JSON.parse(change?.after ?? '{}') as { hooks: Record<string, unknown[]> };
      expect(after.hooks.PostToolUse).toHaveLength(1);
      expect(change?.before).toBe(change?.after ?? '');
    } finally {
      if (previous === null) await rm(claudeSettingsFile(), { force: true });
      else await writeText(claudeSettingsFile(), previous);
    }
  });

  test('a PostToolUse entry the person already has is kept, and ours lands beside it', async () => {
    const previous = (await exists(claudeSettingsFile()))
      ? await readText(claudeSettingsFile())
      : null;
    const theirs = { matcher: 'Write', hooks: [{ type: 'command', command: '/opt/lint.sh' }] };
    try {
      await writeText(
        claudeSettingsFile(),
        JSON.stringify({ hooks: { PostToolUse: [theirs] } }),
      );
      const merge = await settingsMerge(EVERY);
      if (!merge) throw new Error('no settings merge was planned');
      const [change] = await resolvePlan([merge]);
      const after = JSON.parse(change?.after ?? '{}') as { hooks: Record<string, unknown[]> };
      expect(after.hooks.PostToolUse?.[0]).toEqual(theirs);
      expect(after.hooks.PostToolUse).toHaveLength(2);
    } finally {
      if (previous === null) await rm(claudeSettingsFile(), { force: true });
      else await writeText(claudeSettingsFile(), previous);
    }
  });
});

describe('Phase 3 item 4: the skill says the check runs on every save only where it does', () => {
  test('under every, the last limit names the hook', async () => {
    const text = await skillText(EVERY);
    expect(text).toContain('A hook also runs this check on the new text of every `.md`');
    expect(text).not.toContain('Nothing checks a file automatically');
  });

  test('under skill, nothing checks a file automatically', async () => {
    const text = await skillText({ ...EVERY, writeDocCheck: 'skill' });
    expect(text).toContain('Nothing checks a file automatically, so always run step 9.');
    expect(text).not.toContain('A hook also runs');
  });

  test('a saved every under hooks none plans no entry, so the skill says so too', async () => {
    const text = await skillText({ ...EVERY, hooks: 'none' });
    expect(text).toContain('Nothing checks a file automatically');
  });
});

describe('hook mode checks the new text of a saved prose file', () => {
  test('an unstamped draft with an em dash: exit 2, the file and the em dash on stderr', async () => {
    const file = await saved('draft.md', DASHED);
    const result = await hook(write(file, DASHED));
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(`problems in the text just saved to ${file}`);
    expect(result.stderr).toContain('Em dash found.');
  });

  test('a contraction and a banned word are named as well', async () => {
    const file = await saved('words.md', 'Plain.\n');
    const result = await hook(edit(file, 'It is crucial, and it isn’t simple.'));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('Contraction found.');
    expect(result.stderr).toContain('Banned words or phrases found: crucial.');
  });

  test('clean text: exit 0 and no output at all, so never a PASS', async () => {
    const file = await saved('clean.md', 'A plain sentence.\n');
    expect(await hook(write(file, 'A plain sentence.\n'))).toEqual({
      code: 0,
      stdout: '',
      stderr: '',
    });
  });

  test('an Edit is judged by its new_string, not by an old em dash elsewhere in the file', async () => {
    const file = await saved('old-dash.md', `${DASHED}A new line.\n`);
    expect((await hook(edit(file, 'A new line.'))).code).toBe(0);
  });

  test('an Edit that deletes text has nothing new to check: exit 0', async () => {
    const file = await saved('deleted.md', 'Plain.\n');
    expect((await hook(edit(file, ''))).code).toBe(0);
  });

  test('a .ts file and a .docx file are not prose files here: exit 0, even with an em dash', async () => {
    for (const name of ['code.ts', 'paper.docx']) {
      const file = await saved(name, DASHED);
      expect((await hook(write(file, DASHED))).code, name).toBe(0);
    }
  });

  test('the extension is read without regard to case', async () => {
    const file = await saved('LOUD.MD', DASHED);
    expect((await hook(write(file, DASHED))).code).toBe(2);
  });

  test('a rule file under .claude/ skips the banned words and still checks the em dash', async () => {
    const file = await saved(join('home', '.claude', 'rules', 'house.md'), 'Plain.\n');
    expect((await hook(edit(file, 'Never write crucial.'))).code).toBe(0);
    expect((await hook(edit(file, DASHED))).code).toBe(2);
  });
});

describe('BD-8: what hook mode could not check exits 2, says why, and prints no PASS', () => {
  test('no jq on PATH: exit 2 naming jq, for a prose file and for any other file', async () => {
    const path = await pathWithout('jq');
    for (const name of ['nojq.md', 'nojq.ts']) {
      const file = await saved(name, 'Plain.\n');
      const result = await hook(write(file, 'Plain.\n'), path);
      expect(result.code, name).toBe(2);
      expect(result.stdout, name).toBe('');
      expect(result.stderr, name).toContain('jq was not found on PATH');
    }
  });

  test('the control: the same PATH with jq in it checks the file', async () => {
    const file = await saved('control.md', 'Plain.\n');
    expect((await hook(write(file, 'Plain.\n'), await pathWithout('none'))).code).toBe(0);
  });

  test('no perl on PATH: exit 2 naming perl', async () => {
    const file = await saved('noperl.md', 'Plain.\n');
    const result = await hook(write(file, 'Plain.\n'), await pathWithout('perl'));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('perl was not found on PATH');
  });

  test('a payload it cannot use: exit 2 with the reason, never exit 0', async () => {
    const file = await saved('payload.md', 'Plain.\n');
    const cases: Array<[string, string | object, string]> = [
      ['an empty payload', '', 'payload on stdin was empty'],
      ['a payload that is not JSON', '{nope', 'jq could not read the hook payload'],
      [
        'no file_path',
        { tool_input: { content: DASHED } },
        'jq could not read the hook payload',
      ],
      [
        'no new text',
        { tool_input: { file_path: file } },
        'jq could not read the hook payload',
      ],
      [
        'new text that is not a string',
        { tool_input: { file_path: file, content: 42 } },
        'not a string',
      ],
      ['a NUL byte in the new text', write(file, 'A\u0000B'), 'NUL byte'],
    ];
    for (const [name, payload, reason] of cases) {
      const result = await hook(payload);
      expect(result.code, name).toBe(2);
      expect(result.stdout, name).toBe('');
      expect(result.stderr, name).toContain(reason);
    }
  });

  test('a saved prose file that is not on disk: exit 2', async () => {
    const result = await hook(write(join(dir, 'gone.md'), DASHED));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('no such file');
  });
});

const PARTS: StampParts = {
  version: '0.7.0',
  date: '2026-10-01',
  configHash: 'abcd1234',
  standardVersion: '1.2.0',
  adapted: false,
};
const STAMP = stampLine(PARTS);

/**
 * Design hazard 1. Each fixture is a file on disk and says whether it is stamped. The expected
 * verdict is written out, so a bug the TypeScript and the port shared would still fail here;
 * then both are held to it. The stamped ones are built with the writers themselves.
 */
const FIXTURES: Array<[string, string, boolean]> = [
  ['line 1 of a markdown file', withStamp(`# Ledger\n\n${DASHED}`, PARTS), true],
  [
    'line 1, marked adapted',
    withStamp(`# Ledger\n${DASHED}`, { ...PARTS, adapted: true }),
    true,
  ],
  ['line 2 below a shebang', withStamp(`#!/usr/bin/env bash\n${DASHED}`, PARTS, 'sh'), true],
  [
    'below a frontmatter block that closes',
    stampAfterFrontmatter(`---\nname: x\n---\n\n${DASHED}`, STAMP),
    true,
  ],
  [
    'right below the frontmatter, with no blank line',
    `---\nname: x\n---\n${STAMP}\n${DASHED}`,
    true,
  ],
  [
    'line 1, with CRLF line endings',
    withStamp(`# Ledger\n${DASHED}`, PARTS).replace(/\n/g, '\r\n'),
    true,
  ],
  // The pattern is not anchored at the start of its line, in `readStamp` or in the port.
  ['line 1, after other text on the same line', `Quoted: ${STAMP}\n${DASHED}`, true],
  ['quoted in prose on line 3', `# Notes\n\nIt reads ${STAMP} there.\n${DASHED}`, false],
  // The stamp sits on the first line after the `---`, where a reader that took line 0 for the
  // close would find it.
  ['right below a frontmatter block that never closes', `---\n${STAMP}\n${DASHED}`, false],
  ['two lines below a shebang', `#!/usr/bin/env bash\n\n${stampLine(PARTS, 'sh')}\n`, false],
  ['a frontmatter block followed only by blank lines', '---\nname: x\n---\n\n\n', false],
  [
    'a config hash one digit short',
    `${STAMP.replace('abcd1234', 'abcd123')}\n${DASHED}`,
    false,
  ],
  ['text after the closing marker', `${STAMP} and more\n${DASHED}`, false],
  ['an empty file', '', false],
];

describe('design hazard 1: readStamp and the bash port agree on every fixture', () => {
  FIXTURES.forEach(([name, text, stamped], i) => {
    test(`${name}: ${stamped ? 'stamped, so skipped' : 'not stamped, so checked'}`, async () => {
      expect(readStamp(text) !== null, 'readStamp').toBe(stamped);
      const file = await saved(`fixture-${i}.md`, text);
      const result = await hook(edit(file, DASHED));
      expect(result.code === 0, 'check.sh hook').toBe(stamped);
      expect(result.code, 'check.sh hook').toBe(stamped ? 0 : 2);
    });
  });
});

describe('G7: the short-track documents this tool generates are left alone', () => {
  const SHORT: Answers = { ...EVERY, configWeight: 'light', usesGit: 'no' };

  for (const suffix of ['HANDOFF.md', 'docs/AGENT-PRACTICES.md']) {
    test(`the rendered ${suffix}, em dashes and all, is skipped; unstamped, it is not`, async () => {
      const planned = (await renderAll(testContext(SHORT))).find((f) =>
        f.path.endsWith(suffix),
      );
      if (!planned) throw new Error(`${suffix} was not planned`);
      expect(planned.contents).toContain('—');

      const file = await saved(`short-${suffix.replace(/\//g, '-')}`, planned.contents);
      expect((await hook(write(file, planned.contents))).code).toBe(0);

      const bare = planned.contents.split('\n').slice(1).join('\n');
      const unstamped = await saved(`bare-${suffix.replace(/\//g, '-')}`, bare);
      expect((await hook(write(unstamped, bare))).code).toBe(2);
    });
  }
});

describe('the entry a run writes runs, the way Claude Code runs a command', () => {
  test('installed by the real pipeline, run through a shell with its command string', async () => {
    const files = await renderWriteDoc(testContext(EVERY));
    try {
      await commitPlan(await resolvePlan(files));
      const entry = (await postToolUse(EVERY))?.[0] as { hooks: Array<{ command: string }> };
      const command = entry.hooks[0]?.command ?? '';

      const draft = await saved('installed.md', DASHED);
      const blocked = await spawn(
        ['/bin/sh', '-c', command],
        JSON.stringify(write(draft, DASHED)),
        process.env.PATH ?? '',
      );
      expect(blocked.code).toBe(2);
      expect(blocked.stderr).toContain('Em dash found.');

      const clean = await saved('installed-clean.md', 'Plain.\n');
      const passed = await spawn(
        ['/bin/sh', '-c', command],
        JSON.stringify(write(clean, 'Plain.\n')),
        process.env.PATH ?? '',
      );
      expect(passed).toEqual({ code: 0, stdout: '', stderr: '' });
    } finally {
      await rm(join(claudeSkillsDir(), 'write-doc'), { recursive: true, force: true });
    }
  });
});
