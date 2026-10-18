import { resolve, sep } from 'node:path';
import * as p from '@clack/prompts';
import { clackPrompter, defaultsPrompter, type Prompter } from '../lib/ask.ts';
import { loadConfig } from '../lib/config.ts';
import type { Flow, SetupFrame } from '../lib/frame.ts';
import { claudeDir, configDir } from '../lib/paths.ts';
import type { Answers, Cli } from '../lib/types.ts';
import { say } from '../lib/ui.ts';
import type { PlannedChange } from '../lib/write-plan.ts';
import { askPhase } from '../phases/run.ts';
import { finish, planEverything } from './setup.ts';

/** The rail `global` draws: the person's questions, then the one preview and write. */
export const GLOBAL_FLOW: Flow = {
  view: 'global',
  steps: ['About you', 'Review', 'Write', 'Done'],
  stepOf: () => 0,
  repo: null,
  pick: 0,
  review: 1,
  write: 2,
  done: 3,
  doneTitle: 'Your machine is set up',
  next: [
    ['personal-config profile', 'make a profile, then apply it to folders'],
    ['personal-config doctor', 'check what was written'],
    ['personal-config undo', 'put back what this run changed'],
  ],
};

/**
 * `personal-config global`: the answers that belong to the person, and only the files outside
 * every folder (`~/.claude`, `~/.config/personal-config`). Folders get their answers from a
 * profile (`personal-config profile`), so this is asked once per machine, not once per folder.
 */
export async function runGlobal(cli: Cli, frame?: SetupFrame): Promise<number> {
  const interactive = frame !== undefined || (process.stdin.isTTY === true && !cli.yes);
  const prompter: Prompter = frame?.ask ?? (interactive ? clackPrompter() : defaultsPrompter());
  if (frame === undefined && interactive) p.intro('personal-config — global setup');
  else if (!interactive) say('personal-config — global setup (non-interactive)');

  const config = await loadConfig(cli, null);
  const answers: Answers = { ...config.answers };
  await askPhase('you', prompter, answers, config);
  const changes = globalOnly(await planEverything(config, answers, []));
  await finish(cli, changes, frame?.confirm ?? clackPrompter());
  return 0;
}

/** With no target nothing lands in a folder; the filter makes that a rule, not a result. */
function globalOnly(changes: PlannedChange[]): PlannedChange[] {
  return changes.filter((c) =>
    [claudeDir(), configDir()].some((dir) => under(c.file.path, dir)),
  );
}

function under(path: string, dir: string): boolean {
  const full = resolve(path);
  const root = resolve(dir);
  return full === root || full.startsWith(`${root}${sep}`);
}
