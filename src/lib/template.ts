import { join } from 'node:path';
import { repoRoot } from './paths.ts';

/**
 * `{{TOKEN}}` substitution and nothing else. The standard's own test for "adapted" is that no
 * `{{` survives outside Appendix A, so leaving an unknown token in place — rather than
 * silently emptying it — is what lets `doctor` catch a renderer that forgot a variable.
 */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replaceAll(/\{\{(\w+)\}\}/g, (whole, key: string) => vars[key] ?? whole);
}

export async function template(name: string): Promise<string> {
  const file = Bun.file(join(repoRoot(), 'templates', name));
  if (!(await file.exists())) throw new Error(`Missing template: templates/${name}`);
  return file.text();
}

export async function filledTemplate(
  name: string,
  vars: Record<string, string>,
): Promise<string> {
  return fill(await template(name), vars);
}

export function leftoverTokens(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1] as string))];
}
