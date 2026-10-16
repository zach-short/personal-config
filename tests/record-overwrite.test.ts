/**
 * record-overwrite (2026-10-16). `init <dir> --yes` across 27 folders replaced stamped ledgers,
 * boards and routers that held real content with fresh templates: a 2,598-line ledger planned as
 * `[+67 −2598]` and written. A stamp is set once and survives every later edit, so the stamp guard
 * read those files as this tool's to replace. Two rules now sit behind it: a seed (`never`) is
 * written once, and a file a later answer must reach (`if-unedited`) is replaced only while it
 * matches what this tool renders at its own stamp.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { priorRender } from '../src/doctor/rerender.ts';
import { parseCli } from '../src/lib/args.ts';
import { scanRepo } from '../src/lib/discover.ts';
import { readText, writeText } from '../src/lib/disk.ts';
import type { Answers, PlannedFile } from '../src/lib/types.ts';
import { previewTree } from '../src/lib/ui.ts';
import { commitPlan, type PlannedChange, resolvePlan } from '../src/lib/write-plan.ts';
import type { RenderContext } from '../src/render/context.ts';
import { renderAll } from '../src/render/index.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testContext, testRepoPlan } from './helpers.ts';

/** A TypeScript repo on the full track, scanned for real so the plan is the one `setup` makes. */
async function repoContext(
  dir: string,
  answers: Answers = DEFAULT_ANSWERS,
): Promise<RenderContext> {
  const scan = await scanRepo(dir, 'git');
  return testContext(answers, testRepoPlan({ scan, archiveHome: join(dir, 'archive') }));
}

/** Only the files inside the temp dir: the global ones would land in the shared sandbox `$HOME`. */
async function plan(dir: string, answers: Answers = DEFAULT_ANSWERS): Promise<PlannedFile[]> {
  return (await renderAll(await repoContext(dir, answers))).filter((f) =>
    f.path.startsWith(dir),
  );
}

async function freshRepo(): Promise<string> {
  const dir = await tempDir('pc-record-');
  await writeText(join(dir, 'package.json'), '{ "name": "leaflet" }\n');
  await writeText(join(dir, 'tsconfig.json'), '{}\n');
  await Bun.spawn(['git', 'init', '--quiet', '--initial-branch=main'], {
    cwd: dir,
    stdout: 'ignore',
    stderr: 'ignore',
  }).exited;
  await commitPlan(await resolvePlan(await plan(dir)));
  return dir;
}

function change(changes: PlannedChange[], path: string): PlannedChange | undefined {
  return changes.find((c) => c.file.path === path);
}

const GROWN = '\n## Step 1 — a real step\n\nWhat was done, and the commit it landed in.\n';

describe('a seed is written once (replace: never)', () => {
  test('violates: a grown ledger, board and archive index are kept on a re-run', async () => {
    const dir = await freshRepo();
    try {
      // The first item file is not here: `startsBoard` plans it only where no board exists.
      const records = [
        join(dir, 'HANDOFF.md'),
        join(dir, 'PASSOFF.md'),
        join(dir, 'archive', 'INDEX.md'),
      ];
      for (const path of records) await writeText(path, `${await readText(path)}${GROWN}`);
      const before = await Promise.all(records.map(readText));

      const changes = await resolvePlan(await plan(dir));
      for (const path of records) expect(change(changes, path)?.guard).toBe('kept');
      await commitPlan(changes);

      expect(await Promise.all(records.map(readText))).toEqual(before);
    } finally {
      await cleanup(dir);
    }
  });

  test('passes: an absent or empty ledger is still written from the seed', async () => {
    const dir = await tempDir('pc-record-');
    try {
      await writeText(join(dir, 'PASSOFF.md'), '');
      const changes = await resolvePlan(await plan(dir));
      expect(change(changes, join(dir, 'HANDOFF.md'))?.guard).toBe('none');
      expect(change(changes, join(dir, 'PASSOFF.md'))?.guard).toBe('none');
      await commitPlan(changes);
      expect(await readText(join(dir, 'PASSOFF.md'))).toContain('the board');
    } finally {
      await cleanup(dir);
    }
  });

  test('passes: an untouched seed reads as current, not as a kept record', async () => {
    const dir = await freshRepo();
    try {
      const changes = await resolvePlan(await plan(dir));
      expect(change(changes, join(dir, 'HANDOFF.md'))?.guard).toBe('none');
      expect(changes.some((c) => c.guard === 'kept' || c.guard === 'edited')).toBe(false);
    } finally {
      await cleanup(dir);
    }
  });
});

describe('the router, standard and conventions are replaced only while unedited', () => {
  const agentPushes: Answers = { ...DEFAULT_ANSWERS, commitPolicy: 'agent-pushes' };

  test('passes: an unedited router takes a new commit line', async () => {
    const dir = await freshRepo();
    try {
      const router = join(dir, 'CLAUDE.md');
      const files = await plan(dir, agentPushes);
      const prior = await priorRender(parseCli(['setup']), [dir], files);
      const changes = await resolvePlan(files, prior);
      expect(change(changes, router)?.guard).toBe('none');
      await commitPlan(changes);
      expect(await readText(router)).toContain('`git push`');
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: a router Part 0 filled in is left alone, and so is an adapted standard', async () => {
    const dir = await freshRepo();
    try {
      const router = join(dir, 'CLAUDE.md');
      const standard = join(dir, 'docs', 'AGENT-PRACTICES.md');
      const conventions = join(dir, 'docs', 'conventions-typescript.md');
      await writeText(router, `${await readText(router)}\n## Gates\n\nbun test\n`);
      // What Part 0 does to the standard: the fence's token line becomes the repo's own setup.
      // Appendix A still names the token inline afterwards, as every adapted copy does, so a test
      // that the token is merely present would call this copy unadapted.
      const adapted = (await readText(standard)).replace(
        '\n{{WORKTREE_SETUP}}\n',
        '\nbun install\n',
      );
      expect(adapted).toContain('{{WORKTREE_SETUP}}');
      await writeText(standard, adapted);
      await writeText(conventions, `${await readText(conventions)}\nA rule Part 0 added.\n`);
      const before = await Promise.all([router, standard, conventions].map(readText));

      const files = await plan(dir, agentPushes);
      const prior = await priorRender(parseCli(['setup']), [dir], files);
      const changes = await resolvePlan(files, prior);
      for (const path of [router, standard, conventions]) {
        expect(change(changes, path)?.guard).toBe('edited');
      }
      await commitPlan(changes);
      expect(await Promise.all([router, standard, conventions].map(readText))).toEqual(before);
    } finally {
      await cleanup(dir);
    }
  });

  test('passes: a standard that still holds the Part 0 token takes a new version', async () => {
    const dir = await freshRepo();
    try {
      const standard = join(dir, 'docs', 'AGENT-PRACTICES.md');
      // An older version's copy: a line that no render today produces, the token still in it.
      await writeText(
        standard,
        `${await readText(standard)}\nA line from an older standard.\n`,
      );
      const changes = await resolvePlan(await plan(dir, agentPushes));
      expect(change(changes, standard)?.guard).toBe('none');
      await commitPlan(changes);
      expect(await readText(standard)).not.toContain('A line from an older standard.');
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: with no prior render to compare, a differing router is refused', async () => {
    const dir = await freshRepo();
    try {
      const changes = await resolvePlan(await plan(dir, agentPushes));
      expect(change(changes, join(dir, 'CLAUDE.md'))?.guard).toBe('edited');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('what a person sees', () => {
  test('the preview names a kept record and an edited file apart from a write', async () => {
    const dir = await freshRepo();
    try {
      const ledger = join(dir, 'HANDOFF.md');
      const router = join(dir, 'CLAUDE.md');
      await writeText(ledger, `${await readText(ledger)}${GROWN}`);
      await writeText(router, `${await readText(router)}\n## Gates\n`);
      const tree = previewTree(
        await resolvePlan(
          await plan(dir, { ...DEFAULT_ANSWERS, commitPolicy: 'agent-pushes' }),
        ),
      );
      expect(tree).toContain('HANDOFF.md  — the ledger — what is true  [kept — your record');
      expect(tree).toContain('CLAUDE.md  — router (tracked)  [edited since written');
    } finally {
      await cleanup(dir);
    }
  });

  test('doctor reports no drift on a grown ledger, where it used to say "re-run it"', async () => {
    const dir = await freshRepo();
    try {
      const ctx = await repoContext(dir);
      const ledger = join(dir, 'HANDOFF.md');
      await writeText(ledger, `${await readText(ledger)}${GROWN}`);
      const report = await runDoctorOn(dir, {
        standardVersion: ctx.stamp.standardVersion,
        config: ctx.config,
      });
      const drift = report.findings.filter((f) => f.rule === 'stamp-drift');
      expect(drift.map((f) => f.file)).not.toContain(ledger);
    } finally {
      await cleanup(dir);
    }
  });
});
