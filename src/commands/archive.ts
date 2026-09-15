import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { confirmWrite } from '../lib/ask.ts';
import { today } from '../lib/date.ts';
import {
  gitMove,
  isGitRepo,
  lastCommit,
  topLevel,
  trackedReferrers,
  uncommittedUnder,
} from '../lib/git.ts';
import { expandHome } from '../lib/paths.ts';
import { readArchiveHome } from '../lib/repo-config.ts';
import type { Cli, PlannedFile } from '../lib/types.ts';
import { previewTree, renderDiff, say, short } from '../lib/ui.ts';
import { commitPlan, type PlannedChange, resolvePlan } from '../lib/write-plan.ts';
import { edit } from '../render/context.ts';

const USAGE = [
  'usage: personal-config archive <slug> [--move]',
  '',
  '<slug> is a folder under `docs/incomplete/` (Profile P) or any path in the repo (Profile L).',
  'Run it before the move to see what the move costs; run it again after, to write the two index',
  'lines. `--move` does both halves in one go.',
].join('\n');

const IN_PROGRESS = join('docs', 'incomplete');

type Target = {
  path: string;
  name: string;
  /** Relative paths inside the repo that git should be asked about — plural once it has moved. */
  repoPaths: string[];
  files: string[];
};

type Plan = {
  target: Target;
  destination: string;
  archiveHome: string;
  /** True once the folder is in the archive: the phase that writes the index lines. */
  moved: boolean;
  runtimeReferrers: string[];
  proseReferrers: string[];
  uncommitted: string[];
  commit: string | null;
  topic: string;
};

/**
 * Part 7's archiving steps, as one command, in two phases.
 *
 * It does not move by default, for a reason that is structural rather than cautious: step 2
 * requires the folder to be **committed in its final state before the move**, and this tool is
 * forbidden to commit. A command that moved without that commit would silently break the step it
 * claims to automate.
 *
 * And it writes the two index lines only once the folder is actually in the archive. An index
 * line pointing at a folder that is not there is what §8.2 calls worse than no line at all — one
 * commit archived three docs while the index went on citing five as live. So: run it, move,
 * run it again. `--move` collapses the two.
 */
export async function runArchive(cli: Cli): Promise<number> {
  const slug = cli.paths[0];
  if (slug === undefined) return refuse(USAGE);

  const root = process.cwd();
  if (!(await isGitRepo(root))) return refuse(`${short(root)} is not a git repository.`);

  const plan = await prepare(root, slug);
  if (typeof plan === 'string') return refuse(plan);

  report(plan);
  return plan.moved ? afterMove(cli, root, plan) : beforeMove(cli, root, plan);
}

async function prepare(root: string, slug: string): Promise<Plan | string> {
  const home = await readArchiveHome(root);
  if (home === null) return noArchiveHome(root);

  const archiveHome = expandHome(home);
  if (!(await exists(join(archiveHome, 'INDEX.md')))) return noIndex(archiveHome);

  const inRepo = await findInRepo(root, slug);
  const name = inRepo?.name ?? slug;
  const destination = join(archiveHome, name);
  const inArchive = await exists(destination);

  if (inRepo && inArchive) return bothPlaces(inRepo.path, destination);
  if (!inRepo && !inArchive) return notFound(root, slug, archiveHome);

  const target = inRepo ?? (await archived(destination, name));
  return {
    target,
    destination,
    archiveHome,
    moved: inRepo === null,
    ...(await facts(root, target)),
  };
}

async function facts(root: string, target: Target) {
  const referrers = await trackedReferrers(root, target.name);
  const own = target.repoPaths.map((path) => `${path}/`);
  const outside = referrers.filter((line) => !own.some((path) => line.startsWith(path)));
  return {
    runtimeReferrers: outside.filter((line) => !isProse(line)),
    proseReferrers: outside.filter(isProse),
    uncommitted: await uncommitted(root, target),
    commit: await lastCommit(root, target.repoPaths),
    topic: await topicOf(target),
  };
}

/** Step 2 is about the source repo, and once the folder has left it there is nothing to check. */
async function uncommitted(root: string, target: Target): Promise<string[]> {
  const first = target.repoPaths[0];
  return first === undefined ? [] : uncommittedUnder(root, first);
}

/**
 * Part 7 splits referrers into paths *read at runtime* and *bare citations in prose*, and only
 * the first kind blocks. Markdown is the prose half; everything else — a CI command, a script, a
 * lint glob, a source file — is treated as runtime. That default is deliberately the cautious
 * direction: a prose citation wrongly called runtime costs one `--move` and a second look, while
 * a runtime path wrongly called prose is a broken build nobody sees until CI runs.
 */
function isProse(line: string): boolean {
  return /\.(md|mdx|txt)$/i.test(line.split(':')[0] ?? '');
}

/** §2.2's folder first, then the literal path: one command for Profile P and Profile L both. */
async function findInRepo(root: string, slug: string): Promise<Target | null> {
  for (const candidate of [join(root, IN_PROGRESS, slug), join(root, slug)]) {
    const info = await stat(candidate).catch(() => null);
    if (!info) continue;
    return {
      path: candidate,
      name: basenameOf(candidate),
      repoPaths: [relative(root, candidate)],
      files: info.isDirectory() ? await filesUnder(candidate) : [],
    };
  }
  return null;
}

/** The same target seen from the other side of the move: in the archive, gone from the repo. */
async function archived(destination: string, name: string): Promise<Target> {
  const info = await stat(destination).catch(() => null);
  return {
    path: destination,
    name,
    // Both places it could have lived, because git still answers for a path it no longer has.
    repoPaths: [join(IN_PROGRESS, name), name],
    files: info?.isDirectory() === true ? await filesUnder(destination) : [],
  };
}

function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

async function filesUnder(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const found: string[] = [];
  for (const entry of entries) {
    const at = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await filesUnder(join(dir, entry.name), at)));
    else found.push(at);
  }
  return found;
}

/** The index line has to say what the thing was; its own first heading is the one honest source. */
async function topicOf(target: Target): Promise<string> {
  const candidates =
    target.files.length === 0
      ? [target.path]
      : ['SCOPE.md', 'README.md', 'DESIGN.md'].map((name) => join(target.path, name));

  for (const path of candidates) {
    const text = await Bun.file(path)
      .text()
      .catch(() => '');
    const heading = text.split('\n').find((line) => line.startsWith('# '));
    if (heading) return heading.slice(2).trim();
  }
  return target.name;
}

function report(plan: Plan): void {
  const { target, destination, commit, topic, moved } = plan;
  const size = target.files.length === 0 ? 'one file' : `${target.files.length} file(s)`;
  const where = moved
    ? `already at ${short(destination)}`
    : `${short(target.path)} → ${short(destination)}`;
  say(`archive: ${where}`);
  say(
    `  ${size} · last commit ${commit ? `\`${commit}\`` : '(none — never committed)'} · "${topic}"\n`,
  );
  say(referrerReport(plan));
  if (!moved) say(commitStateReport(plan));
}

/** Part 7 step 1. */
function referrerReport(plan: Plan): string {
  const { runtimeReferrers, proseReferrers, target, moved } = plan;
  if (runtimeReferrers.length === 0 && proseReferrers.length === 0) {
    return `Referrers (step 1): no tracked file outside it cites \`${target.name}\`.`;
  }
  const prose = moved
    ? 'prose citations — each of these now points at nothing:'
    : 'prose citations — these do not block, but they will point at nothing:';
  return [
    `Referrers (step 1) — tracked files citing \`${target.name}\`:`,
    ...section('read at runtime — these block the move:', runtimeReferrers),
    ...section(prose, proseReferrers),
  ].join('\n');
}

function section(title: string, lines: string[]): string[] {
  return lines.length === 0 ? [] : [`  ${title}`, ...lines.map((line) => `    ${line}`)];
}

/**
 * Part 7 step 2, and the seam this whole command is built around: the repo has to record how the
 * work ended *before* it moves. The two blocks are printed rather than run — the commit is the
 * owner's, always.
 */
function commitStateReport(plan: Plan): string {
  if (plan.uncommitted.length === 0) {
    return '\nCommit state (step 2): clean — the repo already records how it ended.';
  }
  return [
    `\nCommit state (step 2): ${plan.uncommitted.length} uncommitted change(s) under it.`,
    'The repo must record its final state before the move. Run:',
    '',
    '```bash',
    `git add ${plan.target.repoPaths[0]}`,
    '```',
    '',
    '```bash',
    // Naming the path implies `--only`: a bare `git commit` here would sweep in whatever a
    // parallel session has staged. The repo's settled ritual, 2026-09-15 (HANDOFF 14).
    `git commit ${plan.target.repoPaths[0]} -m "close out ${plan.target.name}"`,
    '```',
  ].join('\n');
}

async function beforeMove(cli: Cli, root: string, plan: Plan): Promise<number> {
  say(`\n${moveBlock(root, plan, await sameRepo(root, plan))}`);
  const changes = await resolvePlan(await indexEdits(root, plan));
  say(`\n${preview(changes)}`);

  if (!cli.move) {
    say(
      '\nNeither line is written yet. An index line pointing at a folder that is not there is',
    );
    say('worse than no line at all (§8.2), so they are written on the run *after* the move —');
    say(`\`personal-config archive ${plan.target.name}\` again, once it has landed.`);
    return 0;
  }

  const blocker = blocking(plan);
  if (blocker !== null) return refuse(blocker);
  if (cli.dryRun) return note('\n--dry-run: nothing was moved, nothing was written.');
  if (!(await confirmWrite('Move it and write both index lines?', cli.force))) {
    return note('Nothing was moved.');
  }

  const failure = await move(root, plan);
  if (failure !== null) return refuse(failure);
  return write(root, plan, await resolvePlan(await indexEdits(root, plan)));
}

async function afterMove(cli: Cli, root: string, plan: Plan): Promise<number> {
  const changes = await resolvePlan(await indexEdits(root, plan));
  say(`\n${preview(changes)}`);

  if (cli.dryRun) return note('\n--dry-run: nothing was written.');
  if (changes.every((change) => change.before === change.after)) {
    return note('\nBoth index lines already say this. Nothing to write.');
  }
  if (!(await confirmWrite('Write the index lines?', cli.force))) {
    return note('Nothing was written.');
  }
  return write(root, plan, changes);
}

async function write(root: string, plan: Plan, changes: PlannedChange[]): Promise<number> {
  const result = await commitPlan(changes);
  say(`\nWrote ${result.written.length} file(s).`);
  if (result.manifest) say('`personal-config undo` restores the index files as they were.');
  say(await reminders(root, plan));
  return 0;
}

function preview(changes: PlannedChange[]): string {
  const real = changes.filter((change) => change.before !== change.after);
  if (real.length === 0) return 'Index lines: both already say this.';
  return [
    'The index lines (steps 4 and 5):',
    '',
    previewTree(real),
    ...real.map((change) => `\n${renderDiff(change)}`),
  ].join('\n');
}

function blocking(plan: Plan): string | null {
  if (plan.uncommitted.length > 0) {
    return '\n--move refused: commit it first (step 2 above). Moving now loses how it ended.';
  }
  if (plan.runtimeReferrers.length > 0) {
    return '\n--move refused: something reads that path at runtime (step 1 above). Repoint it first.';
  }
  return null;
}

async function move(root: string, plan: Plan): Promise<string | null> {
  await mkdir(dirname(plan.destination), { recursive: true });
  const from = plan.target.repoPaths[0] ?? plan.target.path;
  const moved = (await sameRepo(root, plan))
    ? await gitMove(root, from, relative(root, plan.destination))
    : await rename(plan.target.path, plan.destination).then(
        () => true,
        () => false,
      );
  if (!moved) return `the move failed — ${short(plan.target.path)} is still where it was.`;

  const missing = await missingAfterMove(plan);
  if (missing.length > 0) {
    return `moved, but ${missing.length} file(s) did not arrive: ${missing.slice(0, 5).join(', ')}. Nothing was indexed.`;
  }
  say(`\nMoved, and verified ${plan.target.files.length || 1} file(s) arrived (step 3).`);
  return null;
}

/** Step 3: "verify each file actually arrived before trusting the deletion". */
async function missingAfterMove(plan: Plan): Promise<string[]> {
  if (plan.target.files.length === 0) {
    return (await exists(plan.destination)) ? [] : [plan.target.name];
  }
  const arrived = new Set(await filesUnder(plan.destination));
  return plan.target.files.filter((file) => !arrived.has(file));
}

/**
 * A verified hazard, not a hypothetical: one archive home on this machine is its own git repo
 * holding several projects' archives, so `git mv` across the boundary is not a move git can make
 * and any commit block belongs to the archive, rooted there, naming its own files.
 */
async function sameRepo(root: string, plan: Plan): Promise<boolean> {
  const here = await topLevel(root);
  const there = await topLevel(await nearestExisting(plan.archiveHome));
  return here !== null && here === there;
}

async function nearestExisting(dir: string): Promise<string> {
  let current = dir;
  while (!(await exists(current)) && dirname(current) !== current) current = dirname(current);
  return current;
}

function moveBlock(root: string, plan: Plan, same: boolean): string {
  const from = plan.target.repoPaths[0] ?? plan.target.path;
  const line = same
    ? `git mv ${from} ${relative(root, plan.destination)}`
    : `mv ${short(plan.target.path)} ${short(plan.destination)}`;
  return [
    'The move (step 3) — run it yourself, or re-run this with --move:',
    '',
    '```bash',
    line,
    '```',
  ].join('\n');
}

/** Steps 6 and 7. Neither is mechanisable: both ask which of a doc's rules still govern code. */
async function reminders(root: string, plan: Plan): Promise<string> {
  const top = await topLevel(await nearestExisting(plan.archiveHome));
  const commit =
    top === null || top === (await topLevel(root))
      ? []
      : [
          '',
          'The archive is its own repository, so its commit is rooted there and names its own files:',
          '',
          '```bash',
          `git -C ${short(top)} add ${relative(top, plan.destination)}`,
          '```',
          '',
          '```bash',
          `git -C ${short(top)} commit ${relative(top, plan.destination)} -m "archive ${plan.target.name}"`,
          '```',
        ];
  return [
    ...commit,
    '',
    'Left to you, and neither is a formality:',
    `  step 6 — anything ${plan.target.name} leaves behind that still governs the code moves to`,
    '           "Standing rules that outlived their doc" (§8.3). A rule nobody can find is a',
    '           rule nobody follows.',
    '  step 7 — the memory entry (Part 10) gets its final state and what was left owed.',
    '',
    `\`personal-config doctor ${short(plan.archiveHome)}\` checks the index both ways.`,
  ].join('\n');
}

async function indexEdits(root: string, plan: Plan): Promise<PlannedFile[]> {
  return [...(await archiveIndexEdit(plan)), ...(await docsIndexEdit(root, plan))];
}

/** Step 4: topic, what it was, last commit, date verified. */
async function archiveIndexEdit(plan: Plan): Promise<PlannedFile[]> {
  const path = join(plan.archiveHome, 'INDEX.md');
  const text = await Bun.file(path).text();
  const slash = plan.target.files.length === 0 ? '' : '/';
  if (text.includes(`**${plan.target.name}${slash}**`)) return [];

  const entry = `- **${plan.target.name}${slash}** ✅ — ${plan.topic}. Closed ${today()}, last commit \`${plan.commit ?? 'none'}\`.`;
  return [edit(path, 'archive index — one line for this entry', withIndexLine(text, entry))];
}

function withIndexLine(text: string, entry: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => /^##\s+closed\b/i.test(line));
  if (start === -1) return `${text.replace(/\n+$/, '')}\n\n${entry}\n`;

  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => /^##\s/.test(line));
  const end = next === -1 ? lines.length : start + 1 + next;
  const head = lines.slice(0, end);
  while (head.length > start + 1 && (head.at(-1) ?? '').trim() === '') head.pop();
  return `${[...head, entry, ...lines.slice(end)].join('\n').replace(/\n+$/, '')}\n`;
}

/**
 * Step 5, and the narrowest edit that is still true: the index's own line for this doc gets the
 * archive location appended, in place, keeping whatever status section §8.2 filed it under. The
 * alternative — moving the line into an archived section — needs to know a shape this tool
 * cannot see, and a wrong guess rewrites someone's index.
 */
async function docsIndexEdit(root: string, plan: Plan): Promise<PlannedFile[]> {
  const path = join(root, 'docs', 'README.md');
  const text = await Bun.file(path)
    .text()
    .catch(() => null);
  if (text === null) return [];

  const updated = withDocsNote(text, plan);
  if (updated === null) return [];
  return [edit(path, 'docs index — the line for this doc, marked archived', updated)];
}

const ENTRY = /^\s*([-*]|\|)/;

function withDocsNote(text: string, plan: Plan): string | null {
  let changed = false;
  const lines = text.split('\n').map((line) => {
    if (!ENTRY.test(line) || !line.includes(plan.target.name) || /archived/i.test(line)) {
      return line;
    }
    changed = true;
    return `${line.trimEnd()} **Archived ${today()}** → \`${short(plan.destination)}\`.`;
  });
  return changed ? lines.join('\n') : null;
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

function notFound(root: string, slug: string, archiveHome: string): string {
  return [
    `Nothing to archive under \`${slug}\`. Looked for:`,
    `  ${join(IN_PROGRESS, slug)}/ — a Profile P effort's folder`,
    `  ${slug} — any path in ${short(root)}`,
    `  ${short(join(archiveHome, slug))} — already moved, waiting to be indexed`,
  ].join('\n');
}

/**
 * Both places at once is not a state to work around. A move that left a copy behind means one of
 * the two is stale and only the person knows which — and indexing either would record a claim
 * about a folder whose contents nobody has compared.
 */
function bothPlaces(inRepo: string, destination: string): string {
  return [
    'It is in both places:',
    `  ${short(inRepo)}`,
    `  ${short(destination)}`,
    'Compare them and delete one before archiving; nothing here can tell which is the real one.',
  ].join('\n');
}

function noArchiveHome(root: string): string {
  return [
    `${short(root)} has no archive home recorded in .personal-config.json.`,
    'Run `personal-config setup` in this repo and answer the archive question first —',
    'without it there is nowhere to move this to.',
  ].join('\n');
}

function noIndex(archiveHome: string): string {
  return [
    `${short(archiveHome)} has no INDEX.md.`,
    'An archive without its index is a folder of orphans (§8.2), and seeding one is',
    "`personal-config setup`'s job, not this command's.",
  ].join('\n');
}

function note(message: string): number {
  say(message);
  return 0;
}

function refuse(message: string): number {
  say(message);
  return 1;
}
