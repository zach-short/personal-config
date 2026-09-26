import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Prompter } from '../src/lib/ask.ts';
import { emptyConfig } from '../src/lib/config.ts';
import { configFile } from '../src/lib/paths.ts';
import type { Answers, Config, RepoPlan, RepoScan } from '../src/lib/types.ts';
import type { RenderContext } from '../src/render/context.ts';

export async function tempDir(prefix = 'pc-test-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function cleanup(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/**
 * `renderAll` writes the saved answers into the one sandbox `$HOME` every test file shares, and
 * `loadConfig` reads that file as a merge layer. So a test that commits a real plan and leaves
 * it behind decides what a *later file's* `loadConfig` returns — which is how the profile-merge
 * tests began failing on 2026-09-16, from nothing but a new test file changing the order Bun
 * ran them in. Any test that commits a rendered plan calls this in its `finally`.
 */
export async function clearSavedAnswers(): Promise<void> {
  await Bun.write(configFile(), '{}');
}

/**
 * `process.stdin.isTTY` is the only thing `confirmBatch` reads from outside its arguments, and
 * under `bun test` stdin is a pipe. Without this a test takes the no-TTY early return and pins
 * nothing — which is exactly how "`--force` skips the confirm" can be asserted outside a
 * terminal and still pass against code that never reads `--force` at all.
 *
 * The original descriptor is put back rather than assigned over, because on a pipe the property
 * is absent and `isTTY = undefined` is a different shape from absent.
 *
 * Shared rather than copied into each file that needs it: the descriptor dance is the part a
 * later reader would simplify into a plain assignment, and one copy is one place to say why not.
 */
export async function withTty<T>(isTty: boolean, run: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', { value: isTty, configurable: true });
  try {
    return await run();
  } finally {
    if (original) Object.defineProperty(process.stdin, 'isTTY', original);
    else Reflect.deleteProperty(process.stdin, 'isTTY');
  }
}

/**
 * How a prompter that is not exercising the target picker answers it: take everything found,
 * which is what `defaultsPrompter` — and so `--yes` — does. A test that is about the picker
 * supplies its own instead of borrowing this.
 */
export async function pickAll(scans: RepoScan[]): Promise<RepoScan[]> {
  return scans;
}

/** One thing a prompter was asked, in the order it was asked. */
export type Asked = { message: string; fallback: boolean };

/**
 * A real `Prompter` that records what it was asked and answers from a script, rather than a mock
 * of one: what a confirm is driven through here is the same interface `clackPrompter` implements,
 * which is the whole reason the prompter is a parameter and not a `clackPrompter()` reached for
 * inside the gate.
 */
export function recordingPrompter(script: boolean[]): { prompter: Prompter; asked: Asked[] } {
  const asked: Asked[] = [];
  const queue = [...script];
  const prompter: Prompter = {
    async ask(_question, fallback) {
      return fallback;
    },
    async confirm(message, fallback) {
      asked.push({ message, fallback });
      return queue.shift() ?? fallback;
    },
    pick: pickAll,
  };
  return { prompter, asked };
}

export function testScan(overrides: Partial<RepoScan> = {}): RepoScan {
  return {
    path: '/tmp/example',
    name: 'example',
    kind: 'git',
    languages: ['typescript'],
    packageManager: 'bun',
    hasCi: true,
    migrations: [],
    existingDocs: [],
    ledgerDoc: null,
    boardDoc: null,
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
    proofLine: '',
    offLimits: '',
    tierCeiling: 'deep',
    ...overrides,
  };
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...emptyConfig('starter'),
    models: {
      deep: 'Deep Model',
      default: 'Default Model',
      fast: 'Fast Model',
      light: 'Light Model',
    },
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
      adapted: false,
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
