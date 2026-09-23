/**
 * The one version ordering in `src/` (upgrade-command `DESIGN.md` D4). It used to be private to
 * the drift rule; `upgrade` needs the same ordering to decide which changelog entries lie between
 * two versions, and "is 1.10.0 older than 1.9.0" is exactly the question that gets answered
 * differently the day a second copy is written — a string compare says yes.
 *
 * Numeric, part by part, with a missing part read as zero, so a hand-typed `1.0` orders beside
 * `1.0.0` (H6: a version in a stamp is not proof the tool wrote it). No pre-release or build
 * suffix: neither version line has ever carried one, and a parser that accepted `1.2.0-rc.1`
 * would have to decide how it orders, which is a decision nobody has taken.
 */

type Parts = [number, number, number];

/** Null for anything that is not one to three dot-separated whole numbers — `unknown` included. */
export function parseVersion(text: string): Parts | null {
  const match = text.trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

/**
 * Negative when `a` is older, positive when newer, zero when equal — or null where either side
 * cannot be read, because "not comparable" and "equal" call for different sentences and a
 * caller that got 0 for both could not tell them apart.
 */
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (left === null || right === null) return null;
  for (let i = 0; i < 3; i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Strictly older. False where either side cannot be read — a stamp naming nothing is not behind. */
export function isOlder(a: string, b: string): boolean {
  const order = compareVersions(a, b);
  return order !== null && order < 0;
}

/**
 * The versions after `from` up to and including `to`, newest first (DIAL-4): what a copy at
 * `from` has not seen once `to` is installed. Unreadable versions are dropped rather than
 * guessed into place.
 */
export function versionsBetween(versions: string[], from: string, to: string): string[] {
  return versions
    .filter((v) => isOlder(from, v) && !isOlder(to, v))
    .sort((a, b) => compareVersions(b, a) ?? 0);
}
