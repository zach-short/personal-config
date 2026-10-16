/**
 * `setup` inside the frame, for a bare `personal-config` (bare-command-home Phase 2). The phases,
 * back, resume and the write path are `setup`'s own: this module is only a `Prompter` pair that
 * draws each question as a whole screen through `@clack/core`, and a sink that turns what `setup`
 * says between questions into the next panel's text (BD-4, BD-5).
 */
import type { Readable, Writable } from 'node:stream';
import {
  ConfirmPrompt,
  isCancel,
  MultiSelectPrompt,
  Prompt,
  SelectPrompt,
  TextPrompt,
} from '@clack/core';
import {
  BACK,
  cancelRun,
  choiceOptions,
  clackPrompter,
  type Prompter,
  READ_MORE,
  readMore,
} from './ask.ts';
import {
  choices,
  frame,
  type Hint,
  heading,
  PANEL_MIN,
  type Paint,
  painter,
  panelInner,
  showsRail,
  toneFor,
  wrap,
} from './screens.ts';
import type { AnswerValue, Question, RepoScan } from './types.ts';
import { clearScreen, drawScreen, setSink, short } from './ui.ts';

/** D3's rail, in the order `setup` walks it. */
export const SETUP_STEPS = [
  'About you',
  'Where your repos are',
  'Pick repos',
  'Each repo',
  'Practices',
  'Review',
  'Write',
  'Done',
];

const STEP = { you: 0, where: 1, pick: 2, repo: 3, practices: 4, review: 5, write: 6, done: 7 };

/** Where the frame reads keys and draws, and how big that is. A test passes its own streams. */
export type FrameIo = {
  input: Readable;
  output: Writable;
  size: () => { columns: number; rows: number };
  where: string;
  paint: Paint;
};

export type SetupFrame = {
  /** Asks `setup`'s questions. `runSetup` wraps it in `checkpointing()`, as it does clack's. */
  ask: Prompter;
  /** Answers `confirmBatch()`: the review step. */
  confirm: Prompter;
  /** Runs `setup` with the sink set, and draws the last screen when it returns. */
  run: (setup: () => Promise<number>) => Promise<number>;
};

/**
 * Which repo the per-repo questions are for (BD-7). `pick()` gives the names in the order
 * `setup` plans them, and a repo starts when its first question comes round again, unless that
 * is `← back` landing on it.
 */
type RepoCount = { names: string[]; index: number; firstId: string | null; afterBack: boolean };

type State = {
  io: FrameIo;
  /** What `setup` said since the last panel that showed it, one line per entry. */
  notes: string[];
  step: number;
  repo: RepoCount;
  /** How many times the batch confirm has been answered: the second one is the write (BD-6). */
  confirms: number;
  wrote: boolean;
};

export function terminalIo(): FrameIo {
  return {
    input: process.stdin,
    output: process.stdout,
    size: () => ({ columns: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 }),
    where: short(process.cwd()),
    paint: painter(toneFor(process.env)),
  };
}

export function framePrompters(io: FrameIo = terminalIo()): SetupFrame {
  const state: State = {
    io,
    notes: [],
    step: STEP.you,
    repo: { names: [], index: 0, firstId: null, afterBack: false },
    confirms: 0,
    wrote: false,
  };
  const ask = questionPrompter(state);
  return {
    ask,
    confirm: { ...ask, confirm: (m, f) => review(state, m, f) },
    run: (s) => run(state, s),
  };
}

/**
 * `cancelRun()` leaves through `process.exit`, which skips every `finally`, so the cursor that a
 * prompt hid is shown again by an exit handler (BD-8).
 */
async function run(state: State, setup: () => Promise<number>): Promise<number> {
  const showCursor = () => state.io.output.write('\x1b[?25h');
  process.once('exit', showCursor);
  setSink((line) => state.notes.push(...line.split('\n')));
  try {
    const code = await setup();
    drawScreen(state.wrote ? doneScreen(state) : endScreen(state), state.io.output);
    return code;
  } finally {
    setSink(null);
    process.removeListener('exit', showCursor);
  }
}

function questionPrompter(state: State): Prompter {
  return {
    async ask(question, fallback, canGoBack = false) {
      if (narrow(state))
        return flushed(state, () => clackPrompter().ask(question, fallback, canGoBack));
      const value = await askQuestion(state, question, fallback, canGoBack);
      state.repo.afterBack = value === BACK;
      return value;
    },
    async confirm(message, fallback) {
      if (narrow(state))
        return flushed(state, () => clackPrompter().confirm(message, fallback));
      return askConfirm(state, message, fallback, state.step);
    },
    async pick(scans) {
      if (narrow(state)) return flushed(state, () => clackPrompter().pick(scans));
      const picked = await askPick(state, scans);
      state.repo = {
        names: picked.map((s) => s.name),
        index: 0,
        firstId: null,
        afterBack: false,
      };
      return picked;
    },
  };
}

/** Below a panel's floor the frame cannot draw, so the step is asked as `setup` asks it (BD-10). */
function narrow(state: State): boolean {
  return state.io.size().columns < PANEL_MIN + 4;
}

async function flushed<T>(state: State, ask: () => Promise<T>): Promise<T> {
  if (state.notes.length > 0) state.io.output.write(`${state.notes.join('\n')}\n`);
  state.notes = [];
  return ask();
}

function stepOf(state: State, question: Question): number {
  if (question.id === 'projects-dir') return STEP.where;
  if (question.phase === 'you') return STEP.you;
  if (question.phase === 'practices') return STEP.practices;
  countRepo(state.repo, question.id);
  return STEP.repo;
}

function countRepo(repo: RepoCount, id: string): void {
  if (repo.firstId === null) {
    repo.firstId = id;
    repo.index = 1;
  } else if (id === repo.firstId && !repo.afterBack) {
    repo.index = Math.min(repo.index + 1, Math.max(repo.names.length, 1));
  }
}

/** The `Read more…` loop, as `askChoice` runs it: the long form, then the same question again. */
async function askQuestion(
  state: State,
  question: Question,
  fallback: AnswerValue,
  canGoBack: boolean,
): Promise<AnswerValue> {
  state.step = stepOf(state, question);
  if (question.kind === 'text') return askText(state, question, fallback);
  if (question.kind === 'confirm')
    return askConfirm(state, question.ask, fallback === true, state.step);
  for (;;) {
    const answer = await askChoice(state, question, fallback, canGoBack);
    if (answer === BACK || (Array.isArray(answer) && answer.includes(BACK))) return BACK;
    if (!(answer === READ_MORE || (Array.isArray(answer) && answer.includes(READ_MORE)))) {
      return answer;
    }
    await scroll(state, `More on: ${question.ask}`, await readMore(question.readMore));
  }
}

const CHOICE_HINTS: readonly Hint[] = [
  ['↑/↓', 'choose'],
  ['enter', 'next'],
  ['ctrl+c', 'quit'],
];
const MULTI_HINTS: readonly Hint[] = [
  ['↑/↓', 'move'],
  ['space', 'toggle'],
  ['enter', 'next'],
  ['ctrl+c', 'quit'],
];
const TEXT_HINTS: readonly Hint[] = [
  ['enter', 'next'],
  ['ctrl+c', 'quit'],
];
const REVIEW_HINTS: readonly Hint[] = [
  ['↑/↓', 'scroll'],
  ['←/→', 'yes or no'],
  ['enter', 'choose'],
  ['ctrl+c', 'quit'],
];
const READ_HINTS: readonly Hint[] = [
  ['↑/↓', 'scroll'],
  ['enter', 'back to the question'],
];

/**
 * A multiselect starts with its default ticked, so enter takes the default as it does on every
 * other kind (BD-12). `setup`'s clack multiselect starts empty; that screen is unchanged.
 */
async function askChoice(
  state: State,
  question: Question,
  fallback: AnswerValue,
  canGoBack: boolean,
): Promise<AnswerValue> {
  const options = choiceOptions(question, canGoBack);
  const labels = options.map((o) => o.label);
  if (question.kind === 'multiselect') {
    const prompt: MultiSelectPrompt<{ value: string }> = new MultiSelectPrompt({
      ...streams(state),
      options,
      initialValues: Array.isArray(fallback) ? fallback : [],
      render: () =>
        screen(state, {
          ask: question.ask,
          list: labels.map((l, i) => `${ticked(prompt.value, options[i]?.value)} ${l}`),
          cursor: prompt.cursor,
          tail: hintOf(options[prompt.cursor]?.hint),
          hints: MULTI_HINTS,
        }),
    });
    return shown(state, prompt);
  }
  const prompt: SelectPrompt<{ value: string }> = new SelectPrompt({
    ...streams(state),
    options,
    initialValue: typeof fallback === 'string' ? fallback : options[0]?.value,
    render: () =>
      screen(state, {
        ask: question.ask,
        list: labels,
        cursor: prompt.cursor,
        tail: hintOf(options[prompt.cursor]?.hint),
        hints: CHOICE_HINTS,
      }),
  });
  return shown(state, prompt);
}

function ticked(values: string[] | undefined, value: string | undefined): string {
  return value !== undefined && (values ?? []).includes(value) ? '◼' : '◻';
}

function hintOf(hint: string | undefined): string[] {
  return hint === undefined || hint === '' ? [] : [hint];
}

async function askText(
  state: State,
  question: Question,
  fallback: AnswerValue,
): Promise<string> {
  const prompt: TextPrompt = new TextPrompt({
    ...streams(state),
    placeholder: question.placeholder ?? '',
    initialValue: typeof fallback === 'string' ? fallback : '',
    render: () =>
      screen(state, {
        ask: question.ask,
        list: [
          `› ${prompt.userInput === '' ? (question.placeholder ?? '') : prompt.userInputWithCursor}`,
        ],
        cursor: -1,
        tail: [],
        hints: TEXT_HINTS,
      }),
  });
  return shown(state, prompt);
}

async function askConfirm(
  state: State,
  message: string,
  fallback: boolean,
  step: number,
): Promise<boolean> {
  state.step = step;
  const prompt: ConfirmPrompt = new ConfirmPrompt({
    ...streams(state),
    active: 'Yes',
    inactive: 'No',
    initialValue: fallback,
    render: () =>
      screen(state, {
        ask: message,
        list: ['Yes', 'No'],
        cursor: prompt.cursor,
        tail: [],
        hints: CHOICE_HINTS,
      }),
  });
  return shown(state, prompt);
}

async function askPick(state: State, scans: RepoScan[]): Promise<RepoScan[]> {
  state.step = STEP.pick;
  const options = scans.map((s) => ({
    value: s.path,
    label: s.name,
    hint: [...(s.kind === 'folder' ? ['folder'] : []), ...s.languages].join(', '),
  }));
  const prompt: MultiSelectPrompt<{ value: string }> = new MultiSelectPrompt({
    ...streams(state),
    options,
    required: false,
    render: () =>
      screen(state, {
        ask: 'Which repos should be set up?',
        list: options.map((o) => `${ticked(prompt.value, o.value)} ${o.label}`),
        cursor: prompt.cursor,
        tail: hintOf(options[prompt.cursor]?.hint),
        hints: MULTI_HINTS,
      }),
  });
  const chosen = await shown(state, prompt);
  return scans.filter((s) => chosen.includes(s.path));
}

function streams(state: State): { input: Readable; output: Writable } {
  return { input: state.io.input, output: state.io.output };
}

/**
 * One prompt as one screen. What it showed of `setup`'s notes has been read once it is
 * answered, so they go; a cancel leaves through the one cancel path `setup` has.
 */
async function shown<T>(state: State, prompt: Prompt<T>): Promise<T> {
  clearScreen(state.io.output);
  const value = await prompt.prompt();
  if (isCancel(value)) leave();
  state.notes = [];
  return value as T;
}

/** The sink goes back before the message, so `cancelRun()`'s words reach the terminal. */
function leave(): never {
  setSink(null);
  return cancelRun();
}

/**
 * A text the panel cannot hold, read a line at a time. Up and down move it; with `answers`, left
 * and right move between yes and no, and `y` or `n` answers at once, as a clack confirm does.
 */
class ScrollPrompt extends Prompt<boolean> {
  offset = 0;

  constructor(
    io: { input: Readable; output: Writable },
    render: (self: ScrollPrompt) => string,
    maxOffset: () => number,
    answers: boolean | null,
  ) {
    super({ ...io, render: () => render(this) }, false);
    this.value = answers ?? undefined;
    this.on('cursor', (key) => {
      if (key === 'up') this.offset = Math.max(this.offset - 1, 0);
      if (key === 'down') this.offset = Math.min(this.offset + 1, maxOffset());
      if (answers !== null && (key === 'left' || key === 'right')) this.value = !this.value;
    });
    this.on('confirm', (yes) => {
      if (answers === null) return;
      this.value = yes;
      this.state = 'submit';
    });
  }
}

async function scroll(state: State, title: string, text: string): Promise<void> {
  const lines = (inner: number) =>
    text.split('\n').flatMap((l) => (l.trim() === '' ? [''] : wrap(l, inner)));
  const room = () => bodyRoom(state) - 2;
  const prompt = new ScrollPrompt(
    streams(state),
    (self) =>
      draw(
        state,
        state.step,
        [
          state.io.paint.bold(title),
          '',
          ...lines(inner(state)).slice(self.offset, self.offset + room()),
        ],
        READ_HINTS,
      ),
    () => Math.max(lines(inner(state)).length - room(), 0),
    null,
  );
  const notes = state.notes;
  await shown(state, prompt);
  state.notes = notes;
}

/**
 * The review step (BD-5): the preview `finish()` said, and any diffs `confirmBatch()` noted, in
 * a scroll view above the confirm. The notes stay for the second confirm; after the write
 * confirm, what `setup` says next is the run's result.
 */
async function review(state: State, message: string, fallback: boolean): Promise<boolean> {
  if (narrow(state)) return flushed(state, () => clackPrompter().confirm(message, fallback));
  state.step = STEP.review;
  const log = trimmed(state.notes);
  const room = () => bodyRoom(state) - 6;
  const prompt = new ScrollPrompt(
    streams(state),
    (self) =>
      reviewScreen(
        state,
        message,
        log.slice(self.offset, self.offset + room()),
        self.value === true,
      ),
    () => Math.max(log.length - room(), 0),
    fallback,
  );
  clearScreen(state.io.output);
  const value = await prompt.prompt();
  if (isCancel(value)) leave();
  state.confirms += 1;
  if (value === true && state.confirms >= 2) startWrite(state, message);
  return value === true;
}

function reviewScreen(state: State, message: string, window: string[], yes: boolean): string {
  const { paint } = state.io;
  return draw(
    state,
    STEP.review,
    [
      heading(
        paint,
        SETUP_STEPS[STEP.review] ?? '',
        STEP.review + 1,
        SETUP_STEPS.length,
        inner(state),
      ),
      '',
      ...window,
      '',
      paint.bold(message),
      ...choices(paint, ['Yes', 'No'], yes ? 0 : 1),
    ],
    REVIEW_HINTS,
  );
}

/**
 * `commitPlan()` reports nothing until it returns (F6), so the write step is one screen, drawn
 * when the write is confirmed and replaced by the done screen when `setup` returns (BD-6).
 */
function startWrite(state: State, message: string): void {
  state.wrote = true;
  state.notes = [];
  const { paint } = state.io;
  const body = [
    heading(
      paint,
      SETUP_STEPS[STEP.write] ?? '',
      STEP.write + 1,
      SETUP_STEPS.length,
      inner(state),
    ),
    '',
    paint.muted(message),
  ];
  drawScreen(draw(state, STEP.write, body, []), state.io.output);
}

/** D4's six log lines: the last of what the write said, then where to go next (BD-11). */
function doneScreen(state: State): string {
  const { paint } = state.io;
  const next: Array<[string, string]> = [
    ['personal-config init', 'set up one more folder'],
    ['personal-config doctor', 'check what was written'],
    ['personal-config undo', 'put back what this run changed'],
  ];
  return draw(
    state,
    STEP.done,
    [
      heading(paint, 'Setup is done', STEP.done + 1, SETUP_STEPS.length, inner(state)),
      '',
      ...trimmed(state.notes)
        .filter((l) => l.trim() !== '')
        .slice(-6),
      '',
      paint.bold('Next'),
      ...next.flatMap(([command, does]) => [paint.ink(command), paint.muted(`  ${does}`)]),
    ],
    [],
  );
}

/** A run that ends without writing (declined, already current) leaves its own words on screen. */
function endScreen(state: State): string {
  const { paint } = state.io;
  const said = trimmed(state.notes);
  const title = SETUP_STEPS[state.step] ?? '';
  return draw(
    state,
    state.step,
    [
      heading(paint, title, state.step + 1, SETUP_STEPS.length, inner(state)),
      '',
      ...said.slice(-(bodyRoom(state) - 2)),
    ],
    [],
  );
}

function trimmed(lines: string[]): string[] {
  const start = lines.findIndex((l) => l.trim() !== '');
  return start === -1 ? [] : lines.slice(start);
}

type Ask = {
  ask: string;
  list: string[];
  cursor: number;
  tail: string[];
  hints: readonly Hint[];
};

/** A question's panel: the step, `setup`'s notes, the question, its options and the focused hint. */
function screen(state: State, spec: Ask): string {
  const { paint } = state.io;
  const width = inner(state);
  const list = spec.cursor < 0 ? spec.list : choices(paint, spec.list, spec.cursor);
  const top = [heading(paint, stepTitle(state), state.step + 1, SETUP_STEPS.length, width), ''];
  const ask = wrap(spec.ask, width).map((l) => paint.bold(l));
  const hint = spec.tail.flatMap((t) => wrap(t, width)).map((l) => paint.muted(l));
  const tail = hint.length > 0 ? ['', ...hint] : [];
  return draw(
    state,
    state.step,
    fitted(state, top, trimmed(state.notes), ask, list, spec.cursor, tail),
    spec.hints,
  );
}

/** The repo's name beside its step, from the picked list (BD-7). */
function stepTitle(state: State): string {
  const title = SETUP_STEPS[state.step] ?? '';
  if (state.step !== STEP.repo) return title;
  const name = state.repo.names[state.repo.index - 1];
  return name === undefined ? title : `${title} · ${name}`;
}

/**
 * Everything that fits, in this order of giving way: `setup`'s notes keep their last lines, then
 * the option list is windowed round the cursor. The question itself is never cut.
 */
function fitted(
  state: State,
  top: string[],
  notes: string[],
  ask: string[],
  list: string[],
  cursor: number,
  tail: string[],
): string[] {
  const max = bodyRoom(state);
  const fixed = top.length + ask.length + tail.length + 1;
  const listRoom = Math.max(max - fixed, 1);
  const shownList =
    list.length <= listRoom ? list : around(list, Math.max(cursor, 0), listRoom);
  const notesRoom = max - fixed - shownList.length - 1;
  const shownNotes =
    notesRoom > 0 ? notes.slice(-notesRoom).map((n) => state.io.paint.muted(n)) : [];
  return [
    ...top,
    ...shownNotes,
    ...(shownNotes.length > 0 ? [''] : []),
    ...ask,
    '',
    ...shownList,
    ...tail,
  ];
}

function around(list: string[], cursor: number, room: number): string[] {
  const start = Math.min(Math.max(cursor - Math.floor(room / 2), 0), list.length - room);
  return list.slice(start, start + room);
}

/** The panel's text rows: the terminal less the header, the box's four and the key hints. */
function bodyRoom(state: State): number {
  return Math.max(state.io.size().rows - 9, 6);
}

function inner(state: State): number {
  const { columns, rows } = state.io.size();
  return panelInner(columns, showsRail(columns, rows));
}

function draw(state: State, current: number, body: string[], hints: readonly Hint[]): string {
  const { columns, rows } = state.io.size();
  const labels = [...SETUP_STEPS];
  if (state.repo.names.length > 0) {
    labels[STEP.repo] =
      `Each repo (${Math.max(state.repo.index, 1)} of ${state.repo.names.length})`;
  }
  return frame(state.io.paint, {
    view: 'setup',
    where: state.io.where,
    columns,
    rows,
    body,
    edge: 'ink',
    hints,
    steps: { labels, current },
  });
}
