import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { today } from '../lib/date.ts';
import { currentBranch } from '../lib/git.ts';
import {
  duplicateSteps,
  type LedgerStep,
  ledgerSteps,
  missingSteps,
  nextFreeStep,
} from '../lib/ledger.ts';
import { readDocNames } from '../lib/repo-config.ts';
import type { Cli } from '../lib/types.ts';
import { say, short } from '../lib/ui.ts';

const USAGE = 'usage: personal-config handoff step';

/**
 * §2.1: take the next ledger number **by reading the file**, not by trusting one written
 * elsewhere. This reads the file.
 *
 * What it cannot do is reserve the number, and the board item that asked for this used the word
 * "reserve". Reserving means writing, and the only thing there is to write at this point is an
 * empty step — so it reports instead, and prints the file's modification time so a session that
 * has been thinking for ten minutes can tell whether the answer has gone stale underneath it.
 */
export async function runHandoff(cli: Cli): Promise<number> {
  if (cli.paths[0] !== 'step') return refuse(USAGE);

  const root = process.cwd();
  const { ledger } = await readDocNames(root);
  const path = join(root, ledger);
  const file = Bun.file(path);
  if (!(await file.exists())) return refuse(noLedger(path));

  const steps = ledgerSteps(await file.text());
  await report(root, path, steps);
  return 0;
}

function noLedger(path: string): string {
  return [
    `${short(path)} is not there, so there is no step log to read.`,
    'A Profile P repo records work in `docs/incomplete/<slug>/` instead and has no ledger;',
    'a Profile L repo gets one from `personal-config setup`.',
  ].join('\n');
}

async function report(root: string, path: string, steps: LedgerStep[]): Promise<void> {
  const next = nextFreeStep(steps);
  const modified = (await stat(path)).mtime.toISOString();

  say(`${short(path)} — ${steps.length} step(s), last modified ${modified}`);
  say(`\nThe next free number is ${next}.`);
  say(caveat(next));
  for (const line of anomalies(steps)) say(line);
  say(`\n${await scaffold(root, next, steps)}`);
}

/**
 * Said every time, because the failure it describes is invisible: two sessions a second apart
 * both read this file and both get the same number, and neither finds out until something cites
 * the step and lands on the other one's.
 */
function caveat(next: number): string {
  return [
    `Reported, not reserved — nothing here writes, so a second session reading this file`,
    `now also gets ${next}. Re-read the log immediately before you append, and if the`,
    'modification time above has moved since you ran this, read it again.',
  ].join('\n');
}

function anomalies(steps: LedgerStep[]): string[] {
  const missing = missingSteps(steps);
  const duplicates = duplicateSteps(steps);
  return [
    ...(missing.length > 0
      ? [
          `\nMissing below the highest: ${missing.join(', ')} — \`doctor\` flags the log as non-contiguous. The hole is not yours to fill; the log is append-only.`,
        ]
      : []),
    ...(duplicates.length > 0
      ? [`\nAlready used twice: ${duplicates.join(', ')} — two sessions took one number.`]
      : []),
  ];
}

/** §2.1's own list of what a step names, as a line to fill rather than a paragraph to recall. */
async function scaffold(root: string, next: number, steps: LedgerStep[]): Promise<string> {
  const branch = (await currentBranch(root)) ?? '<branch>';
  const previous = steps.at(-1);
  return [
    'Scaffold — what §2.1 says a step names:',
    '',
    `**${next}. <Imperative title>.** Done ${today()}, <model>, on \`${branch}\`, commit \`<hash>\`.`,
    '<What changed and why.> <What is now fixed.> <Which questions it answered.>',
    '<New files, added to the code map above.> **Left owed:** <what this did not do>.',
    '',
    previous
      ? `The step before it is ${previous.number}, at line ${previous.line}.`
      : 'This would be the first step.',
  ].join('\n');
}

function refuse(message: string): number {
  say(message);
  return 1;
}
