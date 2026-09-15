import { latestManifest, restore } from '../lib/backup.ts';
import { say, short } from '../lib/ui.ts';

/** Restores the last run's overwritten files. Files this tool created new are left in place. */
export async function runUndo(): Promise<number> {
  const manifest = await latestManifest();
  if (!manifest || manifest.entries.length === 0) {
    say('No backup to restore — the last run overwrote nothing.');
    return 0;
  }

  const restored = await restore(manifest);
  say(`Restored ${restored.length} file(s) from the backup taken at ${manifest.timestamp}:`);
  for (const path of restored) say(`  ${short(path)}`);
  say('\nFiles this tool created new were not deleted — remove any you do not want.');
  return 0;
}
