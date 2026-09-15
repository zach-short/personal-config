import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyConfig } from '../src/lib/config.ts';
import type { Answers, Config, RepoPlan, RepoScan } from '../src/lib/types.ts';
import type { RenderContext } from '../src/render/context.ts';

export async function tempDir(prefix = 'pc-test-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function cleanup(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export function testScan(overrides: Partial<RepoScan> = {}): RepoScan {
  return {
    path: '/tmp/example',
    name: 'example',
    languages: ['typescript'],
    packageManager: 'bun',
    hasCi: true,
    migrations: [],
    existingDocs: [],
    worktrees: 1,
    remoteOwner: 'owner',
    impliedProfile: null,
    ...overrides,
  };
}

export function testRepoPlan(overrides: Partial<RepoPlan> = {}): RepoPlan {
  return {
    scan: testScan(overrides.scan ? { ...overrides.scan } : {}),
    workProfile: 'ledger',
    trackMode: 'tracked',
    archiveHome: '',
    owned: true,
    ...overrides,
  };
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...emptyConfig('starter'),
    models: { deep: 'Deep Model', default: 'Default Model', fast: 'Fast Model' },
    ...overrides,
  };
}

export function testContext(
  answers: Answers,
  repo: RepoPlan | null = testRepoPlan(),
  config = testConfig(),
): RenderContext {
  return {
    config: { ...config, answers },
    answers,
    stamp: {
      version: '0.1.0',
      date: '2026-09-15',
      configHash: 'abcd1234',
      standardVersion: '1.0.0',
    },
    date: '2026-09-15',
    repo,
  };
}

export const DEFAULT_ANSWERS: Answers = {
  commitPolicy: 'print-blocks',
  attribution: 'none',
  modelRouting: 'delegate-or-stop',
  docsMcp: 'none',
  hooks: 'none',
  skills: 'none',
  workProfile: 'ledger',
  trackMode: 'tracked',
  mode: 'solo',
  'practices.comments': 'why-only',
  'practices.function-length': 'house-6-15',
  'practices.exports': 'named-only',
  'practices.file-naming': 'ecosystem-default',
  'practices.imports': 'no-parent-relative',
  'practices.types': 'strict',
  'practices.logic-placement': 'extract-by-concept',
  'practices.data-layer': 'one-client',
  'practices.states': 'all-three',
  'practices.design-tokens': 'tokens-only',
  'practices.test-policy': 'new-file-per-feature',
  'practices.copy-registers': 'ask-three-registers',
  'practices.drive-by-fixes': 'note-and-raise',
};
