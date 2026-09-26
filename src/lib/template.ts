import { join } from 'node:path';
import { exists, readText } from './disk.ts';
import { repoRoot } from './paths.ts';

/**
 * `{{TOKEN}}` substitution and nothing else. The standard's own test for "adapted" is that no
 * `{{` survives outside Appendix A, so leaving an unknown token in place — rather than
 * silently emptying it — is what lets `doctor` catch a renderer that forgot a variable.
 *
 * A `null` value is a section that is absent, as distinct from `''`, a section that is empty: a
 * token alone on its line is removed together with that line, so an optional section that is
 * not written leaves no blank line behind. Anywhere else a `null` token empties like `''`.
 */
export function fill(text: string, vars: Record<string, string | null>): string {
  return text
    .replaceAll(/^\{\{(\w+)\}\}\n/gm, (whole, key: string) => (vars[key] === null ? '' : whole))
    .replaceAll(/\{\{(\w+)\}\}/g, (whole, key: string) => {
      const value = vars[key];
      return value === undefined ? whole : (value ?? '');
    });
}

export async function template(name: string): Promise<string> {
  const path = join(repoRoot(), 'templates', name);
  if (!(await exists(path))) throw new Error(`Missing template: templates/${name}`);
  return readText(path);
}

export async function filledTemplate(
  name: string,
  vars: Record<string, string | null>,
): Promise<string> {
  return fill(await template(name), vars);
}

export function leftoverTokens(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1] as string))];
}
