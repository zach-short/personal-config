import { slugOf } from './profiles.ts';
import type { Answers } from './types.ts';

/**
 * The starting points `profile new` offers, each a name the person may keep or change. A preset
 * only fills the defaults: every question is still asked, so a preset is never a hidden answer.
 * Every value is one of its question's options, which `tests/profiles.test.ts` checks.
 */
export type Preset = { id: string; name: string; description: string; answers: Answers };

const LOOSE_PRACTICES: Answers = {
  'practices.comments': 'why-only',
  'practices.function-length': 'typical-20-ceiling-40',
  'practices.exports': 'default-allowed',
  'practices.file-naming': 'ecosystem-default',
  'practices.imports': 'grouped-only',
  'practices.types': 'strict-with-escapes',
  'practices.logic-placement': 'colocate',
  'practices.data-layer': 'library-default',
  'practices.states': 'per-screen',
  'practices.design-tokens': 'tokens-with-escape',
  'practices.test-policy': 'colocated',
  'practices.copy-registers': 'agent-picks',
  'practices.drive-by-fixes': 'trivial-allowed',
};

const STRICT_PRACTICES: Answers = {
  'practices.comments': 'why-only',
  'practices.function-length': 'house-6-15',
  'practices.exports': 'named-only',
  'practices.file-naming': 'ecosystem-default',
  'practices.imports': 'no-parent-relative',
  'practices.types': 'strict',
  'practices.logic-placement': 'extract-by-concept',
  'practices.data-layer': 'one-client',
  'practices.states': 'all-three',
  'practices.design-tokens': 'tokens-only',
  'practices.test-policy': 'new-file-per-feature',
  'practices.copy-registers': 'ask-three-registers',
  'practices.drive-by-fixes': 'note-and-raise',
};

const NO_PRACTICES: Answers = Object.fromEntries(
  Object.keys(STRICT_PRACTICES).map((key) => [key, 'none']),
);

export const PRESETS: Preset[] = [
  {
    id: 'light',
    name: 'Light setup',
    description:
      'The lighter method and no house rules. For scripts, experiments, small repos.',
    answers: { workKind: 'code', configWeight: 'light', usesGit: 'yes', ...NO_PRACTICES },
  },
  {
    id: 'medium',
    name: 'Medium setup',
    description: 'The whole method with plain folders for the record, and looser house rules.',
    answers: {
      workKind: 'code',
      configWeight: 'full',
      usesGit: 'yes',
      workProfile: 'folders',
      mode: 'solo',
      ...LOOSE_PRACTICES,
    },
  },
  {
    id: 'heavy',
    name: 'Heavy setup',
    description: 'The whole method: a ledger, a board, and every house rule at its strictest.',
    answers: {
      workKind: 'code',
      configWeight: 'full',
      usesGit: 'yes',
      workProfile: 'ledger',
      mode: 'solo',
      ...STRICT_PRACTICES,
    },
  },
  {
    id: 'writing',
    name: 'Writing setup',
    description: 'For folders of documents, not code: the lighter method and no code rules.',
    answers: { workKind: 'non-code', configWeight: 'light', usesGit: 'no' },
  },
];

export function findPreset(id: string): Preset | null {
  return PRESETS.find((preset) => preset.id === id) ?? null;
}

/** The preset's own name, or that name with the first free number after it. */
export function suggestedName(preset: Preset, takenSlugs: string[]): string {
  if (!takenSlugs.includes(slugOf(preset.name))) return preset.name;
  for (let n = 2; ; n++) {
    const name = `${preset.name} ${n}`;
    if (!takenSlugs.includes(slugOf(name))) return name;
  }
}
