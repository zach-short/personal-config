import { describe, expect, test } from 'bun:test';
import { catalogPath } from '../src/lib/catalog.ts';
import type { Catalog, Question } from '../src/lib/types.ts';
import { ALL_QUESTIONS } from '../src/questions/index.ts';

/**
 * setup-tracks `DESIGN.md` D21 lifts §3.2's wording freeze for exactly four strings, and §10.5
 * says which words go out — ratified 2026-09-22, "settled copy … re-opening it needs a dated
 * supersession, not a better idea". So these are asserted **verbatim**, not by keyword: a test
 * that checked for "projects" would pass on a rewrite nobody ratified.
 *
 * Why each one changed, in one line each (G29): a person who keeps a repo *and* a loose folder
 * could answer neither `uses-git` label truthfully; the first question the terminal asks said
 * "repos"; and the recommended `hooks` answer named three git commands to someone who had just
 * said they keep none.
 *
 * The apostrophes are typographic because every other string in `src/questions/` is — §10.5
 * writes `can't` in markdown, and that is the same word.
 */
function question(id: string): Question {
  const found = ALL_QUESTIONS.find((q) => q.id === id);
  if (!found) throw new Error(`no question ${id}`);
  return found;
}

function option(id: string, value: string) {
  const found = question(id).options?.find((o) => o.value === value);
  if (!found) throw new Error(`no option ${value} on ${id}`);
  return found;
}

describe('the four strings D21 unfroze', () => {
  test('`projects-dir` asks about projects, not repos', () => {
    expect(question('projects-dir').ask).toBe(
      'Which directory holds the projects you want to set up?',
    );
  });

  test('`work-profile` asks about this project, not this repo', () => {
    expect(question('work-profile').ask).toBe('How does work arrive in this project?');
  });

  test('`uses-git`’s two labels let a person with both answer truthfully (D20, warm)', () => {
    // D20 upholds D2: two values, no third. The labels carry what a third value would have
    // said — answer yes if *any* of it is in git — so `yes` still means "git is in play
    // somewhere" and the target's kind decides where (G27).
    expect(option('uses-git', 'yes').label).toBe('Yes, some or all of it');
    expect(option('uses-git', 'yes').example).toBe(
      'commits and history, in at least one place',
    );
    expect(option('uses-git', 'no').label).toBe('No, none of it');
    expect(option('uses-git', 'no').example).toBe('the files live on disk and that’s it');
  });

  test('`hooks`’s first option names no git command it cannot promise (D25, plain)', () => {
    // The option installs the commit guard for a repo and the delete guard for other work
    // (HANDOFF 70), so the label says what both do and the hint says which is which.
    expect(option('hooks', 'commit-guard').label).toBe(
      'Yes — block the commands that can’t be undone',
    );
    expect(option('hooks', 'commit-guard').example).toBe(
      '`git commit` and `git push` in a repo, `rm` for other work; the hook refuses and says what to do instead',
    );
  });

  test('the values are untouched, so a stored profile reads as it did (DIAL-7)', () => {
    expect(question('uses-git').options?.map((o) => o.value)).toEqual(['yes', 'no']);
    expect(question('hooks').options?.map((o) => o.value)).toEqual([
      'commit-guard',
      'both',
      'none',
    ]);
  });

  test('the catalog the site reads carries the same four strings', async () => {
    const catalog = (await Bun.file(catalogPath()).json()) as Catalog;
    const find = (id: string) => catalog.questions.find((q) => q.id === id);
    expect(find('projects-dir')?.ask).toBe(question('projects-dir').ask);
    expect(find('work-profile')?.ask).toBe(question('work-profile').ask);
    expect(find('uses-git')?.options?.[0]?.label).toBe('Yes, some or all of it');
    expect(find('hooks')?.options?.[0]?.label).toBe(
      'Yes — block the commands that can’t be undone',
    );
  });
});
