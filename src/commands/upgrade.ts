import { join, relative } from 'node:path';
import { ignoreTarget } from '../doctor/rules/ignored.ts';
import { unstampedAdaptation } from '../doctor/rules/unstamped-adaptation.ts';
import { collectDocs, type Doc } from '../doctor/scan.ts';
import { confirmWrite } from '../lib/ask.ts';
import { type ChangelogEntry, parseChangelog } from '../lib/changelog.ts';
import { configHash, loadConfig } from '../lib/config.ts';
import { today } from '../lib/date.ts';
import { readText } from '../lib/disk.ts';
import { isGitRepo, isIgnored } from '../lib/git.ts';
import { expandHome, repoRoot } from '../lib/paths.ts';
import { readStamp } from '../lib/stamp.ts';
import type { Cli, PlannedFile } from '../lib/types.ts';
import { previewTree, renderDiff, say, short } from '../lib/ui.ts';
import { assess, entriesText, isFailure, type Verdict, verdictLine } from '../lib/upgrade.ts';
import { version } from '../lib/version.ts';
import { commitPlan, type PlannedChange, resolvePlan, willWrite } from '../lib/write-plan.ts';
import { planned, type RenderContext } from '../render/context.ts';
import { standardVersion } from '../render/standard.ts';
import { type Behind, renderUpgradePrompt, UPGRADE_PROMPT } from '../render/upgrade-prompt.ts';

/**
 * D3's accepted cost, paid in the output rather than left for a person to discover: this answers
 * for the adapted standard only, and `doctor` answers for everything `setup` wrote.
 */
const SCOPE_NOTE =
  'This covers the adapted standard only. `personal-config doctor` reports the generated files a `setup` re-run would change.';

type Installed = { version: string; entries: ChangelogEntry[] };

/**
 * `personal-config upgrade [path…]` — what changed in the standard since each target adapted it
 * (upgrade-command `DESIGN.md` D1–D3). Read-only unless `--write`, and even then it writes an
 * ask, never the adapted document. The delta is the changelog this package ships, read from
 * disk: no network call (U16), and no old boilerplate, because none ships (H2).
 */
export async function runUpgrade(cli: Cli): Promise<number> {
  const roots = cli.paths.length > 0 ? cli.paths.map(expandHome) : [process.cwd()];
  const installed: Installed = {
    version: await standardVersion(),
    entries: parseChangelog(await readText(join(repoRoot(), 'standard', 'CHANGELOG.md'))),
  };

  let code = 0;
  for (const root of roots) code = Math.max(code, await upgradeOne(cli, root, installed));
  return code;
}

async function upgradeOne(cli: Cli, root: string, installed: Installed): Promise<number> {
  say(`\n${short(root)}`);
  const standards = await standardDocs(root);
  const adapted = standards.filter((doc) => readStamp(doc.text)?.adapted === true);
  if (adapted.length === 0) {
    say(`  ${notAdapted(root, standards)}`);
    return 0;
  }

  const verdicts = adapted.map((doc) => ({
    path: relative(root, doc.path),
    verdict: assess(
      readStamp(doc.text)?.standardVersion ?? '',
      installed.version,
      installed.entries,
    ),
  }));
  for (const { path, verdict } of verdicts) report(path, verdict);

  const behind = verdicts.flatMap(({ path, verdict }) =>
    verdict.kind === 'behind' ? [{ path, ...verdict }] : [],
  );
  const wrote = behind.length > 0 && cli.write ? await writePrompt(cli, root, behind) : 0;
  if (behind.length > 0 && !cli.write) {
    say(
      `\nRun with --write to save this as ${UPGRADE_PROMPT} at the repo root, for a fresh session to act on.`,
    );
  }
  say(`\n${SCOPE_NOTE}`);
  return Math.max(wrote, verdicts.some(({ verdict }) => isFailure(verdict)) ? 1 : 0);
}

/**
 * The standard documents this target keeps, found the way `doctor` finds them — by name, and by
 * the names `.personal-config.json` adopted — so the two commands cannot disagree about which
 * file is the standard. A stamp is not proof the tool wrote it (H6), so nothing here asks who
 * did; the version it names is read the same either way.
 */
async function standardDocs(root: string): Promise<Doc[]> {
  const docs = await collectDocs(root);
  return docs.filter((doc) => doc.kind === 'standard' && !doc.isTemplate);
}

/**
 * DIAL-5: one line and exit 0, because a target with nothing adapted has nothing to upgrade. Which
 * line depends on why. A copy adapted before the marker existed is adapted and simply invisible —
 * the repos this command was scoped against are both in that state — and telling that person
 * "nothing to compare" without naming `doctor --fix` would leave them where they started.
 */
function notAdapted(root: string, standards: Doc[]): string {
  const unstamped = standards.find((doc) => unstampedAdaptation.check(doc).length > 0);
  if (unstamped) {
    return `${relative(root, unstamped.path)} was adapted by Part 0 but carries no stamp, so its version cannot be read. \`personal-config doctor --fix\` writes one; then run this again.`;
  }
  if (standards.some((doc) => readStamp(doc.text) !== null)) {
    return 'No adapted standard here — the standard is still the one `setup` wrote, so re-running `setup` brings it up to date. `personal-config doctor` says whether it is behind.';
  }
  return 'No adapted standard here — nothing carries a standard stamp marked ` · adapted`, so there is nothing for `upgrade` to compare.';
}

function report(path: string, verdict: Verdict): void {
  say(`  ${verdictLine(path, verdict)}`);
  if (verdict.kind === 'behind' && verdict.entries.length > 0) {
    say(`\n${entriesText(verdict.entries)}`);
  }
}

/**
 * The file, and an ignore line for it: DIAL-6 puts the prompt on the ignore list, and `doctor`
 * reports a personal file git can still see, so writing one without the other would be a command
 * that leaves a finding in the repo its own checker then reports (H5). Planned only where git
 * does not already ignore the name, and not at all in a folder with no git.
 */
async function writePrompt(cli: Cli, root: string, behind: Behind[]): Promise<number> {
  const ctx = await promptContext(cli, root);
  const files: PlannedFile[] = [renderUpgradePrompt(ctx, root, behind)];
  if ((await isGitRepo(root)) && !(await isIgnored(root, UPGRADE_PROMPT))) {
    files.push(
      planned(ctx, await ignoreTarget(root), 'ignore entries', `/${UPGRADE_PROMPT}\n`, {
        strategy: 'append-lines',
        stamp: false,
      }),
    );
  }

  const changes = await resolvePlan(files);
  say(`\n${preview(changes)}`);
  return commitIfConfirmed(cli, changes);
}

async function commitIfConfirmed(cli: Cli, changes: PlannedChange[]): Promise<number> {
  if (changes.some((change) => change.guard !== 'none')) {
    say(
      `\n${UPGRADE_PROMPT} is already there and this tool did not write it. Move it aside and run this again.`,
    );
    return 1;
  }
  if (!changes.some(willWrite)) {
    say(`\n${UPGRADE_PROMPT} already says this. Nothing to write.`);
    return 0;
  }
  if (cli.dryRun) {
    say('\n--dry-run: nothing was written.');
    return 0;
  }
  if (!(await confirmWrite(`Write ${UPGRADE_PROMPT}?`, cli.force))) {
    say('Nothing was written.');
    return 0;
  }
  const result = await commitPlan(changes);
  say(`\nWrote ${result.written.length} file(s).`);
  if (result.manifest) say('`personal-config undo` restores what was there before.');
  return 0;
}

/**
 * The stamp says what wrote the file and from what, the way every stamp does: this CLI, the
 * installed standard, and the hash of the answers `setup` would load here. The prompt is not
 * rendered from those answers, but the field means the answers in force, and there is one
 * honest value for it.
 */
async function promptContext(cli: Cli, root: string): Promise<RenderContext> {
  const config = await loadConfig(cli, root);
  const date = today();
  return {
    config,
    answers: config.answers,
    date,
    repo: null,
    stamp: {
      version: await version(),
      date,
      configHash: await configHash(config),
      standardVersion: await standardVersion(),
      adapted: false,
    },
  };
}

function preview(changes: PlannedChange[]): string {
  const real = changes.filter(willWrite);
  if (real.length === 0) return previewTree(changes);
  return [previewTree(changes), ...real.map((change) => `\n${renderDiff(change)}`)].join('\n');
}
