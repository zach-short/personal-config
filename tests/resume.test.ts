/**
 * The wizard's answers lived in memory only until 2026-09-15, so `Ctrl+C` on question twenty
 * of thirty threw away the first nineteen. These tests are the guard on the checkpoint that
 * fixed it — and in particular on the rule that stops it doing harm: a replay that no longer
 * matches the run must stop, never guess.
 */
import { describe, expect, test } from 'bun:test';
import { parseCli } from '../src/lib/args.ts';
import { BACK, cancelMessage, checkpointing, type Prompter } from '../src/lib/ask.ts';
import { loadConfig } from '../src/lib/config.ts';
import {
  type Checkpoint,
  checkpointFile,
  clearCheckpoint,
  describeCheckpoint,
  hasCheckpoint,
  type ResumeEntry,
  readCheckpoint,
  retiresCheckpoint,
} from '../src/lib/resume.ts';
import type { Answers, AnswerValue, Question } from '../src/lib/types.ts';
import { version } from '../src/lib/version.ts';
import { askPhase } from '../src/phases/run.ts';
import { questionsFor } from '../src/questions/index.ts';
import { cleanup, tempDir } from './helpers.ts';

/** `X2`: `home()` reads `$HOME` on every call, so a test can own one and take it away again. */
async function inTempHome<T>(body: () => Promise<T>): Promise<T> {
  const previous = process.env.HOME ?? '';
  const dir = await tempDir('pc-home-');
  process.env.HOME = dir;
  try {
    return await body();
  } finally {
    process.env.HOME = previous;
    await cleanup(dir);
  }
}

function question(id: string, kind: Question['kind'] = 'select'): Question {
  return { id, phase: 'you', kind, ask: `ask ${id}`, readMore: id, configKey: id };
}

/** An inner prompter that answers everything and remembers what it was actually asked. */
function recording(prefix = 'live'): Prompter & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async ask(q) {
      asked.push(q.id);
      return `${prefix}-${q.id}`;
    },
    async confirm(_message, fallback) {
      return fallback;
    },
  };
}

/** Stands in for the `Ctrl+C` a test has no terminal to press. */
function interruptedAfter(count: number, prefix: string): Prompter & { asked: string[] } {
  const inner = recording(prefix);
  return {
    asked: inner.asked,
    async ask(question, fallback) {
      if (inner.asked.length >= count) throw new Error('interrupted');
      return inner.ask(question, fallback);
    },
    async confirm(message, fallback) {
      return inner.confirm(message, fallback);
    },
  };
}

async function writeFile(checkpoint: Partial<Checkpoint>): Promise<void> {
  const body = { version: await version(), date: '2026-09-15', entries: [], ...checkpoint };
  await Bun.write(checkpointFile(), `${JSON.stringify(body, null, 2)}\n`);
}

async function onDisk(): Promise<Checkpoint> {
  return (await Bun.file(checkpointFile()).json()) as Checkpoint;
}

async function askAll(prompter: Prompter, ids: string[]): Promise<AnswerValue[]> {
  const given: AnswerValue[] = [];
  for (const id of ids) given.push(await prompter.ask(question(id), ''));
  return given;
}

describe('recording answers', () => {
  test('every answer is on disk before the next question is asked', async () => {
    await inTempHome(async () => {
      const prompter = checkpointing(recording());
      expect(hasCheckpoint()).toBe(false);

      await prompter.ask(question('one'), '');
      expect((await onDisk()).entries).toEqual([{ id: 'one', value: 'live-one' }]);

      await prompter.ask(question('two'), '');
      expect((await onDisk()).entries.map((e) => e.id)).toEqual(['one', 'two']);
    });
  });

  test('nothing is written before the first answer, so the cancel line stays honest', async () => {
    await inTempHome(async () => {
      checkpointing(recording());
      expect(hasCheckpoint()).toBe(false);
    });
  });

  test('an empty multiselect is a recorded answer, not an unanswered question', async () => {
    await inTempHome(async () => {
      const empty: Prompter = {
        async ask() {
          return [];
        },
        async confirm(_message, fallback) {
          return fallback;
        },
      };
      const prompter = checkpointing(empty);
      await prompter.ask(question('skills', 'multiselect'), '');

      const offer = await readCheckpoint();
      expect(offer.kind).toBe('ready');
      if (offer.kind !== 'ready') return;
      expect(offer.checkpoint.entries).toEqual([{ id: 'skills', value: [] }]);
    });
  });

  test('a completed run clears the checkpoint', async () => {
    await inTempHome(async () => {
      await checkpointing(recording()).ask(question('one'), '');
      expect(hasCheckpoint()).toBe(true);

      await clearCheckpoint();
      expect(hasCheckpoint()).toBe(false);
      expect((await readCheckpoint()).kind).toBe('none');
    });
  });
});

describe('replaying a previous run', () => {
  const tape: ResumeEntry[] = [
    { id: 'one', value: 'kept-one' },
    { id: 'two', value: 'kept-two' },
  ];

  test('an answered question is handed back without being asked again', async () => {
    await inTempHome(async () => {
      const inner = recording();
      const given = await askAll(checkpointing(inner, tape), ['one', 'two', 'three']);

      expect(given).toEqual(['kept-one', 'kept-two', 'live-three']);
      expect(inner.asked).toEqual(['three']);
    });
  });

  test('replay stops at the first question that does not match, and stays stopped', async () => {
    await inTempHome(async () => {
      const inner = recording();
      const given = await askAll(checkpointing(inner, tape), ['one', 'moved', 'two']);

      expect(given).toEqual(['kept-one', 'live-moved', 'live-two']);
      expect(inner.asked).toEqual(['moved', 'two']);
    });
  });

  test('a diverged run rewrites the checkpoint from where it diverged', async () => {
    await inTempHome(async () => {
      await askAll(checkpointing(recording(), tape), ['one', 'moved']);

      expect((await onDisk()).entries).toEqual([
        { id: 'one', value: 'kept-one' },
        { id: 'moved', value: 'live-moved' },
      ]);
    });
  });

  test('a matching mark keeps the replay going', async () => {
    await inTempHome(async () => {
      const marked: ResumeEntry[] = [{ id: 'repos', value: '/a,/b' }, ...tape];
      const inner = recording();
      const prompter = checkpointing(inner, marked);

      await prompter.mark?.('repos', '/a,/b');
      expect(await askAll(prompter, ['one'])).toEqual(['kept-one']);
      expect(inner.asked).toEqual([]);
    });
  });

  test('a mark that changed stops the replay — the answers after it are another repo’s', async () => {
    await inTempHome(async () => {
      const marked: ResumeEntry[] = [{ id: 'repos', value: '/a,/b' }, ...tape];
      const inner = recording();
      const prompter = checkpointing(inner, marked);

      await prompter.mark?.('repos', '/c');
      expect(await askAll(prompter, ['one'])).toEqual(['live-one']);
      expect(inner.asked).toEqual(['one']);
    });
  });
});

describe('what setup is offered on the next run', () => {
  test('a checkpoint from this build is offered, with its date and size', async () => {
    await inTempHome(async () => {
      await writeFile({ entries: [{ id: 'one', value: 'kept' }] });

      const offer = await readCheckpoint();
      expect(offer.kind).toBe('ready');
      if (offer.kind !== 'ready') return;
      expect(describeCheckpoint(offer.checkpoint)).toBe('1 answer(s), last saved 2026-09-15');
    });
  });

  test('a checkpoint from another build is stale, not replayed', async () => {
    await inTempHome(async () => {
      await writeFile({ version: '0.0.1-old', entries: [{ id: 'one', value: 'kept' }] });

      const offer = await readCheckpoint();
      expect(offer.kind).toBe('stale');
      if (offer.kind !== 'stale') return;
      expect(offer.version).toBe('0.0.1-old');
    });
  });

  test('one unreadable entry rejects the file, because dropping it would shift the rest', async () => {
    await inTempHome(async () => {
      await writeFile({ entries: [{ id: 'one', value: 'kept' }, { value: 'no id' }] as never });
      expect((await readCheckpoint()).kind).toBe('none');
    });
  });

  test('a file that is not JSON at all is no offer rather than a crash', async () => {
    await inTempHome(async () => {
      await Bun.write(checkpointFile(), 'half a write{');
      expect((await readCheckpoint()).kind).toBe('none');
    });
  });

  test('a checkpoint with no answers in it is no offer', async () => {
    await inTempHome(async () => {
      await writeFile({});
      expect((await readCheckpoint()).kind).toBe('none');
    });
  });
});

describe('what a cancelled prompt says', () => {
  test('with nothing recorded it is the bare line it always was', async () => {
    await inTempHome(async () => {
      expect(cancelMessage()).toBe('Nothing was written.');
    });
  });

  test('once an answer is on disk it says so, or the person re-types thirty of them', async () => {
    await inTempHome(async () => {
      await checkpointing(recording()).ask(question('one'), '');
      expect(cancelMessage()).toStartWith('Nothing was written. Your answers so far are saved');
      expect(cancelMessage()).toContain('personal-config setup');
    });
  });
});

describe('which endings retire the checkpoint', () => {
  test('a run that reached its end leaves nothing to pick up', () => {
    expect(retiresCheckpoint('written')).toBe(true);
    // "Already current" wrote nothing, but it is still an ending: keeping its checkpoint
    // offered to resume a run the person had actually finished.
    expect(retiresCheckpoint('already-current')).toBe(true);
  });

  test('a preview and a decline keep it, because the run never reached its end', () => {
    expect(retiresCheckpoint('dry-run')).toBe(false);
    expect(retiresCheckpoint('declined')).toBe(false);
  });
});

describe('going back, and what the checkpoint does about it', () => {
  /** One entry per ask; `BACK` in the script is the person picking `← back`. */
  function scripted(script: AnswerValue[]): Prompter & { asked: string[] } {
    const asked: string[] = [];
    return {
      asked,
      async ask(question) {
        asked.push(question.id);
        return script[asked.length - 1] ?? `live-${question.id}`;
      },
      async confirm(_message, fallback) {
        return fallback;
      },
    };
  }

  test('a corrected answer replaces the one it corrects, rather than sitting beside it', async () => {
    await inTempHome(async () => {
      const prompter = checkpointing(scripted(['one-a', 'two-a', BACK, 'two-b', 'three-a']));

      await askAll(prompter, ['one', 'two', 'three', 'two', 'three']);

      // Three entries, not five, and `two` holds the second answer. A tape that appended both
      // would replay `two-a` — the answer the person went back specifically to change.
      expect((await onDisk()).entries).toEqual([
        { id: 'one', value: 'one-a' },
        { id: 'two', value: 'two-b' },
        { id: 'three', value: 'three-a' },
      ]);
    });
  });

  test('the sentinel itself never reaches the tape', async () => {
    await inTempHome(async () => {
      const prompter = checkpointing(scripted(['one-a', BACK, 'one-b']));
      await askAll(prompter, ['one', 'two', 'one']);

      const values = (await onDisk()).entries.map((e) => e.value);
      expect(values).not.toContain(BACK);
      expect(values).toEqual(['one-b']);
    });
  });

  test('the corrected answer is what the next run picks up', async () => {
    await inTempHome(async () => {
      const first = checkpointing(scripted(['one-a', 'two-a', BACK, 'two-b']));
      await askAll(first, ['one', 'two', 'three', 'two']);

      const offer = await readCheckpoint();
      expect(offer.kind).toBe('ready');
      if (offer.kind !== 'ready') return;

      const second = recording('second');
      const given = await askAll(checkpointing(second, offer.checkpoint.entries), [
        'one',
        'two',
        'three',
      ]);

      expect(given).toEqual(['one-a', 'two-b', 'second-three']);
      expect(second.asked).toEqual(['three']);
    });
  });

  test('stepping back inside a replay stops it, or it hands back the answer being corrected', async () => {
    await inTempHome(async () => {
      const tape: ResumeEntry[] = [
        { id: 'one', value: 'kept-one' },
        { id: 'two', value: 'kept-two' },
      ];
      const inner = scripted([BACK, 'live-two']);
      const prompter = checkpointing(inner, tape);

      const given = await askAll(prompter, ['one', 'two', 'three', 'two']);

      // `one` and `two` came back off the tape unasked; `three` was the first live question and
      // the person stepped off it. `two` must now be *asked*, not handed back from the tape.
      expect(given).toEqual(['kept-one', 'kept-two', BACK, 'live-two']);
      expect(inner.asked).toEqual(['three', 'two']);
      expect((await onDisk()).entries).toEqual([
        { id: 'one', value: 'kept-one' },
        { id: 'two', value: 'live-two' },
      ]);
    });
  });

  test('rewinding past the only answer empties the tape rather than going negative', async () => {
    await inTempHome(async () => {
      const prompter = checkpointing(scripted(['one-a', BACK]));
      await askAll(prompter, ['one', 'two']);

      // The file is still there, holding nothing — and an empty checkpoint is no offer, so the
      // next run starts clean instead of proposing to resume a run with no answers in it.
      expect((await onDisk()).entries).toEqual([]);
      expect((await readCheckpoint()).kind).toBe('none');
    });
  });

  test('back before any answer writes no checkpoint, so the cancel line stays the bare one', async () => {
    await inTempHome(async () => {
      const prompter = checkpointing(scripted([BACK]));
      await askAll(prompter, ['one']);

      expect(hasCheckpoint()).toBe(false);
      expect(cancelMessage()).toBe('Nothing was written.');
    });
  });
});

describe('the real question chain', () => {
  /** The `you` phase exactly as `setup` asks it, defaults and all — no TTY. */
  async function youPhase(prompter: Prompter): Promise<Answers> {
    const config = await loadConfig(parseCli(['setup']), null);
    const answers: Answers = { ...config.answers };
    await askPhase('you', prompter, answers, config);
    return answers;
  }

  test('an interruption costs one question, not the whole phase', async () => {
    await inTempHome(async () => {
      const ids = questionsFor('you').map((q) => q.id);
      expect(ids.length).toBeGreaterThan(3);

      const first = interruptedAfter(3, 'first');
      await expect(youPhase(checkpointing(first))).rejects.toThrow('interrupted');
      expect(first.asked).toEqual(ids.slice(0, 3));

      const offer = await readCheckpoint();
      expect(offer.kind).toBe('ready');
      if (offer.kind !== 'ready') return;
      expect(offer.checkpoint.entries).toHaveLength(3);

      const second = recording('second');
      const answers = await youPhase(checkpointing(second, offer.checkpoint.entries));

      // Named by position rather than by question id: the ids at the head and tail of `you`
      // move whenever a question is added, and what this pins is that the first three answers
      // came from the interrupted run and everything after it from the second.
      const questions = questionsFor('you');
      const head = questions[0];
      const tail = questions.at(-1);
      if (!head || !tail) throw new Error('the you phase is empty');

      expect(second.asked).toEqual(ids.slice(3));
      expect(answers[head.configKey]).toBe(`first-${head.id}`);
      expect(answers[tail.configKey]).toBe(`second-${tail.id}`);
    });
  });
});
