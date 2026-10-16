/**
 * `tools/board-sweep.js` routes each board item to an agent model by its tier name. Item 106
 * renamed the Mechanical tier from "Sonnet 5" to "Sonnet 5.5", and the old exact match sent every
 * renamed row to opus with no warning. This runs the real script body with stubbed agents, the way
 * `tools/harness2.mjs` does, and reads the model each agent was spawned with.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(import.meta.dir, '..', 'tools', 'board-sweep.js'),
  'utf8',
).replace(/^export const meta/m, 'const meta');

interface Spawned {
  label: string;
  model: string | undefined;
}

async function modelsFor(tiers: string[]): Promise<Map<string, string | undefined>> {
  const spawned: Spawned[] = [];
  const agent = async (_prompt: string, opts: { label?: string; model?: string } = {}) => {
    const label = opts.label ?? '';
    spawned.push({ label, model: opts.model });
    const kind = label.split(':')[0];
    if (kind === 'triage') return { blocked: false, reasoning: 'clear' };
    if (kind === 'build') return { worktreePath: '/wt', gatesGreen: true, summary: 'ok' };
    if (kind === 'audit') return { verdict: 'clean', gatesReranGreen: true };
    return null;
  };
  const parallel = (thunks: (() => unknown)[]) =>
    Promise.all(thunks.map((t) => Promise.resolve().then(t)));
  const items = tiers.map((model, i) => ({
    id: String(i),
    title: model,
    model,
    lane: String(i),
    waitsOn: [],
    kind: 'build',
    prompt: 'p',
  }));
  const body = new Function(
    'agent',
    'parallel',
    'phase',
    'log',
    'args',
    `"use strict"; return (async () => {\n${SRC}\n})()`,
  );
  await body(
    agent,
    parallel,
    () => {},
    () => {},
    { items },
  );
  return new Map(spawned.map((s) => [s.label, s.model]));
}

describe('board-sweep tier routing', () => {
  const tiers = [
    'Fable 5.1',
    'Opus 5.5',
    'Sonnet 5.5',
    'Sonnet 5',
    'sonnet',
    'Haiku 5.5',
    'Opus 5',
  ];

  test('builds route by family name, so a version bump keeps its model', async () => {
    const models = await modelsFor(tiers);
    const build = tiers.map((_, i) => models.get(`build:${i}`));
    expect(build).toEqual(['fable', 'opus', 'sonnet', 'sonnet', 'sonnet', 'opus', 'opus']);
  });

  test('triage runs on opus, raised to fable only for a Fable item', async () => {
    const models = await modelsFor(tiers);
    const triage = tiers.map((_, i) => models.get(`triage:${i}`));
    expect(triage).toEqual(['fable', 'opus', 'opus', 'opus', 'opus', 'opus', 'opus']);
  });
});
