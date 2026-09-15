/**
 * Every generated file carries one stamp line. It is what makes a re-run an overwrite of a
 * file this tool owns rather than a guess, and what lets `doctor` spot drift: a stamp whose
 * config hash differs from the current merged config means the file predates an answer change.
 */

export type StampParts = {
  version: string;
  date: string;
  configHash: string;
  standardVersion: string;
};

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
  const body = `personal-config v${parts.version} · ${parts.date} · config ${parts.configHash} · standard v${parts.standardVersion}`;
  if (!style) return body;
  return style.close ? `${style.open} ${body} ${style.close}` : `${style.open} ${body}`;
}

export function withStamp(contents: string, parts: StampParts, extension = 'md'): string {
  return `${stampLine(parts, extension)}\n${contents}`;
}

const STAMP_PATTERN =
  /personal-config v(\S+) · (\d{4}-\d{2}-\d{2}) · config ([0-9a-f]{8}) · standard v(\S+?)\s*(?:-->)?$/m;

export function readStamp(contents: string): StampParts | null {
  const match = contents.match(STAMP_PATTERN);
  if (!match) return null;
  const [, version, date, configHash, standardVersion] = match;
  if (!version || !date || !configHash || !standardVersion) return null;
  return { version, date, configHash, standardVersion };
}

export function isOurs(contents: string): boolean {
  return readStamp(contents) !== null;
}
