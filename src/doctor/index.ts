import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { configHash, loadConfig } from '../lib/config.ts';
import { exists } from '../lib/disk.ts';
import { isGitRepo } from '../lib/git.ts';
import { expandHome } from '../lib/paths.ts';
import type { Cli, Finding } from '../lib/types.ts';
import { commitPlan, resolvePlan } from '../lib/write-plan.ts';
import { standardVersion } from '../render/standard.ts';
import { absenceEvidence } from './rules/absence-evidence.ts';
import { archiveIndex } from './rules/archive-index.ts';
import { archivedCitations } from './rules/archived-citations.ts';
import { boardStatus } from './rules/board-status.ts';
import { ignoredFiles, ignoreFix, ignoreTarget } from './rules/ignored.ts';
import { placeholders } from './rules/placeholders.ts';
import { relativeDates } from './rules/relative-dates.ts';
import { settledSupersession } from './rules/settled-supersession.ts';
import { stampDrift } from './rules/stamp-drift.ts';
import { stepNumbers } from './rules/step-numbers.ts';
import { unfolded } from './rules/unfolded.ts';
import { collectDocs, type Doc } from './scan.ts';

const DOC_RULES = [
  relativeDates,
  absenceEvidence,
  placeholders,
  stepNumbers,
  boardStatus,
  unfolded,
];

export type DoctorReport = { findings: Finding[]; checked: number };

/** Every rule reports `file:line`; any finding at all is a non-zero exit. */
export async function runDoctorOn(
  root: string,
  expectation: Expectation,
): Promise<DoctorReport> {
  const docs = await collectDocs(root);

  const fromDocs = docs
    .filter((doc) => !doc.isTemplate)
    .flatMap((doc) =>
      DOC_RULES.filter((rule) => rule.appliesTo(doc)).flatMap((rule) => rule.check(doc)),
    );

  const fromArchive = (
    await Promise.all(docs.filter(archiveIndex.appliesTo).map((doc) => archiveIndex.check(doc)))
  ).flat();

  // Drift and ignore-coverage are only meaningful in a repo this tool actually configured.
  // Without a `.personal-config.json` there is no config for a stamp to have drifted from,
  // and a `PART0-PROMPT.md` sitting in, say, a docs folder is not a personal file at all.
  const configured = await exists(join(root, '.personal-config.json'));
  const fromStamps = configured ? docs.flatMap((doc) => stampDrift(doc, expectation)) : [];
  const fromCitations = archivedCitations(docs, await archivedInfo(docs));
  // Ignore coverage is a question for git, and a plain folder (setup-tracks `DESIGN.md` D5) has
  // none to ask: `check-ignore` there resolves whatever repository *encloses* the folder, if any,
  // and would report a personal file as unignored by a `.gitignore` that is not this target's.
  const fromIgnore = configured && (await isGitRepo(root)) ? await ignoredFiles(root) : [];

  // Not gated on `configured`: R8 guards a decision record, and a repo keeping one has not
  // necessarily been through this wizard. The git read answers null wherever it cannot apply.
  const fromSettled = await settledSupersession(root, docs);

  return {
    findings: sort([
      ...fromDocs,
      ...fromArchive,
      ...fromStamps,
      ...fromCitations,
      ...fromIgnore,
      ...fromSettled,
    ]),
    checked: docs.length,
  };
}

type Expectation = { configHash: string; standardVersion: string };

/**
 * Folder names sitting in an archive index's directory — what "now lives in the archive" means
 * — plus the directories themselves, so a doc can be excluded by identity (its path sits under
 * one) rather than by a `/archive/` substring, which answers differently depending on whether
 * the root was typed relatively or absolutely.
 */
async function archivedInfo(docs: Doc[]): Promise<{ names: string[]; dirs: string[] }> {
  const dirs = docs
    .filter((d) => d.kind === 'archive-index')
    .map((doc) => doc.path.slice(0, doc.path.lastIndexOf('/')));
  const names = await Promise.all(
    dirs.map(async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    }),
  );
  return { names: names.flat(), dirs };
}

function sort(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

export async function runDoctor(cli: Cli): Promise<number> {
  const roots = cli.paths.length > 0 ? cli.paths.map(expandHome) : [process.cwd()];
  const standard = await standardVersion();

  let total = 0;
  for (const root of roots) {
    // Per root, not once for the run. Now that `setup` saves its answers into each repo's
    // `.personal-config.json`, the expected hash is a property of the repo being checked —
    // computing it once from `roots[0]` would judge every later repo against the first one's
    // answers. Harmless while no answers were saved and both hashes were a profile's
    // defaults; a false drift finding the moment they are.
    const config = await loadConfig(cli, root);
    const expectation: Expectation = {
      configHash: await configHash(config),
      standardVersion: standard,
    };
    const report = await runDoctorOn(root, expectation);
    printReport(root, report);
    total += report.findings.length - (await fixIfAsked(cli, root, report.findings));
  }

  console.log(total === 0 ? '\ndoctor: no findings.' : `\ndoctor: ${total} finding(s).`);
  return total === 0 ? 0 : 1;
}

/**
 * `--fix` applies only what a rule marked `fixable`, which today is one rule: a personal file
 * git can still see. It goes through the same `resolvePlan`/`commitPlan` as every other write
 * this tool makes, so the ignore file is backed up before it is touched and `personal-config
 * undo` puts it back. It returns how many findings it cleared, because the exit code has to
 * answer for what is left rather than for what was found.
 */
async function fixIfAsked(cli: Cli, root: string, findings: Finding[]): Promise<number> {
  const fixable = findings.filter((finding) => finding.fixable);
  if (!cli.fix || fixable.length === 0) return 0;

  const target = await ignoreTarget(root);
  // `--dry-run` writes nothing, whatever else is asked for. It is the guarantee that makes the
  // flag worth having, and `--fix` is not an exception to it.
  if (cli.dryRun) {
    console.log(`  would fix ${fixable.length} — ${target}, but --dry-run writes nothing`);
    return 0;
  }

  const { written } = await commitPlan(await resolvePlan([ignoreFix(root, target, fixable)]));
  if (written.length === 0) return 0;
  console.log(`  fixed ${fixable.length} — appended to ${target}`);
  return fixable.length;
}

function printReport(root: string, report: DoctorReport): void {
  console.log(`\n${root} — ${report.checked} markdown file(s) checked`);
  for (const finding of report.findings) {
    const id = finding.standardId ? ` [${finding.standardId}]` : '';
    console.log(`  ${finding.file}:${finding.line}  ${finding.rule}${id} — ${finding.message}`);
  }
}
