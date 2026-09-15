import { basename } from 'node:path';
import { claudeProjectsDir } from '../lib/paths.ts';
import { contextSize, findBySentinel, transcripts } from '../lib/transcript.ts';
import type { Cli } from '../lib/types.ts';
import { say, short } from '../lib/ui.ts';

const USAGE = [
  'usage: personal-config context --sentinel "<a phrase from this conversation>"',
  '',
  '--sentinel is required, not a convenience. When several sessions share one repo, picking',
  "the newest transcript by modification time reports a neighbouring session's context as",
  'yours. Pass a few words that appear in this conversation and nowhere else.',
].join('\n');

/**
 * Prints the current session's context size, which the harness knows and the agent does not:
 * nothing in context reports it, and the first signal of overrun is auto-compaction firing,
 * by which point the agent is working from a summary of its own reasoning.
 */
export async function runContext(cli: Cli): Promise<number> {
  const sentinel = cli.sentinel?.trim() ?? '';
  if (sentinel === '') return refuse(USAGE);

  const dir = claudeProjectsDir(process.cwd());
  const files = await transcripts(dir);
  if (files.length === 0) return refuse(`no transcript found under ${short(dir)}/`);

  const match = await findBySentinel(files, sentinel);
  if (match === null) return listCandidates(files, sentinel);

  return report(match);
}

async function report(path: string): Promise<number> {
  const size = contextSize(await Bun.file(path).text());
  if (size === null) return refuse(`${basename(path)}: no usage records yet`);
  say(`${basename(path)}  context: ${commas(size)} tokens`);
  return 0;
}

/**
 * No match is a refusal, not a fallback. Guessing here is the exact failure the sentinel was
 * added to prevent, so the candidates are printed for the reader to recognise instead.
 */
function listCandidates(files: string[], sentinel: string): number {
  say(`No transcript in this project contains "${sentinel}".`);
  say('Candidates, newest first — none of them is assumed to be this session:');
  for (const path of files) say(`  ${basename(path)}`);
  say('\nPick a phrase that appears in this conversation, then run it again.');
  return 1;
}

/** `1234567` → `1,234,567`, without a locale: the output is read in tests as well as by people. */
function commas(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function refuse(message: string): number {
  say(message);
  return 1;
}
