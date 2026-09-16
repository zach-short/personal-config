import { parseArgs } from 'node:util';
import type { Cli } from './types.ts';

const COMMANDS = [
  'setup',
  'catalog',
  'doctor',
  'undo',
  'archive',
  'passoff',
  'handoff',
  'worktree',
  'context',
  'help',
  'version',
] as const;

export function parseCli(argv: string[]): Cli {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      profile: { type: 'string' },
      yes: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      fix: { type: 'boolean', default: false },
      move: { type: 'boolean', default: false },
      'projects-dir': { type: 'string' },
      from: { type: 'string' },
      sentinel: { type: 'string' },
      help: { type: 'boolean', default: false },
      version: { type: 'boolean', default: false },
    },
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
    projectsDir: values['projects-dir'] ?? null,
    from: values.from ?? null,
    sentinel: values.sentinel ?? null,
    paths: rest,
  };
}

function resolveCommand(first: string | undefined, help: boolean, version: boolean): string {
  if (version) return 'version';
  if (help || first === undefined) return 'help';
  return (COMMANDS as readonly string[]).includes(first) ? first : 'help';
}
