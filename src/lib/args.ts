import { parseArgs } from 'node:util';
import { DEFAULT_KEEP } from './fold.ts';
import type { Cli } from './types.ts';

const COMMANDS = [
  'setup',
  'catalog',
  'doctor',
  'undo',
  'archive',
  'fold',
  'passoff',
  'handoff',
  'worktree',
  'context',
  'help',
  'version',
] as const;

type Command = (typeof COMMANDS)[number];

/**
 * One definition, read by both the parser and the validator, so the set of flags `checkUsage`
 * judges cannot drift from the set `parseCli` accepts.
 */
const OPTIONS = {
  profile: { type: 'string' },
  yes: { type: 'boolean', default: false },
  'dry-run': { type: 'boolean', default: false },
  force: { type: 'boolean', default: false },
  fix: { type: 'boolean', default: false },
  move: { type: 'boolean', default: false },
  keep: { type: 'string' },
  'projects-dir': { type: 'string' },
  from: { type: 'string' },
  sentinel: { type: 'string' },
  help: { type: 'boolean', default: false },
  version: { type: 'boolean', default: false },
} as const;

export function parseCli(argv: string[]): Cli {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: OPTIONS,
  });

  const [first, ...rest] = positionals;
  return {
    command: resolveCommand(first, values.help === true, values.version === true),
    profile: values.profile ?? 'starter',
    yes: values.yes === true,
    dryRun: values['dry-run'] === true,
    force: values.force === true,
    fix: values.fix === true,
    move: values.move === true,
    keep: keepValue(values.keep) ?? DEFAULT_KEEP,
    projectsDir: values['projects-dir'] ?? null,
    from: values.from ?? null,
    sentinel: values.sentinel ?? null,
    paths: rest,
  };
}

/**
 * Whether this argv is usable — a message to print, or `null` to proceed. Kept apart from
 * `parseCli` so that function keeps the one total signature every command and test already
 * builds on. `parseArgs` runs here too; it costs microseconds once per process, and it is what
 * lets `cli.ts` call `parseCli` afterwards knowing it cannot throw.
 */
export function checkUsage(argv: string[]): string | null {
  let positionals: string[];
  try {
    positionals = parseArgs({
      args: argv,
      allowPositionals: true,
      options: OPTIONS,
    }).positionals;
  } catch (error) {
    return optionProblem(error);
  }

  const [first] = positionals;
  if (first === undefined || isCommand(first)) return keepProblem(argv);
  return commandProblem(first);
}

/**
 * `--keep` is parsed as a string because `parseArgs` has no integer type, so the one thing it
 * cannot catch is the one mistake worth catching: `--keep all` would otherwise fall through to
 * the default and quietly fold fifty steps the person meant to keep.
 */
function keepProblem(argv: string[]): string | null {
  const raw = parseArgs({ args: argv, allowPositionals: true, options: OPTIONS }).values.keep;
  if (raw === undefined || keepValue(raw) !== null) return null;
  return [
    `personal-config: --keep needs a whole number of steps, not '${raw}'`,
    '',
    'Run `personal-config --help` to see the options it takes.',
  ].join('\n');
}

function keepValue(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * `parseArgs` throws for an unknown flag and for one missing its value, and its text names both
 * precisely — "Unknown option '--dryrun'", "Option '--profile <value>' argument missing". What it
 * then appends is advice about `--` that fits no mistake a person makes here, so only the first
 * sentence is kept and `--help` replaces the rest. Letting the throw escape printed a TypeError
 * with source frames and install paths at the first flag a stranger mistyped.
 */
function optionProblem(error: unknown): string {
  const text = error instanceof Error ? error.message : '';
  const detail = text.split('. ')[0] ?? '';
  return [
    `personal-config: ${detail === '' ? 'could not read those arguments' : detail}`,
    '',
    'Run `personal-config --help` to see the options it takes.',
  ].join('\n');
}

/**
 * Every command is listed rather than guessed at, because there are nine of them and a list
 * cannot be wrong where a suggestion can. `help` and `version` are left out to match the help
 * text, which presents them as flags.
 */
function commandProblem(token: string): string {
  const runnable = COMMANDS.filter((name) => name !== 'help' && name !== 'version');
  return [
    `personal-config: unknown command '${token}'`,
    '',
    `Commands: ${runnable.join(', ')}`,
    'Run `personal-config --help` for what each one does.',
  ].join('\n');
}

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

function resolveCommand(first: string | undefined, help: boolean, version: boolean): string {
  if (version) return 'version';
  if (help || first === undefined) return 'help';
  return isCommand(first) ? first : 'help';
}
