import { join } from 'node:path';
import type { ConventionRule, PlannedFile } from '../lib/types.ts';
import { PRACTICE_AREAS } from '../questions/index.ts';
import { answer, conventionsPath, planned, type RenderContext } from './context.ts';

const LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  go: 'Go',
  swift: 'Swift',
  python: 'Python',
  rust: 'Rust',
};

const TOOLING_NOTE: Record<string, string> = {
  typescript:
    'Where the formatter or linter settles something — quotes, semicolons, import order — the config is the rule and this file says nothing.',
  go: 'gofmt settles formatting entirely, and golangci-lint settles much of the rest. Neither is restated here.',
  python:
    'Formatting and import order are the formatter’s (ruff or black). This file does not restate them.',
  swift:
    'Xcode’s formatter and the compiler’s warnings settle formatting; this file does not restate them.',
  rust: 'rustfmt and clippy settle formatting and the common lints; this file does not restate them.',
};

/** One file per language, and the file extension decides which applies (standard §8.1). */
export function renderConventions(ctx: RenderContext, languages: string[]): PlannedFile[] {
  const root = ctx.repo?.scan.path;
  if (!root) return [];

  return languages
    .map((language) => {
      const rules = rulesFor(ctx, language);
      if (rules.length === 0) return null;
      return planned(
        ctx,
        join(root, conventionsPath(language)),
        `code standard — ${LANGUAGE_LABELS[language] ?? language}`,
        document(language, rules, languages),
      );
    })
    .filter((f): f is PlannedFile => f !== null);
}

function rulesFor(ctx: RenderContext, language: string): ConventionRule[] {
  return PRACTICE_AREAS.filter((area) => area.target === 'conventions')
    .filter((area) => area.languages.length === 0 || area.languages.includes(language))
    .map((area) => area.rule(answer(ctx, area.question.configKey, 'none'), language))
    .filter((rule): rule is ConventionRule => rule !== null);
}

function document(language: string, rules: ConventionRule[], all: string[]): string {
  const label = LANGUAGE_LABELS[language] ?? language;
  const siblings = all.filter((l) => l !== language);
  const crossRef =
    siblings.length > 0
      ? ` Other languages here have their own file — ${siblings
          .map((l) => `\`docs/conventions-${l}.md\``)
          .join(
            ', ',
          )} — and **the file extension decides which applies**. Where two of them contradict each other, it is on purpose and both say so.`
      : '';

  return [
    `# ${label} conventions`,
    '',
    `The standard for ${label} in this repo. **Self-contained** — apply it without reading`,
    `anything else.${crossRef}`,
    '',
    `Every rule has an ID, and IDs are never renumbered — they are how commit messages, other`,
    `docs and lint justifications cite a rule. Every rule carries an enforcement tag: *lint* (a`,
    `linter catches it) · *gate* (a repo checker catches it) · *CI* (a job catches it) · *review*`,
    `(nothing catches it — it rots without discipline). The tag tells you whether a clean run`,
    `means anything.`,
    '',
    `Provenance labels mark which rules are choices: *[STANDARD]* canonical for the ecosystem ·`,
    `*[COMMON]* widespread, alternatives exist · *[OURS]* a house preference, justified on its`,
    `own terms. This is what stops a later agent "correcting" a deliberate call.`,
    '',
    TOOLING_NOTE[language] ??
      'Where a formatter or linter settles something, the config is the rule.',
    '',
    '> **Seeded by `personal-config` from your answers.** Every correct/incorrect pair below is',
    '> illustrative until someone replaces it with real code from this repo — the standard asks',
    '> for real pairs, and a seeded one is a placeholder that happens to compile.',
    '',
    ...rules.flatMap(renderRule),
  ].join('\n');
}

function renderRule(rule: ConventionRule): string[] {
  return [
    `## ${rule.id} — ${rule.title}`,
    '',
    `*${rule.enforcement}* · **[${rule.provenance}]**`,
    '',
    rule.body,
    '',
    '```',
    `// right: ${rule.correct}`,
    `// wrong: ${rule.incorrect}`,
    '```',
    '',
  ];
}
