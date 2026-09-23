/**
 * Drift by re-render (stamp-provenance `DESIGN.md` D2): `doctor` rebuilds the plan `setup` would
 * write into a configured repo from that repo's own record, renders each file as its stamp says
 * it was rendered, and compares bytes. The first test is the one everything rests on — a repo
 * `setup` just rendered re-renders to exactly what is on disk — because every other assertion
 * here is "the same, except for this one input". The scan is the real one, on a real directory:
 * a hand-written scan would test the renderers against themselves.
 */
import { describe, expect, test } from 'bun:test';
import { basename, join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { rerender } from '../src/doctor/rerender.ts';
import { collectDocs } from '../src/doctor/scan.ts';
import { configHash } from '../src/lib/config.ts';
import { scanRepo } from '../src/lib/discover.ts';
import { readText, writeText } from '../src/lib/disk.ts';
import { markAdapted, readStamp, stampLine } from '../src/lib/stamp.ts';
import type { Config } from '../src/lib/types.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { renderAll } from '../src/render/index.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testContext, testRepoPlan } from './helpers.ts';

type Rendered = { dir: string; config: Config; standardVersion: string };

/** A TypeScript repo on the full track, rendered into a real directory from the real scan. */
async function rendered(): Promise<Rendered> {
  const dir = await tempDir('pc-rerender-');
  await writeText(join(dir, 'package.json'), '{ "name": "leaflet" }\n');
  await writeText(join(dir, 'tsconfig.json'), '{}\n');
  await git(dir, ['init', '--quiet', '--initial-branch=main']);

  const ctx = testContext(DEFAULT_ANSWERS, testRepoPlan({ scan: await scanRepo(dir, 'git') }));
  // Only the repo-local files: the global ones would land in the shared sandbox `$HOME`.
  const files = (await renderAll(ctx)).filter((f) => f.path.startsWith(dir));
  await commitPlan(await resolvePlan(files));
  return { dir, config: ctx.config, standardVersion: ctx.stamp.standardVersion };
}

async function git(cwd: string, args: string[]): Promise<void> {
  await Bun.spawn(['git', ...args], { cwd, stdout: 'ignore', stderr: 'ignore' }).exited;
}

async function drift(repo: Rendered, config = repo.config) {
  const report = await runDoctorOn(repo.dir, { standardVersion: repo.standardVersion, config });
  return report.findings.filter((f) => f.rule === 'stamp-drift');
}

describe('a repo `setup` just rendered', () => {
  test('re-renders to the bytes on disk, file for file, and the Part 0 prompt is not compared', async () => {
    const repo = await rendered();
    try {
      const docs = await collectDocs(repo.dir);
      const render = await rerender(repo.dir, repo.config, docs);

      const compared = docs.filter(
        (doc) => readStamp(doc.text) !== null && basename(doc.path) !== 'PART0-PROMPT.md',
      );
      expect(compared.map((doc) => basename(doc.path)).sort()).toEqual([
        'AGENT-PRACTICES.md',
        'CLAUDE.md',
        'HANDOFF.md',
        'PASSOFF.md',
        'conventions-typescript.md',
      ]);
      for (const doc of compared) expect(render(doc)).toBe(doc.text);

      const part0 = docs.find((doc) => basename(doc.path) === 'PART0-PROMPT.md');
      expect(part0 && readStamp(part0.text)).not.toBeNull();
      expect(part0 && render(part0)).toBeNull();
    } finally {
      await cleanup(repo.dir);
    }
  });

  test('reports no drift', async () => {
    const repo = await rendered();
    try {
      expect(await drift(repo)).toEqual([]);
    } finally {
      await cleanup(repo.dir);
    }
  });

  /**
   * G12 and G13, the false positive this whole design exists to remove: `models` is hashed
   * wholesale, so a package default the repo never saved moves every stamp's hash while moving
   * no rendered byte in the repo. `0c737ac` shipped exactly this to every configured repo.
   */
  test('a config hash moved by a package-supplied default is not drift', async () => {
    const repo = await rendered();
    try {
      const moved = {
        ...repo.config,
        models: { ...repo.config.models, light: 'Another Model' },
      };
      expect(await configHash(moved)).not.toBe(await configHash(repo.config));
      expect(await drift(repo, moved)).toEqual([]);
    } finally {
      await cleanup(repo.dir);
    }
  });

  test('an answer that moves a rendered byte is drift on exactly the files it is in', async () => {
    const repo = await rendered();
    try {
      const answers = { ...repo.config.answers, commitPolicy: 'agent-commits' };
      const findings = await drift(repo, { ...repo.config, answers });
      expect(findings.map((f) => basename(f.file)).sort()).toEqual([
        'AGENT-PRACTICES.md',
        'CLAUDE.md',
      ]);
      for (const f of findings)
        expect(f.message).toContain('would now write this file differently');
    } finally {
      await cleanup(repo.dir);
    }
  });

  test('a file whose stamp date differs is rendered at its own date, not its neighbours`', async () => {
    const repo = await rendered();
    try {
      // The ledger's body says "Started <date>" from the same date as its stamp. Moving the
      // stamp's date alone makes the file inconsistent with itself, and the render at the new
      // date is the one that shows it — while every other file, rendered at the old date, stays
      // equal. One render per distinct stamp, not per repo.
      const ledger = join(repo.dir, 'HANDOFF.md');
      const text = await readText(ledger);
      await writeText(ledger, text.replace('· 2026-09-15 · config', '· 2026-09-16 · config'));
      const findings = await drift(repo);
      expect(findings.map((f) => basename(f.file))).toEqual(['HANDOFF.md']);
    } finally {
      await cleanup(repo.dir);
    }
  });

  test('an adapted file is never rendered, whatever its body says', async () => {
    const repo = await rendered();
    try {
      const standard = join(repo.dir, 'docs', 'AGENT-PRACTICES.md');
      const stamp = readStamp(await readText(standard));
      if (!stamp) throw new Error('the rendered standard carries no stamp');
      const rewritten = `${markAdapted(await readText(standard), stampLine({ ...stamp, adapted: true }))}\n## Written after Part 0\n`;
      await writeText(standard, rewritten);

      const docs = await collectDocs(repo.dir);
      const render = await rerender(repo.dir, repo.config, docs);
      const doc = docs.find((d) => d.path === standard);
      expect(doc && render(doc)).toBeNull();
      expect(await drift(repo)).toEqual([]);
    } finally {
      await cleanup(repo.dir);
    }
  });
});

describe('a tree with nothing to compare', () => {
  test('no stamped docs means no render and null for every doc', async () => {
    const dir = await tempDir('pc-rerender-');
    try {
      await writeText(join(dir, 'README.md'), '# theirs\n');
      const docs = await collectDocs(dir);
      const render = await rerender(dir, testContext(DEFAULT_ANSWERS).config, docs);
      for (const doc of docs) expect(render(doc)).toBeNull();
    } finally {
      await cleanup(dir);
    }
  });
});
