import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.ts';
import { today } from '../lib/date.ts';
import { exists, readText } from '../lib/disk.ts';
import { isGitRepo } from '../lib/git.ts';
import { expandHome } from '../lib/paths.ts';
import type { Cli, Config, Finding, PlannedFile } from '../lib/types.ts';
import { version } from '../lib/version.ts';
import { commitPlan, resolvePlan } from '../lib/write-plan.ts';
import { standardVersion } from '../render/standard.ts';
import { type Rerender, rerender } from './rerender.ts';
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
import { adaptationFix, unstampedAdaptation } from './rules/unstamped-adaptation.ts';
import { collectDocs, type Doc } from './scan.ts';

const DOC_RULES = [
  relativeDates,
  absenceEvidence,
  placeholders,
  stepNumbers,
  boardStatus,
  unfolded,
  unstampedAdaptation,
];

export type DoctorReport = { findings: Finding[]; checked: number };

/**
 * What every stamped file is judged against: the installed standard's version, and the config
 * `doctor` loaded for this root, which is what a re-render draws its answers from
 * (stamp-provenance `DESIGN.md` D2). Until 2026-09-23 this was `{configHash, standardVersion}`
 * and the rule compared the hash — so a hash that moved on a package default the repo never
 * saved was drift the owner did not cause (G12, G13), and an answer that moved a byte without
 * moving the hash was not (G17). Handing the config over instead lets the rule ask the literal
 * question: would `setup` write this file differently now?
 */
export type DoctorExpectation = { standardVersion: string; config: Config };

/** Every rule reports `file:line`; any finding that is not advisory is a non-zero exit. */
export async function runDoctorOn(
  root: string,
  expectation: DoctorExpectation,
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

  // Ignore coverage is only meaningful in a repo this tool actually configured, and so is a
  // re-render: without a `.personal-config.json` there is no recorded shape to render from, and
  // a `PART0-PROMPT.md` sitting in, say, a docs folder is not a personal file at all.
  const configured = await exists(join(root, '.personal-config.json'));
  const fromStamps = await stampFindings(root, docs, expectation, configured);
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

/**
 * Drift, decided by re-rendering (D2). The plan is rebuilt only where the repo is configured —
 * that is where the recorded shape and the saved answers are — but the rule runs over every
 * doc regardless, because an adapted file's standard lag (D4) needs no config to be reported:
 * its owner put the marker there, or asked `doctor --fix` to. The rule itself keeps a plain
 * stamp quiet in an unconfigured tree; the gate that used to sit here did the same for less.
 */
async function stampFindings(
  root: string,
  docs: Doc[],
  expectation: DoctorExpectation,
  configured: boolean,
): Promise<Finding[]> {
  const render: Rerender = configured
    ? await rerender(root, expectation.config, docs)
    : () => null;
  return docs.flatMap((doc) =>
    stampDrift(doc, {
      standardVersion: expectation.standardVersion,
      rendered: render(doc),
      configured,
    }),
  );
}

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

  let failing = 0;
  let advisory = 0;
  for (const root of roots) {
    // Per root, not once for the run. `setup` saves its answers into each repo's
    // `.personal-config.json`, so what a re-render draws on is a property of the repo being
    // checked — loading it once from `roots[0]` would judge every later repo against the first
    // one's answers. Harmless while no answers were saved; a false drift finding the moment
    // they are.
    const config = await loadConfig(cli, root);
    const report = await runDoctorOn(root, { standardVersion: standard, config });
    printReport(root, report);
    const fixed = await fixIfAsked(cli, root, report.findings);
    failing += report.findings.filter((f) => !f.advisory).length - fixed;
    advisory += report.findings.filter((f) => f.advisory).length;
  }

  console.log(`\n${summary(failing, advisory)}`);
  return failing === 0 ? 0 : 1;
}

/**
 * The exit code answers for what fails, and an advisory finding does not (stamp-provenance
 * `DESIGN.md` D4): a stale standard behind an adapted file is work to schedule, not a defect in
 * the repo, and a `doctor` that is red for an upgrade you have not done yet is a `doctor` people
 * stop running — and one that goes red in CI once per standard release for something nobody
 * caused. It is still counted and still printed, so the summary cannot read "no findings" over
 * a report that has some.
 */
function summary(failing: number, advisory: number): string {
  const tail = advisory > 0 ? `, ${advisory} advisory` : '';
  if (failing === 0 && advisory === 0) return 'doctor: no findings.';
  if (failing === 0) return `doctor: nothing failing; ${advisory} advisory finding(s).`;
  return `doctor: ${failing} finding(s)${tail}.`;
}

type Fix = { file: PlannedFile; clears: Finding[] };

/**
 * `--fix` applies only what a rule marked `fixable`, which as of 2026-09-23 is two rules: a
 * personal file git can still see gets an anchored ignore line, and a Part 0 adaptation that
 * carries no stamp gets an adapted one (D3). Both go through the same `resolvePlan`/`commitPlan`
 * as every other write this tool makes, so the file is backed up before it is touched and
 * `personal-config undo` puts it back. It returns how many findings it cleared, because the exit
 * code has to answer for what is left rather than for what was found.
 */
async function fixIfAsked(cli: Cli, root: string, findings: Finding[]): Promise<number> {
  const fixable = findings.filter((finding) => finding.fixable);
  if (!cli.fix || fixable.length === 0) return 0;

  const fixes = await fixPlan(root, fixable);
  const described = fixes.map(describeFix).join(', ');
  // `--dry-run` writes nothing, whatever else is asked for. It is the guarantee that makes the
  // flag worth having, and `--fix` is not an exception to it.
  if (cli.dryRun) {
    console.log(`  would fix ${fixable.length} — ${described}, but --dry-run writes nothing`);
    return 0;
  }

  const { written } = await commitPlan(await resolvePlan(fixes.map((fix) => fix.file)));
  const cleared = fixes
    .filter((fix) => written.includes(fix.file.path))
    .reduce((count, fix) => count + fix.clears.length, 0);
  if (cleared === 0) return 0;
  console.log(`  fixed ${cleared} — ${described}`);
  return cleared;
}

/**
 * One planned file per fix, with the findings it clears: every ignore finding lands in the one
 * ignore file, and every unstamped adaptation is its own file. The adapted stamp is dated and
 * versioned by *this* run, because this run is what writes it — the header's own date is the
 * adaptation's, and the stamp's date field has always meant when the line was written.
 */
async function fixPlan(root: string, fixable: Finding[]): Promise<Fix[]> {
  const ignored = fixable.filter((f) => f.rule === 'ignored');
  const adapted = fixable.filter((f) => f.rule === unstampedAdaptation.id);
  const fixes: Fix[] = [];
  if (ignored.length > 0) {
    fixes.push({ file: ignoreFix(root, await ignoreTarget(root), ignored), clears: ignored });
  }
  const at = { version: await version(), date: today() };
  for (const finding of adapted) {
    const file = adaptationFix(finding.file, await readText(finding.file), at);
    fixes.push({ file, clears: [finding] });
  }
  return fixes;
}

function describeFix(fix: Fix): string {
  const what = fix.file.strategy === 'mark-adapted' ? 'adapted stamp' : 'ignore lines';
  return `${fix.file.path} (${what})`;
}

function printReport(root: string, report: DoctorReport): void {
  console.log(`\n${root} — ${report.checked} markdown file(s) checked`);
  for (const finding of report.findings) {
    const id = finding.standardId ? ` [${finding.standardId}]` : '';
    const tag = finding.advisory ? ' (advisory)' : '';
    console.log(
      `  ${finding.file}:${finding.line}  ${finding.rule}${id} — ${finding.message}${tag}`,
    );
  }
}
