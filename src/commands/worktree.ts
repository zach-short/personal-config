import { basename, resolve } from 'node:path';
import { isGitRepo } from '../lib/git.ts';
import { fillWorktree, recipeBlocks, UNFILLED } from '../lib/recipe.ts';
import { readStandardPath, readWorktreePath } from '../lib/repo-config.ts';
import type { Cli } from '../lib/types.ts';
import { say, short } from '../lib/ui.ts';

/** Where a lane's worktree goes when the repo has not said otherwise. */
const DEFAULT_PATH = '../<repo>-<lane>';

type Standard = { path: string; text: string };
type Found = { ok: true; standard: Standard } | { ok: false; reason: string };

/**
 * Plans a lane's worktree: where it goes, and the fresh-checkout recipe that has to run inside
 * it before any gate there means anything.
 *
 * It prints rather than performs, for the reason Part 6 opens by naming — a fresh checkout fails
 * gates for environmental reasons before it fails a real one. A command that created the
 * checkout but left its recipe to the reader would hand back exactly that state, and `undo`
 * cannot reach a worktree. The `git worktree add` line is not the part anyone forgets.
 */
export async function runWorktree(cli: Cli): Promise<number> {
  const root = process.cwd();
  const lane = cli.paths[0];
  if (lane === undefined) return refuse('usage: personal-config worktree <lane>');
  if (!(await isGitRepo(root))) return refuse(`${short(root)} is not a git repository.`);

  const found = await findStandard(root);
  if (!found.ok) return refuse(found.reason);

  const blocks = recipeBlocks(found.standard.text);
  const problem = recipeProblem(blocks, found.standard.path);
  if (problem !== null) return refuse(problem);

  const template = (await readWorktreePath(root)) ?? DEFAULT_PATH;
  printPlan(lane, resolve(root, fill(template, basename(root), lane)), blocks, found.standard);
  return 0;
}

/**
 * The adapted standard, which is the only copy whose recipe is filled in: `{{WORKTREE_SETUP}}`
 * is one of the two placeholders Part 0 deliberately leaves in the shipped one. Refusing when
 * `.personal-config.json` is absent is the honest answer — there is nothing to guess from, and
 * a guessed standard would print a recipe belonging to some other repo.
 */
async function findStandard(root: string): Promise<Found> {
  const relative = await readStandardPath(root);
  if (relative === null) {
    return {
      ok: false,
      reason: [
        `${short(root)} has no .personal-config.json recording where its adapted standard lives.`,
        'Run `personal-config setup` in this repo first.',
      ].join('\n'),
    };
  }

  const path = resolve(root, relative);
  const text = await Bun.file(path)
    .text()
    .catch(() => null);
  if (text === null) {
    return {
      ok: false,
      reason: `${short(path)} is recorded as this repo's standard, but nothing is there.`,
    };
  }
  return { ok: true, standard: { path, text } };
}

function recipeProblem(blocks: string[], path: string): string | null {
  if (blocks.length === 0) {
    return [
      `${short(path)} has no "## The fresh-checkout recipe" section.`,
      'It predates Part 6 of the standard, or it is not the standard.',
    ].join('\n');
  }
  if (blocks.some((block) => block.includes(UNFILLED))) {
    return [
      `${short(path)} still carries the unfilled ${UNFILLED} placeholder.`,
      'Part 0 fills it from what .gitignore hides and what the toolchain generates;',
      'until it does, there is no recipe here to run.',
    ].join('\n');
  }
  return null;
}

function fill(template: string, repo: string, lane: string): string {
  return template.replaceAll('<repo>', repo).replaceAll('<lane>', lane);
}

function printPlan(lane: string, path: string, blocks: string[], standard: Standard): void {
  say(`lane ${lane} → ${short(path)}\n`);
  say(`  git worktree add ${short(path)} -b ${lane}\n`);
  say(`Then, inside it — the fresh-checkout recipe from ${short(standard.path)}:\n`);
  for (const block of blocks) say(`${indent(fillWorktree(block, short(path)))}\n`);
  say('Run every one of these before believing any gate in that worktree: a fresh checkout');
  say('fails gates for environmental reasons before it fails a real one (standard, Part 6).');
}

function indent(block: string): string {
  return block
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function refuse(message: string): number {
  say(message);
  return 1;
}
