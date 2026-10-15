/**
 * `/audit` (audit-skill DESIGN, 2026-10-15). It is written exactly where `/autopilot` is (4.1),
 * which loads it for its "audit first" option. It sets no `disable-model-invocation`, because the
 * harness blocks a model's Skill call to a skill that sets it (owner, 2026-10-15); its first line
 * refuses a run nobody typed instead. The lanes run on tiers, never on named families (D12), the
 * security lane gets one Deep review per finding (D2), and the template names no repo (J1).
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { readText } from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { leftoverTokens } from '../src/lib/template.ts';
import type { Answers, PlannedFile, WorkProfile } from '../src/lib/types.ts';
import { renderSkills } from '../src/render/skills.ts';
import { DEFAULT_ANSWERS, testContext, testRepoPlan } from './helpers.ts';

const CODE_FULL_GIT = { workKind: 'code', configWeight: 'full', usesGit: 'yes' } as const;

async function render(overrides: Answers = {}, workProfile: WorkProfile = 'ledger') {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    skills: 'all',
    ...CODE_FULL_GIT,
    ...overrides,
  };
  return renderSkills(testContext(answers, testRepoPlan({ workProfile })));
}

function skill(files: PlannedFile[], name: string): string {
  return files.find((f) => f.path.endsWith(join(name, 'SKILL.md')))?.contents ?? '';
}

async function audit(overrides: Answers = {}): Promise<string> {
  return skill(await render(overrides), 'audit');
}

describe('/audit is written only beside /autopilot (4.1)', () => {
  const shapes: Array<[string, Answers, WorkProfile]> = [
    ['code + full + git with a board', {}, 'ledger'],
    ['project folders, which keep no board (D22)', {}, 'folders'],
    ['skills: none', { skills: 'none' }, 'ledger'],
    ['the lighter setup', { configWeight: 'light' }, 'ledger'],
    ['non-code work on the full setup', { workKind: 'non-code' }, 'ledger'],
    ['code + full without git', { usesGit: 'no' }, 'ledger'],
  ];
  for (const [name, overrides, profile] of shapes)
    test(`${name}: /audit is present exactly when /autopilot is`, async () => {
      const files = await render(overrides, profile);
      expect(skill(files, 'audit') !== '').toBe(skill(files, 'autopilot') !== '');
    });

  test('passes: the board shape gets both', async () => {
    expect(await audit()).not.toBe('');
  });
});

describe('who starts it', () => {
  test('its frontmatter sets no disable-model-invocation, so /autopilot can load it', async () => {
    const text = await audit();
    expect(text.slice(0, text.indexOf('\n---\n'))).not.toContain('disable-model-invocation');
  });

  test('its description says it runs only when typed or loaded by /autopilot', async () => {
    expect(await audit()).toContain(
      'Use only when the person types /audit, or when /autopilot loads it after the person chose audit first.\n',
    );
  });

  test('its first instruction refuses a run the person did not start', async () => {
    const text = await audit();
    const body = text.slice(text.indexOf('# /audit'));
    expect(body.split('\n')[2]).toBe(
      '**Run only when the person typed `/audit` in this session, or when `/autopilot` loaded this skill',
    );
  });

  test('/autopilot loads it with the Skill tool, and keeps its own guard', async () => {
    const autopilot = skill(await render(), 'autopilot');
    expect(autopilot).toContain('load `/audit` once, with the\n   Skill tool');
    expect(autopilot).toContain('\ndisable-model-invocation: true');
  });
});

describe('what /audit says', () => {
  test('the lane models table names tiers, with a Deep review for security only (D2)', async () => {
    const text = await audit();
    for (const row of [
      '| Parity | Mechanical | Default | none |',
      '| Security | Mechanical | Default | Deep, one agent per finding |',
      '| Dead code | Mechanical | Default | none |',
      '| Tech debt | Mechanical | Mechanical | none |',
    ])
      expect(text, row).toContain(row);
  });

  test('the dedupe step drops what a dedupe source holds, and names it', async () => {
    const text = (await audit()).replace(/\s+/g, ' ');
    expect(text).toContain(
      '3. **Dedupe.** The same agent drops each finding that a dedupe source already holds, and names the source and the entry it matched.',
    );
    expect(text).toContain(
      'Every earlier `docs/incomplete/audit-*/REPORT.md` is a dedupe source too',
    );
  });

  test('each default is written once', async () => {
    const text = await audit();
    for (const value of [
      'Every lane the lane file names, in its order',
      'The reset time the lane file names',
      'On, for every lane',
      '| Audit agents in flight | 4 |',
    ])
      expect(text.split(value), value).toHaveLength(2);
  });

  test('only this session writes rows, at a number read at write time', async () => {
    const text = (await audit()).replace(/\s+/g, ' ');
    expect(text).toContain('Only this session writes the board.');
    expect(text).toContain(
      'Read the next free row number from the board file at the moment you write',
    );
    expect(text).toContain('A security fix row is Deep.');
  });

  /** The Fable review of the stop rules, 2026-10-15: a review launched after a cap was blocking. */
  test('the stop rules read the clock and check before every step of a lane', async () => {
    const text = (await audit()).replace(/\s+/g, ' ');
    for (const phrase of [
      'Read the time from `date` for every check. Never estimate it.',
      'Before each step of a lane starts (the sweep, the triage, the verify pass and the review), check the stop time.',
      'Under `/autopilot`, check all of its caps (its section 7) too.',
      'A cap reached starts no new step: no sweep, no triage, no verify pass and no review. Steps already started finish.',
      'Resume it with `SendMessage`, or run the step again.',
      'Never count the step done from a partial report.',
      'When the last lane ends, or the stop rules end the audit:',
      'are written in the report as not finished, and section 5 runs on what was verified.',
    ])
      expect(text, phrase).toContain(phrase);
  });

  test('the template names no repo, no model family and no Part, and has no em dash', async () => {
    const source = await readText(join(repoRoot(), 'templates', 'skills', 'audit.md'));
    expect(source.toLowerCase()).not.toMatch(/fable|opus|sonnet|haiku/);
    expect(source.toLowerCase()).not.toMatch(/supabase|knip|govulncheck|saturday|03:00|~\//);
    expect(source).not.toMatch(/Part \d/);
    expect(source).not.toContain('—');
  });

  for (const policy of ['print-blocks', 'agent-commits', 'no-rule'])
    test(`${policy} leaves no token unfilled, with the stamp below the frontmatter`, async () => {
      const text = await audit({ commitPolicy: policy });
      expect(text.startsWith('---\nname: audit\n')).toBe(true);
      expect(text).toContain('---\n\n<!-- personal-config v');
      expect(leftoverTokens(text)).toEqual([]);
    });
});
