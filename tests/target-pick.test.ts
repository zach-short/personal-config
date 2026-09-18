/**
 * Which targets a run configures. Until 2026-09-17 `setup` decided this with
 * `interactive ? await pickRepos(scans) : scans.slice(0, 1)` — a `p.multiselect` call that
 * reached past the `Prompter` interface, and a non-interactive branch that quietly took the
 * first target alphabetically while `--help` promised `--yes` "accept every default".
 */
import { describe, expect, test } from 'bun:test';
import { checkpointing, defaultsPrompter, type Prompter } from '../src/lib/ask.ts';
import type { RepoScan } from '../src/lib/types.ts';
import { pickAll, testScan } from './helpers.ts';

const SCANS: RepoScan[] = [
  testScan({ path: '/tmp/alpha', name: 'alpha' }),
  testScan({ path: '/tmp/beta', name: 'beta' }),
  testScan({ path: '/tmp/gamma', name: 'gamma', kind: 'folder' }),
];

function names(scans: RepoScan[]): string[] {
  return scans.map((s) => s.name);
}

describe('what --yes picks', () => {
  test('every target found, not the first one alphabetically', async () => {
    const picked = await defaultsPrompter().pick(SCANS);
    expect(names(picked)).toEqual(['alpha', 'beta', 'gamma']);
  });

  /**
   * The regression this replaced, stated as its own assertion: with three targets found, a
   * non-interactive run used to configure exactly one and say nothing about the other two.
   */
  test('a three-target scan does not collapse to one', async () => {
    const picked = await defaultsPrompter().pick(SCANS);
    expect(picked).toHaveLength(3);
    expect(names(picked)).not.toEqual(['alpha']);
  });

  test('an empty scan stays empty — global rules only', async () => {
    expect(await defaultsPrompter().pick([])).toEqual([]);
  });

  test('folders are picked on the same terms as repos', async () => {
    const picked = await defaultsPrompter().pick(SCANS);
    expect(picked.some((s) => s.kind === 'folder')).toBe(true);
  });
});

describe('the seam itself', () => {
  /** The point of putting `pick` on the interface: a test can answer it without a terminal. */
  test('a prompter that picks a subset is honoured', async () => {
    const onlyBeta: Prompter = {
      ...defaultsPrompter(),
      async pick(scans) {
        return scans.filter((s) => s.name === 'beta');
      },
    };
    expect(names(await onlyBeta.pick(SCANS))).toEqual(['beta']);
  });

  /**
   * `checkpointing` wraps every prompter a resumed run uses. A decorator that forgot to forward
   * `pick` would type-check and then answer `undefined` on exactly the runs being picked up.
   */
  test('checkpointing forwards the pick to its inner prompter', async () => {
    let asked = 0;
    const inner: Prompter = {
      ...defaultsPrompter(),
      async pick(scans) {
        asked += 1;
        return pickAll(scans);
      },
    };
    const picked = await checkpointing(inner).pick(SCANS);
    expect(asked).toBe(1);
    expect(names(picked)).toEqual(['alpha', 'beta', 'gamma']);
  });
});
