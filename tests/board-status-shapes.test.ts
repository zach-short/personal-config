import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { boardStatus } from '../src/doctor/rules/board-status.ts';
import type { Doc } from '../src/doctor/scan.ts';
import { cleanup, tempDir } from './helpers.ts';

/**
 * §2.3's obligations, against the shapes that satisfied the *form* of each check while naming
 * nothing. Every one of these four passed `doctor` clean before 2026-09-17, which is the worst
 * way for a gate to be wrong: a reader takes a clean run as evidence the board is well-formed.
 *
 * A file of its own rather than more cases in `board-status.test.ts`, per X1.
 */

const HEADER = '| # | Task | Status | Model | Lane | Waits on | Files it owns |';
const RULE = '|---|------|--------|-------|------|----------|---------------|';

function board(body: string[], path = 'PASSOFF.md'): Doc {
  const text = [HEADER, RULE, ...body].join('\n');
  return {
    path,
    kind: 'board',
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
  };
}

function messages(doc: Doc): string[] {
  return boardStatus.check(doc).map((f) => f.message);
}

const LOG = [
  '## Step log',
  '',
  '**1. One.** Done 2026-09-15.',
  '',
  '**2. Two.** Done 2026-09-16.',
].join('\n');

/** A board and its ledger side by side, which is where §0.2 keeps them. */
async function besideLedger<T>(
  log: string | null,
  run: (boardPath: string) => Promise<T> | T,
): Promise<T> {
  const dir = await tempDir('pc-board-');
  try {
    if (log !== null) await Bun.write(join(dir, 'HANDOFF.md'), log);
    return await run(join(dir, 'PASSOFF.md'));
  } finally {
    await cleanup(dir);
  }
}

describe('§2.3 — DONE points at a step the ledger actually has', () => {
  test('violates: a citation to a step number no step uses', async () => {
    await besideLedger(LOG, (path) => {
      const doc = board(['| 1 | X | `DONE — HANDOFF 999` | D | A | — | — |'], path);
      expect(messages(doc)[0]).toContain('999');
    });
  });

  test('passes: a citation to a step the log carries', async () => {
    await besideLedger(LOG, (path) => {
      const doc = board(['| 1 | X | `DONE — HANDOFF 2` | D | A | — | — |'], path);
      expect(messages(doc)).toEqual([]);
    });
  });

  test('passes: no ledger to check against says nothing rather than guesses', async () => {
    await besideLedger(null, (path) => {
      const doc = board(['| 1 | X | `DONE — HANDOFF 999` | D | A | — | — |'], path);
      expect(messages(doc)).toEqual([]);
    });
  });

  test('passes: another repo’s ledger, which this one cannot answer for', async () => {
    await besideLedger(LOG, (path) => {
      const doc = board(['| 1 | X | `DONE — portfolio HANDOFF 21` | D | A | — | — |'], path);
      expect(messages(doc)).toEqual([]);
    });
  });
});

describe('§2.3 — SUPERSEDED names a replacement, not itself', () => {
  test('violates: the word appears only in the row’s own title', () => {
    const doc = board(['| 1 | Replace the board parser | `SUPERSEDED` | — | — | — | — |']);
    expect(messages(doc)[0]).toContain('replaced');
  });

  test('passes: the replacement is named in a cell that is not the title', () => {
    const doc = board([
      '| 1 | Replace the board parser | `SUPERSEDED` | — | — | **replaced by item 4** | — |',
    ]);
    expect(messages(doc)).toEqual([]);
  });

  test('passes: the replacement is named in the item’s section below the board', () => {
    const doc = board([
      '| 1 | Replace the board parser | `SUPERSEDED` | — | — | — | — |',
      '',
      '### 1. Replace the board parser',
      '',
      '*Opened 2026-09-06.* **`SUPERSEDED` by item 4, 2026-09-08**, which parses the table once.',
    ]);
    expect(messages(doc)).toEqual([]);
  });
});

describe('§2.3 — HELD names what it waits on', () => {
  test('violates: a waits-on cell of literally “nothing”', () => {
    const doc = board(['| 1 | X | `HELD` | D | A | nothing | — |']);
    expect(messages(doc)[0]).toContain('waits on');
  });

  test('violates: prose that answers the question without naming anything', () => {
    const doc = board(['| 1 | X | `HELD` | D | A | waiting for a decision | — |']);
    expect(messages(doc)).toHaveLength(1);
  });

  test('passes: a row number', () => {
    const doc = board(['| 1 | X | `HELD` | D | A | item 3 — it changes the form | — |']);
    expect(messages(doc)).toEqual([]);
  });

  test('passes: an external dependency named by the artifact it turns on', () => {
    const doc = board(['| 1 | X | `HELD` | D | A | `standard/VERSION` being cut | — |']);
    expect(messages(doc)).toEqual([]);
  });
});

describe('§2.3 — SETTLED AS NO carries a reason, not just a date', () => {
  const row = '| 4 | Rate-limit the redirect path too | `SETTLED AS NO` | — | — | — | — |';

  test('violates: a dated paragraph that is only a date and a row number', () => {
    const doc = board([
      row,
      '',
      '### 4. Rate-limit the redirect path too',
      '',
      '*Opened 2026-09-06.* **`SETTLED AS NO`, 2026-09-08.** Item 4.',
    ]);
    expect(messages(doc)[0]).toContain('reason');
  });

  test('passes: a paragraph that says why', () => {
    const doc = board([
      row,
      '',
      '### 4. Rate-limit the redirect path too',
      '',
      '*Opened 2026-09-06.* **`SETTLED AS NO`, 2026-09-08.** The redirect path makes one read',
      'and no write, so a limiter would cost the hottest path a lookup it never needed.',
    ]);
    expect(messages(doc)).toEqual([]);
  });
});
