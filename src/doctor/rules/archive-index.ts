import { readdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Finding } from '../../lib/types.ts';
import { type Doc, proseLines } from '../scan.ts';

/**
 * Both directions. A folder with no index line is invisible; an index line pointing at a
 * folder that is not there is worse than none — one commit archived three docs while the
 * index went on citing five as live.
 */
export const archiveIndex = {
  id: 'archive-index',
  standardId: '§8.2',
  appliesTo: (doc: Doc) => doc.kind === 'archive-index',
  async check(doc: Doc): Promise<Finding[]> {
    const root = dirname(doc.path);
    const onDisk = await folders(root);
    const cited = citedFolders(doc);

    return [
      ...[...cited]
        .filter(([name]) => !onDisk.has(name))
        .map(([name, line]) =>
          finding(doc, line, `index cites \`${name}/\`, which is not in ${root}`),
        ),
      ...[...onDisk]
        .filter((name) => !cited.has(name))
        .map((name) => finding(doc, 1, `\`${name}/\` exists but has no line in this index`)),
    ];
  },
};

async function folders(root: string): Promise<Set<string>> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  return new Set(
    entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name),
  );
}

/** `- **<slug>/** …` is the index's own entry shape. */
function citedFolders(doc: Doc): Map<string, number> {
  const found = new Map<string, number>();
  for (const { text, line } of proseLines(doc)) {
    const match = text.match(/^\s*[-*]\s+\*\*([^*/]+)\/\*\*/);
    const name = match?.[1];
    if (name && !found.has(name)) found.set(name, line);
  }
  return found;
}

function finding(doc: Doc, line: number, message: string): Finding {
  return {
    rule: 'archive-index',
    standardId: '§8.2',
    file: doc.path,
    line,
    message,
    fixable: false,
  };
}
