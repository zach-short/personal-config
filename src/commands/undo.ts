import { clackPrompter, type Prompter } from '../lib/ask.ts';
import { type Backup, latestBackup, restore } from '../lib/backup.ts';
import { say, short } from '../lib/ui.ts';

/**
 * Restores the last run's overwritten files. Files this tool created new are left in place.
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
export async function runUndo(prompter: Prompter = clackPrompter()): Promise<number> {
  const backup = await latestBackup();
  if (!backup || backup.manifest.entries.length === 0) {
    say('No backup to restore — the last run overwrote nothing.');
    return 0;
  }
  if (backup.restoredAt !== null) {
    say(alreadySpent(backup));
    return 1;
  }

  say(preview(backup));
  if (!(await confirmed(prompter, backup))) {
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
 * The same rule `confirmWrite` states for `archive` and `passoff` — with no TTY there is nobody
 * to ask, and the list printed above it is the whole contract. Spelled here rather than called
 * there because this one has to be answerable by a prompter a test hands it.
 */
async function confirmed(prompter: Prompter, backup: Backup): Promise<boolean> {
  if (process.stdout.isTTY !== true) return true;
  return prompter.confirm(`Restore these ${backup.manifest.entries.length} file(s)?`, true);
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
