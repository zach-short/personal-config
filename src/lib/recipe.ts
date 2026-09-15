/**
 * The fresh-checkout recipe, pulled out of a repo's adapted standard.
 *
 * Part 6 leaves `{{WORKTREE_SETUP}}` for Part 0 to fill, so a *filled* recipe only ever exists
 * in an adapted copy — never in the shipped `standard/`. Three heading spellings are in the
 * wild, so the match is on the prefix all of them share rather than on a whole heading.
 */
const HEADING = '## The fresh-checkout recipe';

/** The placeholder Part 0 owns. A recipe that still contains it was never filled in. */
export const UNFILLED = '{{WORKTREE_SETUP}}';

/**
 * Every fenced block under that heading, in order — not just the first. An adapted copy is free
 * to split its recipe across blocks, and one verified copy does: install in the first, the
 * gitignored files to copy in in the second. Taking only the first silently drops the half that
 * actually bites, which is the failure this whole command exists to prevent.
 */
export function recipeBlocks(markdown: string): string[] {
  const body = sectionBody(markdown);
  if (body === null) return [];
  const fences = [...body.matchAll(/```[a-z]*\n([\s\S]*?)```/g)];
  return fences.map((match) => (match[1] ?? '').trim()).filter((block) => block !== '');
}

/** The heading's text down to the next `## `, or null when the section is absent entirely. */
function sectionBody(markdown: string): string | null {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith(HEADING));
  if (start === -1) return null;

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/**
 * Both verified recipes open with a literal `cd <worktree>`, which stands in for wherever the
 * worktree actually landed. Substituting it is the difference between a block you can run and
 * a block you have to edit first.
 */
export function fillWorktree(block: string, path: string): string {
  return block.replaceAll('<worktree>', path);
}
