import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { configHash, loadConfig } from '../lib/config.ts';
import { expandHome } from '../lib/paths.ts';
import type { Cli, Finding } from '../lib/types.ts';
import { standardVersion } from '../render/standard.ts';
import { archiveIndex } from './rules/archive-index.ts';
import { archivedCitations } from './rules/archived-citations.ts';
import { boardStatus } from './rules/board-status.ts';
import { ignoredFiles } from './rules/ignored.ts';
import { placeholders } from './rules/placeholders.ts';
import { relativeDates } from './rules/relative-dates.ts';
import { stampDrift } from './rules/stamp-drift.ts';
import { stepNumbers } from './rules/step-numbers.ts';
import { collectDocs, type Doc } from './scan.ts';

const DOC_RULES = [relativeDates, placeholders, stepNumbers, boardStatus];

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
  const configured = await Bun.file(join(root, '.personal-config.json')).exists();
  const fromStamps = configured ? docs.flatMap((doc) => stampDrift(doc, expectation)) : [];
  const fromCitations = archivedCitations(docs, await archivedNames(docs));
  const fromIgnore = configured ? await ignoredFiles(root) : [];

  return {
    findings: sort([
      ...fromDocs,
      ...fromArchive,
      ...fromStamps,
      ...fromCitations,
      ...fromIgnore,
    ]),
    checked: docs.length,
  };
}

type Expectation = { configHash: string; standardVersion: string };

/** Folder names sitting in an archive index's directory — what "now lives in the archive" means. */
async function archivedNames(docs: Doc[]): Promise<string[]> {
  const indexes = docs.filter((d) => d.kind === 'archive-index');
  const names = await Promise.all(
    indexes.map(async (doc) => {
      const dir = doc.path.slice(0, doc.path.lastIndexOf('/'));
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    }),
  );
  return names.flat();
}

function sort(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

export async function runDoctor(cli: Cli): Promise<number> {
  const roots = cli.paths.length > 0 ? cli.paths.map(expandHome) : [process.cwd()];
  const config = await loadConfig(cli, roots[0] ?? null);
  const expectation: Expectation = {
    configHash: await configHash(config),
    standardVersion: await standardVersion(),
  };

  let total = 0;
  for (const root of roots) {
    const report = await runDoctorOn(root, expectation);
    printReport(root, report);
    total += report.findings.length;
  }

  console.log(total === 0 ? '\ndoctor: no findings.' : `\ndoctor: ${total} finding(s).`);
  return total === 0 ? 0 : 1;
}

function printReport(root: string, report: DoctorReport): void {
  console.log(`\n${root} — ${report.checked} markdown file(s) checked`);
  for (const finding of report.findings) {
    const id = finding.standardId ? ` [${finding.standardId}]` : '';
    console.log(`  ${finding.file}:${finding.line}  ${finding.rule}${id} — ${finding.message}`);
  }
}
