#!/usr/bin/env bun
import { runContext } from './commands/context.ts';
import { runSetup } from './commands/setup.ts';
import { runUndo } from './commands/undo.ts';
import { runWorktree } from './commands/worktree.ts';
import { runDoctor } from './doctor/index.ts';
import { parseCli } from './lib/args.ts';
import { version } from './lib/version.ts';

const HELP = `personal-config — set up an agent-driven working style in your repos

  personal-config setup      ask, preview, then write
  personal-config doctor     check what is written for the rules it is supposed to follow
  personal-config undo       restore the files the last run overwrote
  personal-config worktree <lane>   plan a lane's worktree, with this repo's fresh-checkout recipe
  personal-config context --sentinel <phrase>   this session's context size, from its transcript

Options
  --profile <name>     start from profiles/<name>.json          (default: starter)
  --projects-dir <dir> where to look for repos                  (default: ~/Projects)
  --yes                accept every default without asking       (still previews, still confirms)
  --dry-run            print the preview and write nothing
  --force              skip the confirm (implies you have read the preview)
  --fix                doctor only: apply the mechanical fixes
  --sentinel <phrase>  context only: a phrase unique to this conversation  (required)
  --help, --version

Nothing leaves your machine. Every run previews the whole file tree before writing, backs up
anything it overwrites, and can be undone.`;

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
  if (cli.command === 'doctor') return runDoctor(cli);
  if (cli.command === 'undo') return runUndo();
  if (cli.command === 'worktree') return runWorktree(cli);
  if (cli.command === 'context') return runContext(cli);
  return 1;
}

process.exit(await main());
