#!/usr/bin/env bun
import { runArchive } from './commands/archive.ts';
import { runCatalog } from './commands/catalog.ts';
import { runContext } from './commands/context.ts';
import { runHandoff } from './commands/handoff.ts';
import { runPassoff } from './commands/passoff.ts';
import { runSetup } from './commands/setup.ts';
import { runUndo } from './commands/undo.ts';
import { runWorktree } from './commands/worktree.ts';
import { runDoctor } from './doctor/index.ts';
import { parseCli } from './lib/args.ts';
import { version } from './lib/version.ts';

const HELP = `personal-config — set up an agent-driven working style in your repos

  personal-config setup                        ask, preview, then write
  personal-config doctor                       check what is written, against the rules it follows
  personal-config undo                         restore the files the last run overwrote
  personal-config passoff next                 the next OPEN board item, with its prompt
  personal-config passoff claim <n>            mark item <n> IN FLIGHT, dated
  personal-config handoff step                 the next free ledger step number
  personal-config archive <slug>               plan Part 7's archiving steps for closed work
  personal-config worktree <lane>              plan a lane's worktree, with its checkout recipe
  personal-config context --sentinel <phrase>  this session's context size, from its transcript
  personal-config catalog                      regenerate catalog.json — the questions, as data

Options
  --profile <name>     start from profiles/<name>.json          (default: starter)
  --from <src>         setup only: start from a profile you already have —
                       ./profile.json, an https URL, or the 8-character id the site gives you
  --projects-dir <dir> where to look for repos                  (default: ~/Projects)
  --yes                accept every default without asking       (still previews, still confirms)
  --dry-run            print the preview and write nothing
  --force              skip the confirm (implies you have read the preview)
  --fix                doctor only: apply the mechanical fixes
  --move               archive only: perform the move, not just the plan
  --sentinel <phrase>  context only: a phrase unique to this conversation  (required)
  --help, --version

Nothing leaves your machine — --from <url|id> is the one exception, and it only fetches the
profile you ask for. Every run previews the whole file tree before writing, backs up anything it
overwrites, and can be undone.`;

async function main(): Promise<number> {
  const cli = parseCli(Bun.argv.slice(2));

  if (cli.command === 'version') {
    console.log(await version());
    return 0;
  }
  if (cli.command === 'help') {
    console.log(HELP);
    return 0;
  }
  if (cli.command === 'setup') return runSetup(cli);
  if (cli.command === 'catalog') return runCatalog();
  if (cli.command === 'doctor') return runDoctor(cli);
  if (cli.command === 'undo') return runUndo();
  if (cli.command === 'archive') return runArchive(cli);
  if (cli.command === 'passoff') return runPassoff(cli);
  if (cli.command === 'handoff') return runHandoff(cli);
  if (cli.command === 'worktree') return runWorktree(cli);
  if (cli.command === 'context') return runContext(cli);
  return 1;
}

process.exit(await main());
