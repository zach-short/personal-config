import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { type StampExpectation, stampDrift } from '../src/doctor/rules/stamp-drift.ts';
import { kindOf } from '../src/doctor/scan.ts';
import { cleanup, tempDir, testConfig } from './helpers.ts';

const EXPECTATION = { standardVersion: '1.0.0', config: testConfig() };

async function findingsFor(files: Record<string, string>): Promise<string[]> {
  const dir = await tempDir();
  try {
    for (const [path, contents] of Object.entries(files)) {
      await Bun.write(join(dir, path), contents);
    }
    const report = await runDoctorOn(dir, EXPECTATION);
    return report.findings.map((f) => f.rule);
  } finally {
    await cleanup(dir);
  }
}

/**
 * A real `git init`, because the `ignored` rule now asks `git check-ignore` rather than
 * substring-matching the ignore files' text, and a directory that is not a repository answers
 * every query "not ignored" — a different code path from the one every real repo is on.
 */
async function findingsForGitRepo(files: Record<string, string>): Promise<string[]> {
  const dir = await tempDir();
  try {
    await Bun.spawn(['git', 'init', '--quiet'], {
      cwd: dir,
      stdout: 'ignore',
      stderr: 'ignore',
    }).exited;
    for (const [path, contents] of Object.entries(files)) {
      await Bun.write(join(dir, path), contents);
    }
    const report = await runDoctorOn(dir, EXPECTATION);
    return report.findings.map((f) => f.rule);
  } finally {
    await cleanup(dir);
  }
}

function doc(text: string) {
  return {
    path: 'x.md',
    kind: kindOf('x.md'),
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
  };
}

describe('R1 — relative dates', () => {
  test('flags a relative date in a ledger', async () => {
    const found = await findingsFor({ 'HANDOFF.md': '# H\n\nWe fixed this recently.\n' });
    expect(found).toContain('relative-dates');
  });

  test('passes on an absolute one', async () => {
    const found = await findingsFor({ 'HANDOFF.md': '# H\n\nFixed 2026-09-14.\n' });
    expect(found).not.toContain('relative-dates');
  });

  test('does not flag the word inside inline code', async () => {
    const found = await findingsFor({ 'HANDOFF.md': '# H\n\nThe flag is `--today`.\n' });
    expect(found).not.toContain('relative-dates');
  });
});

describe('§0.3 — leftover placeholders', () => {
  test('flags a token outside Appendix A', async () => {
    const found = await findingsFor({ 'AGENT-PRACTICES.md': '# S\n\nMode is {{MODE}}.\n' });
    expect(found).toContain('placeholders');
  });

  test('passes when the token is inside Appendix A', async () => {
    const found = await findingsFor({
      'AGENT-PRACTICES.md':
        '# S\n\nAll filled.\n\n# Appendix A — Placeholders\n\n| `{{MODE}}` | solo |\n',
    });
    expect(found).not.toContain('placeholders');
  });
});

describe('§2.1 — ledger step numbers', () => {
  test('flags a duplicate step number', async () => {
    const found = await findingsFor({
      'HANDOFF.md':
        '## Step log\n\n**1. One.** Done 2026-09-14.\n\n**1. Again.** Done 2026-09-15.\n',
    });
    expect(found).toContain('step-numbers');
  });

  test('flags a gap', async () => {
    const found = await findingsFor({
      'HANDOFF.md':
        '## Step log\n\n**1. One.** Done 2026-09-14.\n\n**3. Three.** Done 2026-09-15.\n',
    });
    expect(found).toContain('step-numbers');
  });

  test('passes on a contiguous log', async () => {
    const found = await findingsFor({
      'HANDOFF.md':
        '## Step log\n\n**1. One.** Done 2026-09-14.\n\n**2. Two.** Done 2026-09-15.\n',
    });
    expect(found).not.toContain('step-numbers');
  });

  test('flags a duplicate written as a list item, not only as a bold heading', async () => {
    const found = await findingsFor({
      'HANDOFF.md':
        '## Step log\n\n**1. One.** Done 2026-09-14.\n\n- **1. Again.** Done 2026-09-15.\n',
    });
    expect(found).toContain('step-numbers');
  });
});

describe('§2.3 — board status obligations', () => {
  const header = '| # | Task | Status | Model | Waits on |\n|---|---|---|---|---|\n';

  test('DONE without a ledger step', async () => {
    const found = await findingsFor({
      'PASSOFF.md': `${header}| 1 | X | \`DONE\` | D | — |\n`,
    });
    expect(found).toContain('board-status');
  });

  test('DONE pointing at a step passes', async () => {
    const found = await findingsFor({
      'PASSOFF.md': `${header}| 1 | X | \`DONE — HANDOFF 2\` | D | — |\n`,
    });
    expect(found).not.toContain('board-status');
  });

  test('DONE pointing at a step the ledger beside it does not have', async () => {
    const found = await findingsFor({
      'PASSOFF.md': `${header}| 1 | X | \`DONE — HANDOFF 999\` | D | — |\n`,
      'HANDOFF.md':
        '## Step log\n\n**1. One.** Done 2026-09-14.\n\n**2. Two.** Done 2026-09-15.\n',
    });
    expect(found).toContain('board-status');
  });

  test('HELD with nothing to wait on', async () => {
    const found = await findingsFor({
      'PASSOFF.md': `${header}| 1 | X | \`HELD\` | D | — |\n`,
    });
    expect(found).toContain('board-status');
  });

  test('HELD naming what it waits on passes', async () => {
    const found = await findingsFor({
      'PASSOFF.md': `${header}| 1 | X | \`HELD\` | D | item 3 |\n`,
    });
    expect(found).not.toContain('board-status');
  });

  test('SUPERSEDED without a replacement', async () => {
    const found = await findingsFor({
      'PASSOFF.md': `${header}| 1 | X | \`SUPERSEDED\` | D | — |\n`,
    });
    expect(found).toContain('board-status');
  });
});

describe('§8.2 — archive index, both directions', () => {
  test('flags a folder with no index line', async () => {
    const found = await findingsFor({
      'INDEX.md': '# archive — index\n\n## Closed\n',
      'orphan-topic/NOTES.md': 'x\n',
    });
    expect(found).toContain('archive-index');
  });

  test('flags an index line with no folder', async () => {
    const found = await findingsFor({
      'INDEX.md': '# archive — index\n\n- **ghost-topic/** ✅ — gone. Closed 2026-09-14.\n',
    });
    expect(found).toContain('archive-index');
  });

  test('passes when both sides agree', async () => {
    const found = await findingsFor({
      'INDEX.md': '# archive — index\n\n- **real-topic/** ✅ — here. Closed 2026-09-14.\n',
      'real-topic/NOTES.md': 'x\n',
    });
    expect(found).not.toContain('archive-index');
  });
});

describe('stamp drift', () => {
  /** A configured repo whose re-render produced exactly what is on disk. */
  const current = (text: string): StampExpectation => ({
    standardVersion: '1.0.0',
    rendered: text,
    configured: true,
  });

  test('flags a file `setup` would now write differently', () => {
    const text =
      '<!-- personal-config v0.1.0 · 2026-09-15 · config abcd1234 · standard v1.0.0 -->\n# x';
    const findings = stampDrift(doc(text), { ...current(text), rendered: `${text}\n# y` });
    expect(findings.map((f) => f.message)[0]).toContain('re-run');
  });

  test('a config hash that moved on unchanged bytes is not drift (D2)', () => {
    const text =
      '<!-- personal-config v0.1.0 · 2026-09-15 · config 11112222 · standard v1.0.0 -->\n# x';
    expect(stampDrift(doc(text), current(text))).toHaveLength(0);
  });

  test('flags a standard version behind the current one', () => {
    const text =
      '<!-- personal-config v0.1.0 · 2026-09-15 · config abcd1234 · standard v0.9.0 -->\n# x';
    expect(stampDrift(doc(text), current(text))).toHaveLength(1);
  });

  test('passes on a current stamp', () => {
    const text =
      '<!-- personal-config v0.1.0 · 2026-09-15 · config abcd1234 · standard v1.0.0 -->\n# x';
    expect(stampDrift(doc(text), current(text))).toHaveLength(0);
  });

  test('ignores a file this tool did not write', () => {
    expect(stampDrift(doc('# someone else\n'), current(''))).toHaveLength(0);
  });
});

describe('ignored personal files', () => {
  test('flags a personal file git can see', async () => {
    const found = await findingsForGitRepo({ '.personal-config.json': '{}\n' });
    expect(found).toContain('ignored');
  });

  test('passes when .git/info/exclude covers it', async () => {
    const found = await findingsForGitRepo({
      '.personal-config.json': '{}\n',
      '.git/info/exclude': '.personal-config.json\n',
    });
    expect(found).not.toContain('ignored');
  });

  test('passes when .gitignore covers it', async () => {
    const found = await findingsForGitRepo({
      '.personal-config.json': '{}\n',
      '.gitignore': '.personal-config.json\n',
    });
    expect(found).not.toContain('ignored');
  });

  test('a .gitignore comment mentioning the filename does not cover it', async () => {
    const found = await findingsForGitRepo({
      '.personal-config.json': '{}\n',
      '.gitignore': '# .personal-config.json is written by personal-config\nnode_modules/\n',
    });
    expect(found).toContain('ignored');
  });
});

describe('a clean tree', () => {
  test('reports nothing', async () => {
    const found = await findingsFor({
      'HANDOFF.md':
        '# H\n\nVerified 2026-09-15.\n\n## Step log\n\n**1. Opened.** Done 2026-09-15.\n',
    });
    expect(found).toEqual([]);
  });
});

describe('template sources are not checked for being filled', () => {
  test('a placeholder inside templates/ is not a finding', async () => {
    const found = await findingsFor({ 'templates/HANDOFF.md': '# {{PROJECT_NAME}}\n' });
    expect(found).not.toContain('placeholders');
  });

  test('the unadapted boilerplate may quote R1’s own trigger words', async () => {
    const found = await findingsFor({
      'AGENT-PRACTICES.boilerplate.md': '**R1** — never "today" or "recently".\n',
    });
    expect(found).not.toContain('relative-dates');
  });

  test('but an adapted copy in a real repo still is checked', async () => {
    const found = await findingsFor({ 'docs/AGENT-PRACTICES.md': 'We shipped it recently.\n' });
    expect(found).toContain('relative-dates');
  });
});

describe('mentions are not uses', () => {
  test('a token inside backticks is a mention, not a leftover placeholder', async () => {
    const found = await findingsFor({
      'HANDOFF.md': '# H\n\nTemplates carry `{{TOKENS}}` and are filled at render time.\n',
    });
    expect(found).not.toContain('placeholders');
  });

  test('a relative date quoted as a word is a mention', async () => {
    const found = await findingsFor({
      'HANDOFF.md': '# H\n\nR1 bans "today" and "recently" in prose.\n',
    });
    expect(found).not.toContain('relative-dates');
  });

  test('but a bare token and a bare relative date are still flagged', async () => {
    const found = await findingsFor({
      'HANDOFF.md': '# H\n\nWe shipped {{THING}} recently.\n',
    });
    expect(found).toContain('placeholders');
    expect(found).toContain('relative-dates');
  });
});

describe('a quoted phrase is a mention too', () => {
  test('R1 may write `never "last week"` without flagging itself', async () => {
    const found = await findingsFor({
      'AGENT-PRACTICES.md': '**R1** — absolute dates, never "today", "last week".\n',
    });
    expect(found).not.toContain('relative-dates');
  });

  test('a long quotation is not treated as a mention', async () => {
    const found = await findingsFor({
      'HANDOFF.md':
        '# H\n\nHe said "we finished the whole migration last week and moved on".\n',
    });
    expect(found).toContain('relative-dates');
  });
});
