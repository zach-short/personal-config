import type { AnswerValue } from './types.ts';

/**
 * DIAL-7 — how a stored profile is read when it predates a question.
 *
 * Profiles already saved to disk, or to the short-id store the site writes to, carry none of
 * the track keys. Every one of them must keep behaving exactly as it did at 0.2.6, and the way
 * to guarantee that is to **say what each key means**, here, rather than let it fall through to
 * "whichever option is marked `recommended`". Those two agree today — DIAL-1/2/3 put the
 * behaviour-preserving option first on purpose — and that agreement is exactly the hazard: the
 * day somebody re-marks `recommended` on `work-kind`, the silent path would change what a
 * three-month-old profile means, and nothing would fail.
 *
 * Keyed by `configKey` rather than question id, because that is what an answers map is keyed by
 * and what a renderer reads.
 *
 * `proofLine` is deliberately absent. It is a `text` question, an unanswered one is the empty
 * string, and the empty string is what 0.2.6 rendered: nothing.
 */
export const STORED_PROFILE_DEFAULTS: Record<string, AnswerValue> = {
  workKind: 'code',
  configWeight: 'full',
  usesGit: 'yes',
  outputStyle: 'check-first',
};

/** The explicit reading of a key, or `null` where the question has none and the options decide. */
export function storedProfileDefault(configKey: string): AnswerValue | null {
  return STORED_PROFILE_DEFAULTS[configKey] ?? null;
}
