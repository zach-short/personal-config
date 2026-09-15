import { basename } from 'node:path';
import type { Finding } from '../../lib/types.ts';
import { type Doc, proseLines } from '../scan.ts';

/**
 * A path that now lives in the archive, still cited in-tree as if it were live. Only bare
 * prose citations are reported: a path read at runtime by a script or a CI command is a
 * different, louder failure, and one this rule cannot tell apart from prose anyway.
 */
export function archivedCitations(docs: Doc[], archivedNames: string[]): Finding[] {
  if (archivedNames.length === 0) return [];
  const names = new Set(archivedNames.map((n) => basename(n)));

  return docs
    .filter((doc) => !doc.path.includes('/archive/'))
    .flatMap((doc) =>
      proseLines(doc)
        .filter(({ text }) => [...names].some((name) => text.includes(name)))
        .map(({ text, line }) => ({
          rule: 'archived-citations',
          standardId: '§7',
          file: doc.path,
          line,
          message: `cites \`${[...names].find((n) => text.includes(n))}\`, which now lives in the archive`,
          fixable: false,
        })),
    );
}
