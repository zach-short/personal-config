import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { exists, readText } from '../../lib/disk.ts';
import {
  claudeDir,
  claudeHooksDir,
  claudeProjectsDir,
  claudeRulesDir,
  contractHome,
} from '../../lib/paths.ts';
import type { Answers, Finding } from '../../lib/types.ts';

const run = promisify(execFile);

/**
 * What every session in this repo pays before its first question is read: the global
 * `CLAUDE.md`, every rule file with no `paths:` scope, the project `CLAUDE.md`, the project's
 * auto-memory index, and whatever the session banner prints. A measurement on 2026-10-13 put new
 * chats at 92k–130k tokens on turn one, and the cause was not these files' own size but the
 * "read X in full" orders inside them. This rule watches the half that is always loaded, so an
 * order or a pasted section that creeps back in shows up as a number rather than as a slow chat.
 *
 * 8000 tokens is roughly four pages of instructions — enough for a global file, a handful of
 * rules and a project router, and well short of the point where the always-on layer competes
 * with the work. Override it per repo with the `doctor.alwaysOnCeiling` answer.
 */
export const ALWAYS_ON_CEILING = 8000;

/** chars/4 is the usual rough rate for English prose; this rule needs a trend, not a bill. */
const CHARS_PER_TOKEN = 4;

export type WeightPart = { label: string; chars: number };

export async function alwaysOnWeight(root: string, answers: Answers): Promise<Finding[]> {
  const parts = await weightParts(resolve(root));
  const tokens = Math.ceil(parts.reduce((sum, part) => sum + part.chars, 0) / CHARS_PER_TOKEN);
  const ceiling = ceilingFrom(answers['doctor.alwaysOnCeiling'], ALWAYS_ON_CEILING);
  return tokens <= ceiling ? [] : [finding(root, tokens, ceiling, parts)];
}

export async function weightParts(root: string): Promise<WeightPart[]> {
  const files = [
    join(claudeDir(), 'CLAUDE.md'),
    ...(await unscopedRules()),
    join(root, 'CLAUDE.md'),
    join(claudeProjectsDir(root), 'memory', 'MEMORY.md'),
  ];
  const read = await Promise.all(files.map(fileWeight));
  const banner = await bannerWeight(root);
  return [...read, banner].filter(
    (part): part is WeightPart => part !== null && part.chars > 0,
  );
}

/** A rule file scoped with `paths:` frontmatter loads only when a matching file is touched. */
async function unscopedRules(): Promise<string[]> {
  const dir = claudeRulesDir();
  const names = await readdir(dir).catch(() => []);
  const files = names.filter((name) => name.endsWith('.md')).map((name) => join(dir, name));
  const scoped = await Promise.all(files.map(async (file) => isScoped(await readText(file))));
  return files.filter((_, index) => !scoped[index]);
}

function isScoped(text: string): boolean {
  if (!text.startsWith('---')) return false;
  const end = text.indexOf('\n---', 3);
  return end > 0 && /^paths\s*:/m.test(text.slice(3, end));
}

async function fileWeight(path: string): Promise<WeightPart | null> {
  if (!(await exists(path))) return null;
  return { label: contractHome(path), chars: (await readText(path)).length };
}

/**
 * The banner is measured by running it, because what it costs is what it prints, not its
 * source. It runs from the repo root, which is where the harness runs it. A banner that fails or
 * hangs counts as zero: this rule measures weight, and a broken hook is a different finding.
 */
async function bannerWeight(root: string): Promise<WeightPart | null> {
  const script = join(claudeHooksDir(), 'session-banner.sh');
  if (!(await exists(script))) return null;
  const output = await run('bash', [script], { cwd: root, timeout: 5000 })
    .then((result) => result.stdout)
    .catch(() => '');
  return { label: `${contractHome(script)} (stdout)`, chars: output.length };
}

export function ceilingFrom(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function finding(root: string, tokens: number, ceiling: number, parts: WeightPart[]): Finding {
  const heaviest = [...parts].sort((a, b) => b.chars - a.chars).slice(0, 3);
  const named = heaviest
    .map((part) => `${part.label} ~${Math.ceil(part.chars / CHARS_PER_TOKEN)}`)
    .join(', ');
  return {
    rule: 'always-on-weight',
    standardId: null,
    file: join(root, 'CLAUDE.md'),
    line: 1,
    message: `always-loaded context is ~${tokens} tokens, over the ${ceiling} ceiling; heaviest: ${named}`,
    fixable: false,
  };
}
