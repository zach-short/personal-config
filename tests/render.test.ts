import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { readStamp } from '../src/lib/stamp.ts';
import { leftoverTokens } from '../src/lib/template.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  tempDir,
  testContext,
  testRepoPlan,
  testScan,
} from './helpers.ts';

async function planInto(dir: string, answers = DEFAULT_ANSWERS, overrides = {}) {
  const repo = testRepoPlan({ scan: testScan({ path: dir, name: 'example' }), ...overrides });
  const ctx = testContext(answers, repo);
  return renderAll(ctx);
}

describe('renderers', () => {
  test('running twice produces identical bytes', async () => {
    const dir = await tempDir();
    try {
      const first = await planInto(dir);
      await commitPlan(await resolvePlan(first));
      const after = await Bun.file(join(dir, 'HANDOFF.md')).text();

      const second = await planInto(dir);
      const changes = await resolvePlan(second);
      const differing = changes.filter((c) => c.before !== c.after);

      expect(differing).toHaveLength(0);
      expect(await Bun.file(join(dir, 'HANDOFF.md')).text()).toBe(after);
    } finally {
      await cleanup(dir);
    }
  });

  test('every generated markdown file carries a stamp', async () => {
    const dir = await tempDir();
    try {
      const files = await planInto(dir);
      const markdown = files.filter((f) => f.path.endsWith('.md'));
      expect(markdown.length).toBeGreaterThan(0);
      for (const file of markdown) {
        expect(readStamp(file.contents)).not.toBeNull();
      }
    } finally {
      await cleanup(dir);
    }
  });

  test('the adapted standard leaves no placeholder outside Appendix A', async () => {
    const dir = await tempDir();
    try {
      const files = await planInto(dir);
      const standard = files.find((f) => f.path.endsWith('AGENT-PRACTICES.md'));
      expect(standard).toBeDefined();

      const beforeAppendix = standard?.contents.split('# Appendix A')[0] ?? '';
      // WORKTREE_SETUP and BUILD_CMD are Part 0's to fill: only the repo knows them.
      const left = leftoverTokens(beforeAppendix).filter(
        (t) => t !== 'WORKTREE_SETUP' && t !== 'BUILD_CMD',
      );
      expect(left).toEqual([]);
    } finally {
      await cleanup(dir);
    }
  });

  test('solo mode cuts Part 12 and team mode keeps it', async () => {
    const dir = await tempDir();
    try {
      const solo = await planInto(dir, { ...DEFAULT_ANSWERS, mode: 'solo' });
      const team = await planInto(dir, {
        ...DEFAULT_ANSWERS,
        mode: 'team',
        tracker: 'GitHub Issues',
      });

      const soloText = solo.find((f) => f.path.endsWith('AGENT-PRACTICES.md'))?.contents ?? '';
      const teamText = team.find((f) => f.path.endsWith('AGENT-PRACTICES.md'))?.contents ?? '';

      expect(soloText).not.toContain('# Part 12 — Teams');
      expect(teamText).toContain('# Part 12 — Teams');
      expect(teamText).toContain('GitHub Issues');
    } finally {
      await cleanup(dir);
    }
  });

  test('untracked mode writes the router and exclude file, not .gitignore', async () => {
    const dir = await tempDir();
    try {
      const files = await planInto(dir, DEFAULT_ANSWERS, {
        trackMode: 'untracked',
        owned: false,
      });
      const paths = files.map((f) => f.path);

      expect(paths).toContain(join(dir, 'CLAUDE.local.md'));
      expect(paths).not.toContain(join(dir, 'CLAUDE.md'));
      expect(paths).toContain(join(dir, '.git', 'info', 'exclude'));
      expect(paths).not.toContain(join(dir, '.gitignore'));
    } finally {
      await cleanup(dir);
    }
  });

  test('overwrite leaves user content outside the stamped file untouched', async () => {
    const dir = await tempDir();
    try {
      await commitPlan(await resolvePlan(await planInto(dir)));

      const mine = join(dir, 'notes.md');
      await Bun.write(mine, '# my own notes\n');
      await Bun.write(join(dir, '.gitignore'), 'build/\n');

      await commitPlan(await resolvePlan(await planInto(dir)));

      expect(await Bun.file(mine).text()).toBe('# my own notes\n');
      // append-lines never reorders or drops what was already there.
      expect(await Bun.file(join(dir, '.gitignore')).text()).toStartWith('build/\n');
    } finally {
      await cleanup(dir);
    }
  });

  test('a conventions file is produced per language found, and none for others', async () => {
    const dir = await tempDir();
    try {
      const files = await planInto(dir, DEFAULT_ANSWERS, {
        scan: testScan({ path: dir, name: 'example', languages: ['go'] }),
      });
      const paths = files.map((f) => f.path);
      expect(paths).toContain(join(dir, 'docs', 'conventions-go.md'));
      expect(paths).not.toContain(join(dir, 'docs', 'conventions-typescript.md'));
    } finally {
      await cleanup(dir);
    }
  });

  test('answering "no rule" everywhere produces no conventions file at all', async () => {
    const dir = await tempDir();
    try {
      const silent = Object.fromEntries(
        Object.entries(DEFAULT_ANSWERS).map(([k, v]) => [
          k,
          k.startsWith('practices.') ? 'none' : v,
        ]),
      );
      const files = await planInto(dir, silent);
      expect(files.filter((f) => f.path.includes('conventions-'))).toHaveLength(0);
    } finally {
      await cleanup(dir);
    }
  });
});

describe('ignore entries are anchored', () => {
  test('every written pattern starts with / so it matches only the repo root', async () => {
    const dir = await tempDir();
    try {
      const files = await planInto(dir, DEFAULT_ANSWERS, {
        trackMode: 'untracked',
        owned: false,
      });
      const ignore = files.find((f) => f.path.endsWith(join('.git', 'info', 'exclude')));
      const lines = (ignore?.contents ?? '').split('\n').filter(Boolean);

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toStartWith('/');
      }
      // An unanchored `HANDOFF.md` would also hide examples/HANDOFF.md, and on a
      // case-insensitive filesystem, handoff.md. Observed on this repo 2026-09-15.
      expect(lines).toContain('/HANDOFF.md');
      expect(lines).not.toContain('HANDOFF.md');
    } finally {
      await cleanup(dir);
    }
  });
});
