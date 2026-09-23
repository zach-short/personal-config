import { basename, join, resolve } from 'node:path';
import type { ChangelogEntry } from '../lib/changelog.ts';
import type { PlannedFile } from '../lib/types.ts';
import { entriesText } from '../lib/upgrade.ts';
import { planned, type RenderContext } from './context.ts';

export const UPGRADE_PROMPT = 'UPGRADE-PROMPT.md';

/** One adapted standard that is behind, with the path a session in the repo would open it by. */
export type Behind = { path: string; from: string; to: string; entries: ChangelogEntry[] };

/**
 * `UPGRADE-PROMPT.md` — the long form of what `upgrade` prints, for the case scrollback is bad
 * at (upgrade-command `DESIGN.md` D1). It asks; it edits nothing (DIAL-7). The session that acts
 * on it bumps the stamp, because that edit is the claim the work was done and only the session
 * that did it can make it.
 *
 * It must pass `doctor` in the repo it lands in (H5), so every date in it is absolute and it
 * quotes no stamp line: a stamp-shaped line in its body would be read as provenance by anything
 * that scans for one.
 */
export function renderUpgradePrompt(
  ctx: RenderContext,
  root: string,
  behind: Behind[],
): PlannedFile {
  const body = [
    `# Upgrade the adapted standard — ${basename(resolve(root))}`,
    '',
    `Written by \`personal-config upgrade --write\` on ${ctx.date}. Hand it to a fresh session in`,
    'this repo — paste it, or say "read UPGRADE-PROMPT.md and do what it asks". Delete it once the',
    'work is recorded.',
    '',
    ...behind.flatMap(section),
    '## How to apply it',
    '',
    ...steps(behind),
  ].join('\n');
  return planned(ctx, join(root, UPGRADE_PROMPT), 'upgrade prompt', `${body}\n`);
}

function section(item: Behind): string[] {
  return [
    `## \`${item.path}\` — v${item.from} to v${item.to}`,
    '',
    `This file was adapted from standard v${item.from}. The installed standard is v${item.to}.`,
    "Below is the standard's own changelog for every version after the first, up to and",
    'including the second, newest first — as shipped in `standard/CHANGELOG.md` of the',
    'personal-config package that wrote this file.',
    '',
    item.entries.length === 0
      ? '_The changelog has no entry between these versions. It is missing one, so ask the owner what changed rather than guessing from the boilerplate._'
      : entriesText(item.entries, '###'),
    '',
  ];
}

function steps(behind: Behind[]): string[] {
  const files = behind.map((item) => `\`${item.path}\``).join(' and ');
  const bumps = behind.map(
    (item) =>
      `   - in \`${item.path}\`: \`standard v${item.from}\` becomes \`standard v${item.to}\``,
  );
  return [
    `1. Read ${files} in full, then the entries above **oldest first** —`,
    '   each one assumes the ones before it.',
    '2. Make each change in the adapted file the way Part 0 made the rest of it: fill what the',
    "   entry names from this repo, cut what does not apply here, and keep this repo's own names",
    '   and citations. Where an entry changes something this repo already cut, say so in the',
    '   ledger step and move on.',
    "3. Do not replace the file with the new boilerplate. It is this repo's document; the",
    '   changelog says what moved, and the adaptation is exactly what a copy would lose.',
    '4. When every entry is applied, edit the stamp line at the top of the file, keeping',
    '   ` · adapted` on the end — that edit is what tells `personal-config doctor` the upgrade',
    '   happened:',
    ...bumps,
    '5. Record it as one ledger step naming each version applied, then delete this file.',
    '',
    'Done when `personal-config doctor` reports no advisory finding on the adapted file, and',
    '`personal-config upgrade` says there is nothing to do.',
  ];
}
