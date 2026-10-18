import { basename, join } from 'node:path';
import { exists, readText } from '../../lib/disk.ts';
import { documentRoot } from '../../lib/git.ts';
import { contractHome, home } from '../../lib/paths.ts';
import type { Answers, Finding } from '../../lib/types.ts';

/**
 * A profile that sets `landStep: "wk"` renders a `/delegate` that lands through wk's queue (board
 * row 132), and that step does nothing unless wk's config for the repository turns landing on and
 * names a gate: without `landing.enabled` the submit is refused, and without a `[[gates.run]]`
 * the worker never moves `main`. So the config is checked here, where the step is rendered, and
 * not at the first landing that waits forever.
 *
 * wk names the file after the primary checkout's folder, so from a worktree the folder is read
 * off `documentRoot`, not off the worktree's own name.
 */
export async function wkConfig(root: string, answers: Answers): Promise<Finding[]> {
  if (answers.landStep !== 'wk') return [];
  const file = await wkConfigFile(root);
  if (!(await exists(file))) {
    return [finding(file, `landStep is "wk" but ${contractHome(file)} does not exist`)];
  }
  const shape = readShape(await readText(file));
  const missing = [
    ...(shape.landing ? [] : ['[landing] enabled = true']),
    ...(shape.gates ? [] : ['a [[gates.run]] entry']),
  ];
  return missing.length === 0
    ? []
    : [
        finding(
          file,
          `landStep is "wk" but ${contractHome(file)} lacks ${missing.join(' and ')}`,
        ),
      ];
}

/** wk's config for the repository `root` belongs to, which `gate-agree` reads as well. */
export async function wkConfigFile(root: string): Promise<string> {
  return join(home(), '.wk', `${basename(await documentRoot(root))}.toml`);
}

/**
 * Only the two facts the rule needs, read line by line: the table each line sits in, and the
 * `enabled` key under `[landing]`. A full TOML parser would be a dependency for two booleans.
 */
function readShape(text: string): { landing: boolean; gates: boolean } {
  let table = '';
  let landing = false;
  let gates = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const header = /^\[\[?\s*([^\]]+?)\s*\]\]?$/.exec(line);
    if (header) {
      table = header[1] ?? '';
      if (line.startsWith('[[') && table === 'gates.run') gates = true;
      continue;
    }
    if (table === 'landing' && /^enabled\s*=\s*true$/.test(line)) landing = true;
  }
  return { landing, gates };
}

function finding(file: string, message: string): Finding {
  return { rule: 'wk-config', standardId: null, file, line: 1, message, fixable: false };
}
