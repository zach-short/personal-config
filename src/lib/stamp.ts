/**
 * Every generated file carries one stamp line. It carries two claims that used to be one
 * (stamp-provenance `DESIGN.md` G1): that this tool may overwrite the file, and where the file
 * came from — the CLI version, the date, a hash of the answers, the standard's version. The
 * `adapted` marker is what splits them: a file marked adapted keeps its provenance and withdraws
 * the permission, so `doctor` can still say which standard it came from while no re-run touches
 * it (D1).
 */

export type StampParts = {
  version: string;
  date: string;
  configHash: string;
  standardVersion: string;
  /**
   * Whether the file is the repo's own — rewritten by a Part 0 session, or claimed by its owner
   * — rather than this tool's to replace. Required rather than optional for the reason
   * `ModelTiers.light` is: the one silent failure this field can have is a writer leaving it out
   * and a reader taking absence for `false`, and a required field makes both a type error. Every
   * renderer writes `false`; only `doctor --fix` and a person's editor write `true`.
   */
  adapted: boolean;
};

/**
 * One trailing word, after every field the readers below already parse. Appending is what keeps
 * `blankStampDate` in step without a change (H4), and what makes an old CLI fail safe: the
 * pattern 0.5.0 shipped rejects a line with anything after the standard version (G8), so a
 * cached older copy sees no stamp on an adapted file and leaves it alone rather than parsing the
 * provenance and overwriting the one file it must not touch (D1's defense; A-3 lost on this).
 */
const ADAPTED_MARKER = ' · adapted';

type CommentStyle = { open: string; close: string };

const STYLES: Record<string, CommentStyle> = {
  md: { open: '<!--', close: '-->' },
  json: { open: '//', close: '' },
  ts: { open: '//', close: '' },
  sh: { open: '#', close: '' },
  yml: { open: '#', close: '' },
};

export function stampLine(parts: StampParts, extension = 'md'): string {
  const style = STYLES[extension] ?? STYLES.md;
  const body = `personal-config v${parts.version} · ${parts.date} · config ${parts.configHash} · standard v${parts.standardVersion}${parts.adapted ? ADAPTED_MARKER : ''}`;
  if (!style) return body;
  return style.close ? `${style.open} ${body} ${style.close}` : `${style.open} ${body}`;
}

export function withStamp(contents: string, parts: StampParts, extension = 'md'): string {
  return stampAfterShebang(contents, stampLine(parts, extension));
}

/**
 * A `#!` line is only a shebang on line 1 — the kernel reads the first two bytes of the file and
 * nowhere else — so a stamp prepended above one does not push the interpreter down, it deletes
 * it. Every hook script this tool wrote was in that state until 2026-09-18.
 *
 * **Do not "correct" this back after observing that the hooks work.** On a Mac they do, and the
 * reason is a fallback, not a shebang. Three things measured 2026-09-18, on this machine:
 *
 * - `posix_spawn` on a stamped 0755 script fails outright with `ENOEXEC`. No fallback exists at
 *   that layer, so anything that execs the path directly — as `tests/hooks.test.ts` now does —
 *   cannot run the hook at all.
 * - A *shell* asked to run the same file gets `ENOEXEC` and quietly re-runs it under the
 *   system's `/bin/sh`. On macOS `/bin/sh` is bash 3.2, so the bashisms survive and nothing
 *   looks wrong. That is what has been hiding this.
 * - `dash -c 'set -euo pipefail'` exits 2 with "Illegal option -o pipefail", and all three hook
 *   scripts open with that line.
 *
 * So on any box where `/bin/sh` is dash — most Linux distributions — the fallback interpreter
 * rejects line 1 of the script and the hook exits 2. For a `PreToolUse` hook, exit 2 is not
 * "failed", it is **"blocked"**: a displaced shebang there would refuse every Bash tool call
 * with an unexplained error. Restoring the shebang to line 1 is what keeps the script's declared
 * interpreter its actual one, rather than whatever the caller happens to be.
 *
 * The same shape, and the same reason, as `stampAfterFrontmatter` in `render/skills.ts`: a
 * format that reserves line 1 gets the stamp on line 2. Kept here rather than keyed on the
 * `sh` extension because the constraint belongs to the `#!`, not to the file's name.
 */
function stampAfterShebang(contents: string, stamp: string): string {
  if (!contents.startsWith('#!')) return `${stamp}\n${contents}`;
  const end = contents.indexOf('\n');
  if (end === -1) return `${contents}\n${stamp}\n`;
  return `${contents.slice(0, end + 1)}${stamp}\n${contents.slice(end + 1)}`;
}

const STAMP_PATTERN =
  /personal-config v(\S+) · (\d{4}-\d{2}-\d{2}) · config ([0-9a-f]{8}) · standard v(\S+?)( · adapted)?\s*(?:-->)?$/m;

export function readStamp(contents: string): StampParts | null {
  const match = contents.match(STAMP_PATTERN);
  if (!match) return null;
  const [, version, date, configHash, standardVersion, marker] = match;
  if (!version || !date || !configHash || !standardVersion) return null;
  return { version, date, configHash, standardVersion, adapted: marker !== undefined };
}

export function isOurs(contents: string): boolean {
  return readStamp(contents) !== null;
}

/**
 * `text` carrying an adapted stamp, whichever of three states it started in: a stamp already
 * marked comes back as it was; a plain stamp gains the marker in place and keeps every field it
 * had, because those fields are what the tool wrote and the header the fix keyed on may disagree
 * with them; no stamp at all gets `line` — an adapted stamp the caller rendered — where
 * `withStamp` would have put one. Every byte after the stamp line is kept in all three, which is
 * what lets the write guard admit this one write to a file this tool did not produce (D3).
 */
export function markAdapted(text: string, line: string): string {
  const stamp = readStamp(text);
  if (stamp === null) return stampAfterShebang(text, line);
  if (stamp.adapted) return text;
  return text.replace(STAMP_PATTERN, (whole) =>
    whole.replace(/(\s*(?:-->)?)$/, `${ADAPTED_MARKER}$1`),
  );
}

/**
 * The stamp's date field, and only it, blanked — so two renderings of the same file can be
 * compared for everything except when they were written.
 *
 * Non-global on purpose: a generated file carries exactly one stamp, and it is the first match
 * in both spellings (`withStamp` puts it on line 1, `stampAfterFrontmatter` just below the
 * frontmatter). A later stamp-shaped line is prose — `README.md` documenting the format,
 * `examples/` showing a filled one — and is not this file's provenance to normalise away.
 */
function blankStampDate(text: string): string {
  return text.replace(
    /(personal-config v\S+ · )\d{4}-\d{2}-\d{2}( · config )/,
    '$1····-··-··$2',
  );
}

/**
 * Whether two versions of a file differ by nothing but the stamp's date.
 *
 * A re-run renders *today* into every stamp, so on any day after the first, a file whose body
 * is byte-identical still differs from the one on disk by that one field. That was enough to
 * make `before !== after` true for every generated file, which meant every re-run backed up and
 * rewrote all of them — a "nothing changed" run that produced a full backup directory and
 * nineteen rewritten files, and an `undo` whose whole manifest was date churn.
 *
 * **Only the date is forgiven.** Version, config hash and standard version are the stamp's
 * claims about *provenance*, not about timing: a file whose config hash moved really did come
 * from different answers, and `doctor`'s stamp-drift rule reads that hash to say so. Forgiving
 * those would leave a file claiming answers that no longer produced it, with the rule that
 * exists to catch exactly that reading the stale value and passing.
 */
export function sameButForStampDate(before: string, after: string): boolean {
  if (before.length === 0) return false;
  return blankStampDate(before) === blankStampDate(after);
}
