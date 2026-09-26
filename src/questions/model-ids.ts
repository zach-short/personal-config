/**
 * Popular model IDs for the tier ceiling feature. Organized by recommendation: family names first
 * (survive new releases), then exact versions, then "Other — type it".
 *
 * This list goes stale several times a year as new models release. Update it when Claude Code
 * releases new model versions; keep it curated, not exhaustive. The "Other" option always lets
 * someone type an arbitrary ID.
 */

export const POPULAR_MODEL_IDS = [
  { value: 'opus', label: 'claude-opus (latest)', example: 'Opus family, any version' },
  {
    value: 'sonnet',
    label: 'claude-sonnet (latest)',
    example: 'Sonnet family, any version',
  },
  {
    value: 'haiku',
    label: 'claude-haiku (latest)',
    example: 'Haiku family, any version',
  },
  { value: 'fable', label: 'claude-fable (latest)', example: 'Fable family, any version' },
  {
    value: 'claude-opus-5-5',
    label: 'claude-opus-5-5 (specific)',
    example: 'Exactly Opus 5.5, nothing else',
  },
  {
    value: 'claude-sonnet-5',
    label: 'claude-sonnet-5 (specific)',
    example: 'Exactly Sonnet 5, nothing else',
  },
  {
    value: 'claude-haiku-4-5',
    label: 'claude-haiku-4-5 (specific)',
    example: 'Exactly Haiku 4.5, nothing else',
  },
  {
    value: 'claude-fable-5-1',
    label: 'claude-fable-5-1 (specific)',
    example: 'Exactly Fable 5.1, nothing else',
  },
];
