import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { settledSupersession } from '../src/doctor/rules/settled-supersession.ts';
import { collectDocs } from '../src/doctor/scan.ts';
import { cleanup, tempDir } from './helpers.ts';

const LEDGER = [
  '# HANDOFF — example',
  '',
  '## Settled',
  '',
  '- **Tokens** — one scale, ratified 2026-09-01.',
  '- **Dates** — absolute only, ratified 2026-09-02.',
  '',
  '## Step log',
  '',
  '**1. Seeded the repo.** Done 2026-09-03.',
  '',
  '---',
  '',
  '**2. Did the next thing.** Done 2026-09-04.',
  '',
].join('\n');

/**
 * A real `git init` and a real commit: the rule's whole input is `git diff HEAD`, so a fixture
 * without a commit behind it tests nothing. `X2` — everything lives under a temp directory.
 *
 * `core.excludesFile=/dev/null` because a machine running the untracked work profile ignores
 * `HANDOFF.md` globally — this one does, at `~/.config/git/ignore` — and `git add` would
 * silently skip the fixture. Without this the suite passes or fails by whose laptop it is on.
 */
async function world(seed = LEDGER): Promise<string> {
  const repo = await tempDir('pc-settled-');
  await Bun.write(join(repo, 'HANDOFF.md'), seed);
  await git(repo, ['init', '--quiet', '--initial-branch=main']);
  await git(repo, ['config', 'core.excludesFile', '/dev/null']);
  await git(repo, ['config', 'user.email', 'test@example.com']);
  await git(repo, ['config', 'user.name', 'test']);
  await git(repo, ['add', '-A']);
  await git(repo, ['commit', '--quiet', '-m', 'seed']);
  return repo;
}

async function git(cwd: string, args: string[]): Promise<void> {
  await Bun.spawn(['git', ...args], { cwd, stdout: 'ignore', stderr: 'ignore' }).exited;
}

async function findingsFor(repo: string): Promise<string[]> {
  const found = await settledSupersession(repo, await collectDocs(repo));
  return found.map((finding) => `${finding.rule}:${finding.line}`);
}

describe('R8 — a settled decision is not quietly reversed', () => {
  test('flags a Settled entry rewritten with no supersession', async () => {
    const repo = await world();
    try {
      await Bun.write(
        join(repo, 'HANDOFF.md'),
        LEDGER.replace('one scale, ratified 2026-09-01', 'two scales, ratified 2026-09-05'),
      );
      expect(await findingsFor(repo)).toEqual(['settled-supersession:5']);
    } finally {
      await cleanup(repo);
    }
  });

  test('flags a Settled entry deleted outright', async () => {
    const repo = await world();
    try {
      await Bun.write(
        join(repo, 'HANDOFF.md'),
        LEDGER.replace('- **Dates** — absolute only, ratified 2026-09-02.\n', ''),
      );
      expect(await findingsFor(repo)).toHaveLength(1);
    } finally {
      await cleanup(repo);
    }
  });

  test('passes when the same diff states the supersession', async () => {
    const repo = await world();
    try {
      await Bun.write(
        join(repo, 'HANDOFF.md'),
        LEDGER.replace(
          'one scale, ratified 2026-09-01',
          'two scales, ratified 2026-09-05',
        ).replace(
          '**2. Did the next thing.** Done 2026-09-04.',
          '**2. Did the next thing.** Done 2026-09-04. This supersedes the one-scale decision of 2026-09-01.',
        ),
      );
      expect(await findingsFor(repo)).toEqual([]);
    } finally {
      await cleanup(repo);
    }
  });

  test('passes on a new entry recorded under Settled', async () => {
    const repo = await world();
    try {
      await Bun.write(
        join(repo, 'HANDOFF.md'),
        LEDGER.replace(
          '- **Dates** — absolute only, ratified 2026-09-02.',
          '- **Dates** — absolute only, ratified 2026-09-02.\n- **Naming** — kebab-case, ratified 2026-09-05.',
        ),
      );
      expect(await findingsFor(repo)).toEqual([]);
    } finally {
      await cleanup(repo);
    }
  });

  test('passes on a rewrite outside the Settled section, horizontal rule and all', async () => {
    const repo = await world();
    try {
      await Bun.write(
        join(repo, 'HANDOFF.md'),
        LEDGER.replace(
          '**1. Seeded the repo.** Done 2026-09-03.',
          '**1. Seeded it.** Done 2026-09-03.',
        ).replace('\n---\n', '\n'),
      );
      expect(await findingsFor(repo)).toEqual([]);
    } finally {
      await cleanup(repo);
    }
  });

  test('says nothing where there is no git history to read', async () => {
    const repo = await tempDir('pc-settled-');
    try {
      await Bun.write(join(repo, 'HANDOFF.md'), LEDGER);
      expect(await findingsFor(repo)).toEqual([]);
    } finally {
      await cleanup(repo);
    }
  });

  test('reaches the scan, not just its own function', async () => {
    const repo = await world();
    try {
      await Bun.write(join(repo, 'HANDOFF.md'), LEDGER.replace('one scale', 'two scales'));
      const report = await runDoctorOn(repo, {
        configHash: 'abcd1234',
        standardVersion: '1.0.0',
      });
      expect(report.findings.map((finding) => finding.rule)).toContain('settled-supersession');
    } finally {
      await cleanup(repo);
    }
  });
});
