import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ALL_QUESTIONS, readMoreIds } from '../questions/index.ts';
import { exists, readText } from './disk.ts';
import { repoRoot } from './paths.ts';
import type { Catalog, CatalogChoice, Question } from './types.ts';
import { version } from './version.ts';

/**
 * The browser cannot import `src/phases/run.ts` — line 1 pulls in clack — and cannot read the
 * 28 markdown long forms off a disk it does not have. So the wizard emits both, once, as a
 * committed artifact the site pins (D6). This module builds it; `commands/catalog.ts` writes it.
 */
export async function buildCatalog(): Promise<Catalog> {
  const questions = ALL_QUESTIONS.map(catalogQuestion);
  const choices = await readChoices();
  return { catalogVersion: await catalogVersion(questions, choices), questions, choices };
}

/** The file the site pins, and the file the freshness test compares a fresh build against. */
export function catalogPath(): string {
  return join(repoRoot(), 'catalog.json');
}

/** Trailing newline included: this is a committed file, and a diff should not fight over it. */
export function serializeCatalog(catalog: Catalog): string {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

/**
 * Every field a caller needs to *ask* the question, and nothing about rendering it. `when`
 * survives because it is already data (`WhenSpec`); a predicate could not have made this trip.
 */
function catalogQuestion(question: Question): Question {
  return {
    id: question.id,
    phase: question.phase,
    kind: question.kind,
    ask: question.ask,
    ...(question.options ? { options: question.options } : {}),
    ...(question.placeholder ? { placeholder: question.placeholder } : {}),
    readMore: question.readMore,
    configKey: question.configKey,
    ...(question.when ? { when: question.when } : {}),
  };
}

/** Keyed by `readMore`, because that is the only name a question knows its long form by. */
async function readChoices(): Promise<CatalogChoice[]> {
  const ids = [...readMoreIds()].sort();
  return Promise.all(ids.map(readChoice));
}

async function readChoice(id: string): Promise<CatalogChoice> {
  const path = join(repoRoot(), 'docs', 'choices', `${id}.md`);
  if (!(await exists(path))) throw new Error(`No long form for "${id}" — expected ${path}`);
  return { id, body: await readText(path) };
}

/**
 * `<pkg version>+<sha256[:8]>` of the content. The hash is what makes a bump meaningful: the
 * site can tell an edited question from a released version that happened to move.
 */
async function catalogVersion(
  questions: Question[],
  choices: CatalogChoice[],
): Promise<string> {
  const stable = JSON.stringify({ questions, choices });
  const digest = createHash('sha256').update(stable).digest('hex');
  return `${await version()}+${digest.slice(0, 8)}`;
}
