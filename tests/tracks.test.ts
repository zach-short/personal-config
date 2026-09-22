/**
 * The four shapes of output (setup-tracks `DESIGN.md` §3.1) and the two promises item 44 made
 * under them. The full track — code, the whole method, git — renders the bytes it rendered at
 * 0.3.0, checked against a snapshot of those bytes rather than against itself. The other three
 * render *less*: a light run writes no `model-routing.md`, no commit guard, no board; a non-code
 * run writes no `commits.md`, no `docs-lookup.md`, no code standard.
 *
 * Every negative case is asked with the answers that would have produced the file on the full
 * track — hooks both, skills all, a docs tool named, model routing on — because a run that writes
 * everything passes any test that checks only what is present.
 */
import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { planRepo } from '../src/commands/setup.ts';
import { runDoctorOn } from '../src/doctor/index.ts';
import { defaultsPrompter } from '../src/lib/ask.ts';
import { readText } from '../src/lib/disk.ts';
import { contractHome, home, repoRoot } from '../src/lib/paths.ts';
import { readStamp } from '../src/lib/stamp.ts';
import { leftoverTokens } from '../src/lib/template.ts';
import type { Answers, PlannedFile, RepoPlan } from '../src/lib/types.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { targetAnswers } from '../src/render/context.ts';
import { renderAll } from '../src/render/index.ts';
import { standardVersion } from '../src/render/standard.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  tempDir,
  testConfig,
  testContext,
  testRepoPlan,
  testScan,
} from './helpers.ts';

/** Every optional file switched on, so an absence below is the track's doing and nothing else's. */
const EVERYTHING: Answers = {
  ...DEFAULT_ANSWERS,
  hooks: 'both',
  skills: 'all',
  docsMcp: 'Context7 MCP',
  modelRouting: 'delegate-or-stop',
  outputStyle: 'check-first',
  proofLine: '',
};

type Shape = {
  workKind: 'code' | 'non-code';
  configWeight: 'full' | 'light';
  usesGit: 'yes' | 'no';
};

const CODE_FULL_GIT: Shape = { workKind: 'code', configWeight: 'full', usesGit: 'yes' };
const CODE_FULL_NO_GIT: Shape = { workKind: 'code', configWeight: 'full', usesGit: 'no' };
const CODE_LIGHT: Shape = { workKind: 'code', configWeight: 'light', usesGit: 'yes' };
const NON_CODE_FULL: Shape = { workKind: 'non-code', configWeight: 'full', usesGit: 'yes' };
const NON_CODE_LIGHT: Shape = { workKind: 'non-code', configWeight: 'light', usesGit: 'no' };

function answersFor(shape: Shape, extra: Answers = {}): Answers {
  return { ...EVERYTHING, ...shape, ...extra };
}

/** A plain directory (D5): no remote, nothing detected, `n/a` for a mode it cannot have. */
function folderPlan(overrides: Partial<RepoPlan> = {}): RepoPlan {
  return testRepoPlan({
    scan: testScan({
      kind: 'folder',
      name: 'accounts',
      path: '/tmp/accounts',
      remoteOwner: null,
      languages: [],
      packageManager: null,
      hasCi: false,
    }),
    trackMode: 'n/a',
    ...overrides,
  });
}

async function render(
  shape: Shape,
  plan: RepoPlan,
  extra: Answers = {},
): Promise<PlannedFile[]> {
  return renderAll(testContext(answersFor(shape, extra), plan));
}

function names(files: PlannedFile[]): string[] {
  return files.map((f) => contractHome(f.path));
}

function text(files: PlannedFile[], suffix: string): string {
  return files.find((f) => f.path.endsWith(suffix))?.contents ?? '';
}

const LONG_STANDARD_MARK = '# Part 0 — Adapt protocol';
const SHORT_STANDARD_MARK = '# Working standard — short form';
const COMMIT_PARAGRAPH = '**Commits are the owner’s.**';

/**
 * §2's first non-scope item, as bytes. `tests/golden/full-track.json` holds one sha256 per file
 * for three full-track variants, generated on 2026-09-19 from the renderers at commit `bf7d65a`
 * (0.3.0) before item 44 touched them. Two things are normalised on both sides: the sandbox
 * `$HOME` inside the hook paths, and the standard's own version line, which moves with every
 * `standard/VERSION` bump and did so at 1.0.2 → 1.0.3 with no complaint. Everything else has to
 * match exactly, and a mismatch names the file.
 *
 * **One file has moved since, deliberately: `skills/close-out/SKILL.md` (item 51, 2026-09-22).**
 * It told every reader to post the runtime-pass entries and offered a project-folder branch, and
 * the target here keeps a ledger and has neither — false in this shape, not only in the new ones,
 * which is why it was corrected rather than branched away from. `skills/handoff/SKILL.md` renders
 * the bytes it rendered at 0.3.0 and the assertion below is what proves it.
 */
describe('§3.1 row 1 — code + full + git is the 0.3.0 output, byte for byte bar one skill', () => {
  const FULL = answersFor(CODE_FULL_GIT);
  const VARIANTS: Record<string, { answers: Answers; plan: RepoPlan }> = {
    tracked: { answers: FULL, plan: testRepoPlan({ archiveHome: '~/archive/example' }) },
    untracked: {
      answers: FULL,
      plan: testRepoPlan({
        trackMode: 'untracked',
        owned: false,
        scan: testScan({ remoteOwner: 'someone-else' }),
      }),
    },
    team: {
      answers: { ...FULL, mode: 'team', tracker: 'GitHub Issues' },
      plan: testRepoPlan({ scan: testScan({ languages: ['typescript', 'go'], hasCi: false }) }),
    },
  };

  function normalize(contents: string): string {
    return contents
      .replaceAll(home(), '~')
      .replace(/\*\*Standard version: \S+\*\*/, '**Standard version: ·**');
  }

  async function golden(): Promise<Record<string, string>> {
    const path = join(repoRoot(), 'tests', 'golden', 'full-track.json');
    return JSON.parse(await readText(path)) as Record<string, string>;
  }

  test('the snapshot is not empty', async () => {
    expect(Object.keys(await golden()).length).toBe(62);
  });

  for (const [variant, { answers, plan }] of Object.entries(VARIANTS)) {
    test(`the ${variant} variant renders the snapshot's files with the snapshot's bytes`, async () => {
      const expected = Object.fromEntries(
        Object.entries(await golden()).filter(([key]) => key.startsWith(`${variant} `)),
      );
      const files = await renderAll(testContext(answers, plan));
      const actual = Object.fromEntries(
        files.map((f) => [
          `${variant} ${contractHome(f.path)}`,
          createHash('sha256').update(normalize(f.contents)).digest('hex'),
        ]),
      );
      expect(actual).toEqual(expected);
    });
  }
});

describe('DIAL-5, DIAL-9, D10 — the short standard as a document', () => {
  test('DIAL-5: the source is at most 200 lines', async () => {
    const source = await readText(join(repoRoot(), 'standard', 'AGENT-PRACTICES.short.md'));
    expect(source.trimEnd().split('\n').length).toBeLessThanOrEqual(200);
  });

  /** D10: one number, two documents — and nothing before this checked the two header lines. */
  test('both documents carry the version standard/VERSION declares', async () => {
    const declared = await standardVersion();
    for (const name of ['AGENT-PRACTICES.boilerplate.md', 'AGENT-PRACTICES.short.md']) {
      const doc = await readText(join(repoRoot(), 'standard', name));
      expect(doc.match(/\*\*Standard version: (\S+)\*\*/)?.[1], name).toBe(declared);
    }
  });

  test('rendered, it has no Part 0 and no token left for one', async () => {
    const files = await render(NON_CODE_FULL, testRepoPlan());
    const standard = text(files, 'docs/AGENT-PRACTICES.md');
    expect(standard).toContain(SHORT_STANDARD_MARK);
    expect(standard).not.toContain(LONG_STANDARD_MARK);
    expect(standard).not.toContain('Appendix A');
    expect(leftoverTokens(standard)).toEqual([]);
  });

  test('the twelve rules survive under their own numbers, each with a test', async () => {
    const standard = text(
      await render(NON_CODE_LIGHT, folderPlan()),
      'docs/AGENT-PRACTICES.md',
    );
    for (let n = 1; n <= 12; n += 1) expect(standard).toContain(`**R${n} — `);
    expect(standard.match(/\*Test:\*/g)?.length).toBe(12);
  });

  /** D10 seen rather than reasoned about: the stamp on a light file and a full file agree. */
  test('a light file and a full file stamp the same standard version', async () => {
    const version = await standardVersion();
    const light = testContext(answersFor(CODE_LIGHT), testRepoPlan());
    const full = testContext(answersFor(CODE_FULL_GIT), testRepoPlan());
    light.stamp = { ...light.stamp, standardVersion: version };
    full.stamp = { ...full.stamp, standardVersion: version };

    const lightStamp = readStamp(text(await renderAll(light), 'docs/AGENT-PRACTICES.md'));
    const fullStamp = readStamp(text(await renderAll(full), 'docs/AGENT-PRACTICES.md'));
    expect(lightStamp?.standardVersion).toBe(version);
    expect(fullStamp?.standardVersion).toBe(version);
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('§3.1 row 2 — code + full + no git', () => {
  test('the 0.3.0 output minus the commit rules, on a folder', async () => {
    const scripts = testScan({
      kind: 'folder',
      name: 'scripts',
      path: '/tmp/scripts',
      remoteOwner: null,
    });
    const files = await render(CODE_FULL_NO_GIT, folderPlan({ scan: scripts }));
    const paths = names(files);

    // The long standard, the router, the board, Part 0 and the two neutral rules all stay.
    expect(text(files, 'docs/AGENT-PRACTICES.md')).toContain(LONG_STANDARD_MARK);
    expect(paths).toContain('/tmp/scripts/CLAUDE.md');
    expect(paths).toContain('/tmp/scripts/PASSOFF.md');
    expect(paths).toContain('/tmp/scripts/PART0-PROMPT.md');
    expect(paths).toContain('~/.claude/rules/model-routing.md');
    expect(paths).toContain('~/.claude/rules/docs-lookup.md');
    expect(paths.filter((p) => p.includes('/skills/'))).toHaveLength(4);

    // The commit rules go, everywhere they were restated.
    expect(paths).not.toContain('~/.claude/rules/commits.md');
    expect(text(files, 'CLAUDE.md')).not.toContain('Never run `git');
    expect(text(files, 'docs/AGENT-PRACTICES.md')).not.toContain(COMMIT_PARAGRAPH);
    expect(text(files, 'PART0-PROMPT.md')).toContain('Part 6');
    expect(text(files, 'PART0-PROMPT.md')).not.toContain('Never run `git');

    // A folder has no `.git`, and a person who keeps no work in git has nothing to hide from it.
    expect(paths.filter((p) => p.includes('/.git'))).toEqual([]);
    expect(files.find((f) => f.path.endsWith('CLAUDE.md'))?.label).toBe('router');
  });

  test('a git repo the person says they do not use as one still gets no ignore entries', async () => {
    const files = await render(CODE_FULL_NO_GIT, testRepoPlan());
    expect(names(files)).not.toContain('/tmp/example/.gitignore');
    expect(names(files)).not.toContain('~/.claude/rules/commits.md');
  });
});

describe('§3.1 row 3 — code + light: D6 minus what D16 gave back', () => {
  test('violates the full track: no model-routing.md, two skills, the gate alone, no board, no Part 0', async () => {
    const files = await render(CODE_LIGHT, testRepoPlan());
    const paths = names(files);

    expect(paths).not.toContain('~/.claude/rules/model-routing.md');
    expect(paths.filter((p) => p.includes('/skills/')).sort()).toEqual([
      '~/.claude/skills/close-out/SKILL.md',
      '~/.claude/skills/handoff/SKILL.md',
    ]);
    expect(paths.filter((p) => p.includes('/hooks/'))).toEqual([
      '~/.claude/hooks/personal-config/completion-gate.sh',
    ]);
    const settings = JSON.parse(text(files, 'settings.json')) as {
      hooks: Record<string, unknown>;
    };
    expect(Object.keys(settings.hooks)).toEqual(['Stop']);
    expect(paths).not.toContain('/tmp/example/PASSOFF.md');
    expect(paths).not.toContain('/tmp/example/PART0-PROMPT.md');
    expect(text(files, 'docs/AGENT-PRACTICES.md')).toContain(SHORT_STANDARD_MARK);
    expect(text(files, 'docs/AGENT-PRACTICES.md')).not.toContain('## What is next');
  });

  test('passes: what a light code repo keeps — its git rule, its docs rule, its code standard', async () => {
    const files = await render(CODE_LIGHT, testRepoPlan());
    const paths = names(files);

    expect(paths).toContain('~/.claude/rules/commits.md');
    expect(paths).toContain('~/.claude/rules/docs-lookup.md');
    expect(paths).toContain('/tmp/example/docs/conventions-typescript.md');
    expect(text(files, 'CLAUDE.md')).toContain(
      '`docs/conventions-typescript.md` for typescript',
    );
    expect(text(files, 'CLAUDE.md')).toContain('## What proves work here is sound');
    expect(text(files, 'HANDOFF.md')).toContain('What proves work here is sound');
    expect(text(files, 'docs/AGENT-PRACTICES.md')).toContain('## If this work is in git');
    expect(text(files, 'docs/AGENT-PRACTICES.md')).toContain(COMMIT_PARAGRAPH);
  });

  test('the record says there is no board, so the banner and doctor do not look for one', async () => {
    const files = await render(CODE_LIGHT, testRepoPlan());
    const config = JSON.parse(text(files, '.personal-config.json')) as Record<string, string>;
    expect(config.boardFile).toBe('');
    expect(config.ledgerFile).toBe('HANDOFF.md');
    expect(config.workProfile).toBe('ledger');
    // Ignore entries name only what this run writes: no Part 0 prompt on this track.
    expect(text(files, '.gitignore')).toBe('/.personal-config.json\n');
  });

  test('untracked and light, the exclude file names no board either', async () => {
    const files = await render(
      CODE_LIGHT,
      testRepoPlan({
        trackMode: 'untracked',
        owned: false,
        scan: testScan({ remoteOwner: 'x' }),
      }),
    );
    const lines = text(files, join('.git', 'info', 'exclude'))
      .split('\n')
      .filter(Boolean);
    expect(lines).toEqual([
      '/.personal-config.json',
      '/HANDOFF.md',
      '/CLAUDE.local.md',
      '/AGENT-PRACTICES.local.md',
    ]);
    expect(text(files, 'CLAUDE.local.md')).toContain('## Precedence');
  });
});

describe('§3.1 row 4 — non-code, whatever the weight and whatever git says', () => {
  /** A repo with a `package.json` in it whose work is not code: the scan finds a language anyway. */
  const REPO_WITH_MARKERS = testRepoPlan({ scan: testScan({ languages: ['typescript'] }) });

  test('violates the full track: no commits.md, no docs-lookup.md, no code standard, no code note', async () => {
    const files = await render(NON_CODE_FULL, REPO_WITH_MARKERS);
    const paths = names(files);

    expect(paths).not.toContain('~/.claude/rules/commits.md');
    expect(paths).not.toContain('~/.claude/rules/docs-lookup.md');
    expect(paths.filter((p) => p.includes('conventions-'))).toEqual([]);
    expect(text(files, 'CLAUDE.md')).not.toContain('code standard');
    expect(text(files, 'CLAUDE.md')).not.toContain('Detected');
    expect(text(files, 'docs/AGENT-PRACTICES.md')).toContain(SHORT_STANDARD_MARK);
  });

  test('passes: non-code + full is served — the board, four skills, model routing, the git section', async () => {
    const files = await render(NON_CODE_FULL, REPO_WITH_MARKERS);
    const paths = names(files);

    expect(paths).toContain('/tmp/example/PASSOFF.md');
    expect(paths.filter((p) => p.includes('/skills/'))).toHaveLength(4);
    expect(paths).toContain('~/.claude/rules/model-routing.md');
    const standard = text(files, 'docs/AGENT-PRACTICES.md');
    expect(standard).toContain('## What is next — `PASSOFF.md`');
    expect(standard).toContain('## If this work is in git');
    // The commit policy the person answered lands here, since it has no global rule to land in.
    expect(standard).toContain(COMMIT_PARAGRAPH);
    expect(text(files, 'HANDOFF.md')).toContain('`PASSOFF.md` (what is next) →');
  });

  test('non-code + light on a folder: the smallest setup there is', async () => {
    const files = await render(NON_CODE_LIGHT, folderPlan());
    const paths = names(files);

    expect(paths.sort()).toEqual(
      [
        '/tmp/accounts/.personal-config.json',
        '/tmp/accounts/CLAUDE.md',
        '/tmp/accounts/HANDOFF.md',
        '/tmp/accounts/docs/AGENT-PRACTICES.md',
        '~/.claude/hooks/personal-config/completion-gate.sh',
        // The smallest setup still gets a guard, and this is the one line of it (D25, ratified
        // 2026-09-22). D16 cut the *commit* guard from the lighter setup because it is
        // git-specific; that reason does not reach a guard against `rm`, and this reader — a
        // non-coder, on a folder — is the one with no commit to restore a deleted file from.
        '~/.claude/hooks/personal-config/delete-guard.sh',
        '~/.claude/settings.json',
        '~/.claude/skills/close-out/SKILL.md',
        '~/.claude/skills/handoff/SKILL.md',
        '~/.config/personal-config/config.json',
      ].sort(),
    );

    const standard = text(files, 'docs/AGENT-PRACTICES.md');
    expect(standard).not.toContain('## What is next');
    expect(standard).not.toContain('## If this work is in git');
    expect(standard).not.toContain('`git');
    // The two policy answers a non-code run still gives render under Preferences.
    expect(standard).toContain('## Preferences');
    expect(standard).toContain('never pick silently');
    expect(standard).toContain('**No drive-by fixes.**');
    expect(standard).toContain('**The owner is interactive.**');
    expect(standard).toContain('`Default Model`');
  });

  /**
   * `work-profile` is still asked on this track, and Profile P is machinery the short standard
   * does not describe: the folder scaffold cites "Part 2.2" of a document that has no Part 2.2.
   * A build-level call (`workRecordShape`), asserted so it is a decision and not a fallthrough.
   */
  test('a folders answer renders as a ledger on the short track, and the record says so', async () => {
    const files = await render(NON_CODE_LIGHT, folderPlan({ workProfile: 'folders' }));
    const paths = names(files);
    expect(paths).toContain('/tmp/accounts/HANDOFF.md');
    expect(paths.filter((p) => p.includes('incomplete'))).toEqual([]);
    const config = JSON.parse(text(files, '.personal-config.json')) as Record<string, string>;
    expect(config.workProfile).toBe('ledger');
    expect(config.ledgerFile).toBe('HANDOFF.md');
  });

  test('the same folders answer still renders Profile P on the full track', async () => {
    const files = await render(CODE_FULL_GIT, testRepoPlan({ workProfile: 'folders' }));
    expect(names(files)).toContain('/tmp/example/docs/incomplete/README.md');
    expect(names(files)).not.toContain('/tmp/example/HANDOFF.md');
  });
});

describe('D7 — the proof line reaches the plan, the record and every document', () => {
  const LINE = 'the reconciliation balances to the bank statement';

  test('planRepo carries what the discover phase was told', async () => {
    const scan = testScan({
      kind: 'folder',
      name: 'accounts',
      path: '/tmp/accounts',
      remoteOwner: null,
    });
    const answers: Answers = { ...DEFAULT_ANSWERS, usesGit: 'no' };
    const prompter = defaultsPrompter({ 'proof-line': `  ${LINE} ` });
    const plan = await planRepo(scan, null, answers, testConfig(), prompter);
    expect(plan.proofLine).toBe(LINE);
    // It stays the target's: the shared answers are not where a per-target fact belongs.
    expect(answers.proofLine).toBeUndefined();
  });

  test('targetAnswers lays the plan’s line over the shared answers, and nothing over no plan', () => {
    const shared: Answers = { commitPolicy: 'print-blocks' };
    expect(targetAnswers(shared, folderPlan({ proofLine: LINE }))).toEqual({
      ...shared,
      proofLine: LINE,
      // Item 61: `offLimits` takes the same trip, and an unanswered one is the empty string
      // rather than an absence — which is what makes it a complete answer (D23).
      offLimits: '',
    });
    expect(targetAnswers(shared, null)).toBe(shared);
  });

  test('written, it is in the standard, the router, the ledger and the saved answers', async () => {
    const files = await render(NON_CODE_LIGHT, folderPlan(), { proofLine: LINE });
    expect(text(files, 'docs/AGENT-PRACTICES.md')).toContain(`> ${LINE}`);
    expect(text(files, 'CLAUDE.md')).toContain(`> ${LINE}`);
    expect(text(files, 'HANDOFF.md')).toContain(`| What proves work here is sound | ${LINE} |`);
    const config = JSON.parse(text(files, '.personal-config.json')) as { answers: Answers };
    expect(config.answers.proofLine).toBe(LINE);
  });

  test('empty, every document says it is not yet written rather than leaving a hole', async () => {
    const files = await render(NON_CODE_LIGHT, folderPlan(), { proofLine: '' });
    expect(text(files, 'docs/AGENT-PRACTICES.md')).toContain('not yet written');
    expect(text(files, 'CLAUDE.md')).toContain('Not yet written');
    expect(text(files, 'HANDOFF.md')).toContain('not yet written');
    expect(leftoverTokens(text(files, 'CLAUDE.md'))).toEqual([]);
    expect(leftoverTokens(text(files, 'HANDOFF.md'))).toEqual([]);
  });

  test('on the full track it rides into the Part 0 prompt beside the gates, and only when written', async () => {
    const written = await render(CODE_FULL_GIT, testRepoPlan(), { proofLine: LINE });
    expect(text(written, 'PART0-PROMPT.md')).toContain(`"${LINE}"`);
    const empty = await render(CODE_FULL_GIT, testRepoPlan(), { proofLine: '' });
    expect(text(empty, 'PART0-PROMPT.md')).not.toContain('proof line');
  });
});

/**
 * Item 44's step 6, as a test: a light target is generated, written, and read back by `doctor`
 * with the expectation `setup` would have stamped — so the placeholder rule sees every token
 * filled, the prose rules see nothing to flag, and the stamp rule sees the same `standard v…`
 * a full run writes. Only the repo-local files are committed, so nothing lands in the shared
 * sandbox `$HOME` for a later file to trip on.
 */
describe('doctor against a generated light target', () => {
  async function generate(dir: string) {
    const scan = testScan({
      kind: 'folder',
      name: 'accounts',
      path: dir,
      remoteOwner: null,
      languages: [],
      packageManager: null,
      hasCi: false,
    });
    const answers = answersFor(NON_CODE_LIGHT, {
      proofLine: 'the totals agree with the source table',
    });
    const ctx = testContext(answers, folderPlan({ scan }));
    ctx.stamp = { ...ctx.stamp, standardVersion: await standardVersion() };
    const files = (await renderAll(ctx)).filter((f) => f.path.startsWith(dir));
    await commitPlan(await resolvePlan(files));
    return ctx;
  }

  test('passes: no findings, and the standard on disk carries standard/VERSION', async () => {
    const dir = await tempDir('pc-light-');
    try {
      const ctx = await generate(dir);
      const report = await runDoctorOn(dir, {
        configHash: ctx.stamp.configHash,
        standardVersion: ctx.stamp.standardVersion,
      });
      const described = report.findings.map(
        (f) => `${f.file}:${f.line} ${f.rule} — ${f.message}`,
      );
      expect(described).toEqual([]);
      expect(report.checked).toBe(3);

      const onDisk = readStamp(await readText(join(dir, 'docs', 'AGENT-PRACTICES.md')));
      expect(onDisk?.standardVersion).toBe(await standardVersion());
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: a moved standard version or config hash is drift on every stamped light file', async () => {
    const dir = await tempDir('pc-light-');
    try {
      const ctx = await generate(dir);
      const behind = await runDoctorOn(dir, {
        configHash: ctx.stamp.configHash,
        standardVersion: '9.9.9',
      });
      const drifted = behind.findings
        .filter((f) => f.rule === 'stamp-drift')
        .map((f) => f.file);
      expect(drifted.sort()).toEqual(
        [
          join(dir, 'CLAUDE.md'),
          join(dir, 'HANDOFF.md'),
          join(dir, 'docs', 'AGENT-PRACTICES.md'),
        ].sort(),
      );
      const changed = await runDoctorOn(dir, {
        configHash: '00000000',
        standardVersion: ctx.stamp.standardVersion,
      });
      expect(changed.findings.filter((f) => f.rule === 'stamp-drift')).toHaveLength(3);
    } finally {
      await cleanup(dir);
    }
  });
});
