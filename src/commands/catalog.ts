import { buildCatalog, catalogPath, serializeCatalog } from '../lib/catalog.ts';
import { writeText } from '../lib/disk.ts';
import { say, short } from '../lib/ui.ts';

/**
 * Writes `catalog.json`. Unlike `setup`, this one writes outside the plan/preview/undo path on
 * purpose: the target is a tracked file in this repo, so git is already the preview and the undo.
 */
export async function runCatalog(): Promise<number> {
  const catalog = await buildCatalog();
  const path = catalogPath();
  await writeText(path, serializeCatalog(catalog));

  const counts = countByPhase(catalog);
  say(`Wrote ${short(path)} — ${catalog.catalogVersion}`);
  say(
    `  ${catalog.questions.length} question(s) ${counts}, ${catalog.choices.length} long form(s)`,
  );
  return 0;
}

function countByPhase(catalog: { questions: { phase: string }[] }): string {
  const counts = new Map<string, number>();
  for (const question of catalog.questions) {
    counts.set(question.phase, (counts.get(question.phase) ?? 0) + 1);
  }
  return `(${[...counts].map(([phase, n]) => `${phase} ${n}`).join(', ')})`;
}
