import { clackPrompter, type Prompter } from '../lib/ask.ts';
import { type Backup, latestBackup, restore } from '../lib/backup.ts';
import { say, short } from '../lib/ui.ts';

/** `root` scopes the restore to one repository's backups; `yes` answers for a run with no terminal. */
export type UndoOptions = { root?: string; yes?: boolean; force?: boolean };

/**
 * Restores the overwritten files of the last run that touched the directory this runs in. Files
 * this tool created new are left in place.
 *
 * **`undo` is a one-shot, one-way restore** — decided 2026-09-17 against the alternative of
 * snapshotting the pre-`undo` state into a backup of its own, so that an `undo` could itself be
 * undone. It does not do that: what it writes over is gone, and there is no undo of an undo.
 * Everything else here is that sentence made honest rather than quietly true. It lists what it
 * would overwrite and asks first, the way every other write in this tool does. And it refuses a
 * backup it has already spent instead of reapplying it, because the second `undo` of the same
 * manifest lands on whatever the person has done since — usually the one edit they meant to keep.
 *
 * The prompter is a defaulted parameter for the reason `finish`'s is: clack reads raw key input
 * a pipe does not satisfy, so the declined path is undrivable from a test through the real one.
 */
export async function runUndo(
  prompter: Prompter = clackPrompter(),
  options: UndoOptions = {},
): Promise<number> {
  // Not mapped to the main checkout from a worktree (`documentRoot`): the manifest records the
  // folder a run started in, so a claim made here is found from here although it wrote the main
  // checkout's board, and mapping would also admit every other lane's run nested under it.
  const root = options.root ?? process.cwd();
  const backup = await latestBackup(root);
  if (!backup || backup.manifest.entries.length === 0) {
    say(
      `No backup of files under ${short(root)} to restore — the last run here overwrote nothing.`,
    );
    return 0;
  }
  if (backup.restoredAt !== null) {
    say(alreadySpent(backup));
    return 1;
  }

  say(preview(backup));
  const answer = await confirmed(prompter, backup, options);
  if (answer === 'refused') {
    say(needsYes());
    return 1;
  }
  if (answer === 'no') {
    say('\nNothing was restored.');
    return 0;
  }
  say(report(backup, await restore(backup)));
  return 0;
}

/** What the confirm is being asked about: the paths, and what restoring them costs. */
function preview(backup: Backup): string {
  return [
    `\nThe backup taken at ${backup.manifest.timestamp} holds ${backup.manifest.entries.length} file(s):`,
    ...backup.manifest.entries.map((entry) => `  ${short(entry.original)}`),
    '\nRestoring is one-way: `undo` keeps no backup of its own, so anything changed in those',
    'files since that run is overwritten and gone.',
  ].join('\n');
}

/**
 * Stricter than `confirmWrite`: with no terminal there is nobody to ask, and a restore is the one
 * write here that cannot be undone, so it goes ahead unasked only when `--yes` or `--force` said
 * so (the README has promised "asks first" since 0.7.0; the no-TTY path did not, until
 * 2026-10-16). Spelled here rather than in `ask.ts` because this one has to be answerable by a
 * prompter a test hands it.
 */
async function confirmed(
  prompter: Prompter,
  backup: Backup,
  options: UndoOptions,
): Promise<'yes' | 'no' | 'refused'> {
  if (options.force === true) return 'yes';
  if (process.stdin.isTTY !== true) return options.yes === true ? 'yes' : 'refused';
  const ok = await prompter.confirm(
    `Restore these ${backup.manifest.entries.length} file(s)?`,
    true,
  );
  return ok ? 'yes' : 'no';
}

function needsYes(): string {
  return [
    '\nNo terminal to ask in, so nothing was restored. The list above is what `--yes` would put',
    'back: run `personal-config undo --yes` to restore it.',
  ].join('\n');
}

/**
 * The refusal. Reapplying a spent backup is harmless only while nothing happened in between, and
 * what usually happens in between is the person restoring by hand the one file they wanted back.
 */
function alreadySpent(backup: Backup): string {
  return [
    `That backup has already been restored, at ${backup.restoredAt}:`,
    `  ${short(backup.dir)}`,
    '\n`undo` restores a backup once. Applying it again would write those files over whatever',
    'has changed since, and there is no backup of that. Nothing was restored.',
  ].join('\n');
}

function report(backup: Backup, restored: string[]): string {
  return [
    `\nRestored ${restored.length} file(s) from the backup taken at ${backup.manifest.timestamp}:`,
    ...restored.map((path) => `  ${short(path)}`),
    '\nFiles this tool created new were not deleted — remove any you do not want.',
  ].join('\n');
}
