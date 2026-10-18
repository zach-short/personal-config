import { join } from 'node:path';
import { DISCOVER_QUESTIONS, PRACTICE_QUESTIONS, YOU_QUESTIONS } from '../questions/index.ts';
import { exists, readdir, readJson } from './disk.ts';
import { contractHome, expandHome, profilesDir, repoRoot } from './paths.ts';
import type { Answers, AnswerValue, Question } from './types.ts';

/**
 * A profile is a named set of the answers that belong to a folder, saved once and applied to as
 * many folders as the person likes. The answers that belong to the person (commit policy, hooks,
 * models, chat style) are not in it: `global` sets those once, and a folder never overrides them.
 */
export type UserProfile = {
  name: string;
  description: string;
  answers: Answers;
  /** Every folder this profile was applied to, with `~`, so an edit can offer to re-apply. */
  folders: string[];
};

/** The three `you` answers that describe a folder's work rather than the person (init D4). */
export const TRACK_IDS = ['work-kind', 'config-weight', 'uses-git'];

/**
 * Asked per folder and never shared: where to look for repos, how a folder proves its work and
 * what it must not touch. A folder keeps its own answers to these when a profile is applied.
 */
export const FOLDER_ONLY_IDS = ['projects-dir', 'proof-line', 'off-limits'];

/** The questions a profile asks, in the order `setup` asks them. */
export function profileQuestions(): Question[] {
  return [
    ...YOU_QUESTIONS.filter((q) => TRACK_IDS.includes(q.id)),
    ...DISCOVER_QUESTIONS.filter((q) => !FOLDER_ONLY_IDS.includes(q.id)),
    ...PRACTICE_QUESTIONS,
  ];
}

export function profileKeys(): Set<string> {
  return new Set(profileQuestions().map((q) => q.configKey));
}

/** The subset of `answers` a profile saves, sorted so the file is diff-stable. */
export function profileAnswers(answers: Answers): Answers {
  const keys = profileKeys();
  return Object.fromEntries(
    Object.entries(answers)
      .filter(([key]) => keys.has(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** `Heavy setup` → `heavy-setup`: the file name, and what a command line names it by. */
export function slugOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function profilePath(name: string): string {
  return join(profilesDir(), `${slugOf(name)}.json`);
}

/** Why a name cannot be used, or `null`. `taken` holds the slugs already saved. */
export async function nameProblem(name: string, taken: string[]): Promise<string | null> {
  const slug = slugOf(name);
  if (name.trim() === '' || slug === '')
    return 'Give the profile a name with a letter or digit.';
  if (name.length > 40) return 'Keep the name to 40 characters.';
  if (taken.includes(slug)) return `A profile named "${slug}" exists. Pick another name.`;
  if (await exists(join(repoRoot(), 'profiles', `${slug}.json`))) {
    return `"${slug}" is a built-in profile's name. Pick another name.`;
  }
  return null;
}

export type ProfileList = { profiles: UserProfile[]; problems: string[] };

/** Every saved profile, by name. A file that does not parse is named, never rewritten. */
export async function listProfiles(): Promise<ProfileList> {
  // `exists` is true only for a regular file, so the folder is read and an absent one is empty.
  const names = await readdir(profilesDir()).catch(() => []);
  const files = names.filter((f) => f.endsWith('.json')).sort();
  const profiles: UserProfile[] = [];
  const problems: string[] = [];
  for (const file of files) {
    const path = join(profilesDir(), file);
    try {
      profiles.push(asProfile(await readJson(path), path));
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { profiles, problems };
}

/** One profile by its name or slug, or `null` where none is saved. */
export async function findProfile(name: string): Promise<UserProfile | null> {
  const path = profilePath(name);
  if (!(await exists(path))) return null;
  return asProfile(await readJson(path), path);
}

/** A parsed file, checked field by field, so a hand edit that breaks one is named. */
export function asProfile(parsed: unknown, from: string): UserProfile {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${contractHome(from)} is not a profile: expected a JSON object`);
  }
  const raw = parsed as Record<string, unknown>;
  if (typeof raw.name !== 'string' || raw.name === '') {
    throw new Error(`${contractHome(from)}: "name" must be a non-empty string`);
  }
  return {
    name: raw.name,
    description: typeof raw.description === 'string' ? raw.description : '',
    answers: answersOf(raw.answers, from),
    folders: foldersOf(raw.folders, from),
  };
}

function answersOf(value: unknown, from: string): Answers {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${contractHome(from)}: "answers" must be an object`);
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const bad = entries.find(([, v]) => !isAnswer(v));
  if (bad) throw new Error(`${contractHome(from)}: answer "${bad[0]}" is not a string or list`);
  return Object.fromEntries(entries) as Answers;
}

function isAnswer(value: unknown): value is AnswerValue {
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function foldersOf(value: unknown, from: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw new Error(`${contractHome(from)}: "folders" must be a list of paths`);
  }
  return value;
}

/** The file's text, as `plannedRecord` plans it: sorted answers and folders, so it diffs cleanly. */
export function profileText(profile: UserProfile): string {
  const body = {
    name: profile.name,
    description: profile.description,
    answers: profileAnswers(profile.answers),
    folders: [...new Set(profile.folders.map((f) => contractHome(expandHome(f))))].sort(),
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

/** The profile with these folders added to its record. */
export function withFolders(profile: UserProfile, folders: string[]): UserProfile {
  return { ...profile, folders: [...profile.folders, ...folders] };
}
