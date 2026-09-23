#!/usr/bin/env node
import { runArchive } from './commands/archive.ts';
import { runCatalog } from './commands/catalog.ts';
import { runContext } from './commands/context.ts';
import { runFold } from './commands/fold.ts';
import { runHandoff } from './commands/handoff.ts';
import { runPassoff } from './commands/passoff.ts';
import { runSetup } from './commands/setup.ts';
import { runUndo } from './commands/undo.ts';
import { runUpgrade } from './commands/upgrade.ts';
import { runWorktree } from './commands/worktree.ts';
import { runDoctor } from './doctor/index.ts';
import { checkUsage, parseCli } from './lib/args.ts';
import type { Cli } from './lib/types.ts';
import { version } from './lib/version.ts';

const HELP = `personal-config — set up an agent-driven working style in your repos

  personal-config setup                        ask, preview, then write
  personal-config doctor                       check what is written, against the rules it follows
  personal-config upgrade [path…]             what changed in the standard since a repo adapted it
  personal-config undo                         restore the files the last run overwrote
  personal-config passoff next                 the next OPEN board item, with its prompt
  personal-config passoff claim <n>            mark item <n> IN FLIGHT, dated
  personal-config handoff step                 the next free ledger step number
  personal-config archive <slug>               plan Part 7's archiving steps for closed work
  personal-config fold [board|ledger]          move closed prompts and old step bodies to the archive
  personal-config worktree <lane>              plan a lane's worktree, with its checkout recipe
  personal-config context --sentinel <phrase>  this session's context size, from its transcript
  personal-config catalog                      regenerate catalog.json — the questions, as data

Options
  --profile <name>     start from profiles/<name>.json          (default: starter)
  --from <src>         setup only: start from a profile you already have —
                       ./profile.json, an https URL, or the 8-character id the site gives you
  --projects-dir <dir> where to look for repos                  (default: profiles/starter.json)
  --yes                accept every default without asking       (still previews, still confirms)
                       setup: configures every target found under --projects-dir
  --dry-run            print the preview and write nothing
  --force              skip the confirm (implies you have read the preview)
  --fix                doctor only: apply the mechanical fixes
  --move               archive only: perform the move, not just the plan
  --write              upgrade only: also save it as UPGRADE-PROMPT.md at the repo root
  --keep <n>           fold only: ledger steps left whole, newest first  (default: 20)
  --sentinel <phrase>  context only: a phrase unique to this conversation  (required)
  --help, --version

Nothing leaves your machine — --from <url|id> is the one exception, and it only fetches the
profile you ask for. Every run previews the whole file tree before writing, backs up anything it
overwrites, and can be undone.`;

/**
 * Which function runs a command, as a table rather than a chain of comparisons. `catalog` and
 * `undo` are wrapped because neither takes the parsed argv — `undo` takes a prompter, and
 * handing it a `Cli` would typecheck nowhere but read as if it might.
 */
const DISPATCH: Record<string, (cli: Cli) => Promise<number>> = {
  setup: runSetup,
  catalog: () => runCatalog(),
  doctor: runDoctor,
  undo: () => runUndo(),
  archive: runArchive,
  fold: runFold,
  passoff: runPassoff,
  handoff: runHandoff,
  worktree: runWorktree,
  context: runContext,
  upgrade: runUpgrade,
};

async function main(): Promise<number> {
  const argv = process.argv.slice(2);

  // A mistyped command used to print help and exit 0, so a typo was indistinguishable from a
  // successful run — in a script, `personal-config doctorr` passed. Errors go to stderr so a
  // redirected stdout does not swallow them.
  const problem = checkUsage(argv);
  if (problem !== null) {
    console.error(problem);
    return 1;
  }

  const cli = parseCli(argv);

  if (cli.command === 'version') {
    console.log(await version());
    return 0;
  }
  if (cli.command === 'help') {
    console.log(HELP);
    return 0;
  }

  const run = DISPATCH[cli.command];
  // Unreachable: `checkUsage` has already refused anything not in COMMANDS. Kept as a non-zero
  // backstop, because the one thing this must never do again is exit 0 without running.
  return run === undefined ? 1 : run(cli);
}

/**
 * A command that throws used to reach Node's default handler, which prints the error class, its
 * frames and the path of the installed file — the same wall of text the argument layer produced
 * before `checkUsage`. `--from` reaching a server that redirects or never answers is the common
 * way to get here, and the message is the only part of that output a person can act on.
 */
async function run(): Promise<number> {
  try {
    return await main();
  } catch (error) {
    console.error(`personal-config: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

process.exit(await run());
