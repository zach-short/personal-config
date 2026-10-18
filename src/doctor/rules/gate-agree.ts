import { basename, join } from 'node:path';
import { exists, readText } from '../../lib/disk.ts';
import { contractHome } from '../../lib/paths.ts';
import { readGateCommand } from '../../lib/repo-config.ts';
import type { Answers, Finding } from '../../lib/types.ts';
import { wkConfigFile } from './wk-config.ts';

/**
 * A repo that lands through wk keeps its gate twice: `gateCommand` in `.personal-config.json`,
 * which the completion-gate hook runs on every stop, and the `[[gates.run]]` list in
 * `~/.wk/<repo>.toml`, which wk runs before it moves `main`. Nothing makes the two agree, so a
 * check added to one is silently missing from the other (gate-contract scope, option C1).
 *
 * The two have different shapes, one shell string and a list of argument vectors, so the
 * comparison is approximate on purpose. Each side is reduced to command words (`go vet`,
 * `golangci-lint run`, `bun run lint`, `gofmt`), and a word list on one side with no match on
 * the other is reported. Every doubt resolves toward silence: a missed warning costs one stale
 * gate, and a false one teaches the owner to stop reading this rule. That is also why the
 * finding is advisory, not failing.
 */
export async function gateAgree(root: string, answers: Answers): Promise<Finding[]> {
  if (answers.landStep !== 'wk') return [];
  const command = (await readGateCommand(root))?.trim() ?? '';
  const file = await wkConfigFile(root);
  // No `gateCommand` turns the completion gate off, which is a different question from two
  // gates that disagree; a missing toml or an empty gate list is `wk-config`'s finding.
  if (command === '' || !(await exists(file))) return [];
  const gates = readGates(await readText(file));
  if (gates.length === 0) return [];
  const configFile = join(root, '.personal-config.json');
  const configLine = lineOf(await readText(configFile), '"gateCommand"');
  const steps = scriptSignatures(command);
  const wkWords = gates.flatMap((gate) => gate.signatures);
  return [
    ...gates.flatMap((gate) => wkOnly(gate, steps, file)),
    ...unmatched(steps, wkWords).map((words) =>
      advisory(
        configFile,
        configLine,
        `gateCommand runs \`${words}\`, which no [[gates.run]] in ${contractHome(file)} runs`,
      ),
    ),
  ];
}

type Gate = { name: string; line: number; signatures: string[] };

function wkOnly(gate: Gate, steps: string[], file: string): Finding[] {
  return unmatched(gate.signatures, steps).map((words) =>
    advisory(
      file,
      gate.line,
      `wk gate "${gate.name}" runs \`${words}\`, which gateCommand in .personal-config.json does not`,
    ),
  );
}

function unmatched(mine: string[], theirs: string[]): string[] {
  return [...new Set(mine)].filter(
    (words) => !theirs.some((other) => sameCommand(words, other)),
  );
}

/**
 * One word list matches another when either is a prefix of the other, so `pytest` matches
 * `pytest tests` and `go test` matches `go test`, whatever flags each passes. Flags, paths and
 * `./...` are already gone by now, and comparing them would flag `-count=1` on one side only.
 */
function sameCommand(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long === short || long.startsWith(`${short} `);
}

function advisory(file: string, line: number, message: string): Finding {
  return {
    rule: 'gate-agree',
    standardId: null,
    file,
    line,
    message,
    fixable: false,
    advisory: true,
  };
}

function lineOf(text: string, needle: string): number {
  const index = text.split('\n').findIndex((line) => line.includes(needle));
  return index === -1 ? 1 : index + 1;
}

/**
 * The `[[gates.run]]` tables, read line by line the way `wk-config` reads its two facts: each
 * table's `name`, the line its header sits on, and the command words of its `run` vector. A
 * `run` array may span lines, so its text is gathered until the array closes.
 */
function readGates(text: string): Gate[] {
  const state: Reading = { gates: [], current: null, pending: null };
  for (const [index, raw] of text.split('\n').entries()) readLine(state, raw, index + 1);
  return state.gates;
}

/** The gates so far, the table being read if it is a gate, and a `run` array still open. */
type Reading = { gates: Gate[]; current: Gate | null; pending: string | null };

function readLine(state: Reading, raw: string, line: number): void {
  if (state.current && state.pending !== null) {
    state.pending = gatherRun(state.current, `${state.pending}\n${raw}`);
    return;
  }
  const header = /^\s*(\[\[?)\s*([^\]]+?)\s*\]/.exec(raw);
  if (header) {
    state.current = header[1] === '[[' && header[2] === 'gates.run' ? newGate(line) : null;
    if (state.current) state.gates.push(state.current);
  } else if (state.current) state.pending = readKey(state.current, raw);
}

function newGate(line: number): Gate {
  return { name: `line ${line}`, line, signatures: [] };
}

/** Sets `name`, or starts a `run` array; answers the array text still open, else null. */
function readKey(gate: Gate, raw: string): string | null {
  const name = /^\s*name\s*=\s*(["'])(.*?)\1/.exec(raw);
  if (name) gate.name = name[2] ?? gate.name;
  const run = /^\s*run\s*=\s*\[(.*)$/.exec(raw);
  return run ? gatherRun(gate, run[1] ?? '') : null;
}

function gatherRun(gate: Gate, text: string): string | null {
  const { items, closed } = scanArray(text);
  if (!closed) return text;
  gate.signatures = signatures(items);
  return null;
}

/** The strings of a TOML array, read from just after its `[`, and whether its `]` was seen. */
function scanArray(text: string): { items: string[]; closed: boolean } {
  const items: string[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (ch === ']') return { items, closed: true };
    if (ch === '#') i = endOfLine(text, i);
    else if (ch === '"' || ch === "'") {
      const [value, next] = quoted(text, i);
      items.push(value);
      i = next;
    } else i += 1;
  }
  return { items, closed: false };
}

function endOfLine(text: string, from: number): number {
  const end = text.indexOf('\n', from);
  return end === -1 ? text.length : end;
}

/**
 * A quoted string starting at `start`, and the index after its closing quote. Double quotes
 * take a backslash escape and single quotes do not, which holds for TOML and for the shell.
 */
function quoted(text: string, start: number): [string, number] {
  const quote = text[start] ?? '';
  if (text.startsWith(quote.repeat(3), start)) return tripleQuoted(text, start);
  let value = '';
  let i = start + 1;
  while (i < text.length && text[i] !== quote) {
    const escaped = quote === '"' && text[i] === '\\' && i + 1 < text.length;
    value += escaped ? escapedChar(text[i + 1] ?? '') : (text[i] ?? '');
    i += escaped ? 2 : 1;
  }
  return [value, i + 1];
}

function escapedChar(ch: string): string {
  return ch === 'n' ? '\n' : ch === 't' ? '\t' : ch;
}

/**
 * TOML's multi-line strings, read raw. A `'''` script can hold single quotes, and a wk gate
 * that runs an `sh -c` script with quoted arguments needs exactly that.
 */
function tripleQuoted(text: string, start: number): [string, number] {
  const triple = (text[start] ?? '').repeat(3);
  const end = text.indexOf(triple, start + 3);
  const close = end === -1 ? text.length : end;
  return [text.slice(start + 3, close), close + 3];
}

// What a shell step joins on. A pipe splits too: `a | tee log` is a gate `a` and a noise word.
const OPERATORS = ['&&', '||', ';', '|', '\n'];

/** Shell words, with quotes removed and each `$( … )` kept whole as one word or part of one. */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let word = '';
  for (let i = 0; i < text.length; ) {
    const gap = gapAt(text, i);
    if (gap === null) {
      const [piece, next] = pieceAt(text, i);
      word += piece;
      i = next;
      continue;
    }
    if (word !== '') tokens.push(word);
    if (gap.op !== null) tokens.push(gap.op);
    word = '';
    i += gap.length;
  }
  if (word !== '') tokens.push(word);
  return tokens;
}

/** An operator or a blank at `i`, which ends the word being read; null inside a word. */
function gapAt(text: string, i: number): { op: string | null; length: number } | null {
  const op = OPERATORS.find((each) => text.startsWith(each, i));
  if (op !== undefined) return { op, length: op.length };
  return /\s/.test(text[i] ?? '') ? { op: null, length: 1 } : null;
}

function pieceAt(text: string, i: number): [string, number] {
  const ch = text[i] ?? '';
  if (ch === '"' || ch === "'") return quoted(text, i);
  if (text.startsWith('$(', i)) {
    const end = closingParen(text, i + 2);
    return [text.slice(i, end + 1), end + 1];
  }
  if (ch === '\\') return [text[i + 1] ?? '', i + 2];
  return [ch, i + 1];
}

/** The index of the `)` that closes a `(` opened just before `from`, or the text's end. */
function closingParen(text: string, from: number): number {
  let depth = 1;
  for (let i = from; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') depth -= 1;
    if (depth === 0) return i;
  }
  return text.length;
}

function steps(tokens: string[]): string[][] {
  const result: string[][] = [[]];
  for (const token of tokens) {
    if (OPERATORS.includes(token)) result.push([]);
    else result.at(-1)?.push(token);
  }
  return result.filter((step) => step.length > 0);
}

function scriptSignatures(script: string): string[] {
  return steps(tokenize(script)).flatMap(signatures);
}

/**
 * The command words one step runs: its own command, and every `$( … )` inside it, since
 * `test -z $(gofmt -l .)` and `out=$(gofmt -l .)` are both a gofmt gate in the shell's clothes.
 */
function signatures(words: string[]): string[] {
  const nested = words.flatMap(substitutions).flatMap(scriptSignatures);
  return [...new Set([...nested, ...ownSignature(words)])];
}

function substitutions(word: string): string[] {
  const found: string[] = [];
  for (let at = word.indexOf('$('); at !== -1; at = word.indexOf('$(', at + 2)) {
    found.push(word.slice(at + 2, closingParen(word, at + 2)));
  }
  return found;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
// Commands that only carry another command, and are dropped to reach it.
// Shell keywords lead into a command too, so `if echo "$out" | grep -q x; then exit 1; fi` is
// the noise it looks like and not a gate called `if`.
const CARRIERS = new Set([
  'env',
  'command',
  'exec',
  'time',
  'nohup',
  '!',
  'if',
  'then',
  'else',
  'elif',
  'while',
  'until',
  'do',
  '{',
  '(',
]);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash']);
// Commands that print, test or move, and so name no gate. A step of only these is not a gate.
const NOISE = new Set([
  'test',
  '[',
  '[[',
  'printf',
  'echo',
  'true',
  'false',
  ':',
  'cd',
  'exit',
  'set',
  'export',
  'tee',
  'cat',
  'fi',
  'done',
  '}',
  ')',
  'head',
  'tail',
  // A filter in a pipe more often than a gate of its own; a missed `! grep` gate is the cheaper error.
  'grep',
]);

function ownSignature(words: string[]): string[] {
  const rest = unwrap(words);
  const program = basename(rest[0] ?? '');
  if (program === '' || NOISE.has(program)) return [];
  const shellScript = SHELLS.has(program) ? scriptAfterC(rest) : null;
  if (shellScript !== null) return scriptSignatures(shellScript);
  return [[program, ...subcommands(rest.slice(1))].join(' ')];
}

/**
 * Drops leading assignments, carriers and their flags, and a `wk run … --` slot wrapper. A
 * leading word with a `-` can only be a carrier's flag (`env -i`, `time -p`), never a program.
 */
function unwrap(words: string[]): string[] {
  let rest = words;
  while (rest.length > 0) {
    const first = rest[0] ?? '';
    if (ASSIGNMENT.test(first) || first.startsWith('-') || CARRIERS.has(basename(first))) {
      rest = rest.slice(1);
    } else if (basename(first) === 'wk' && rest[1] === 'run' && rest.includes('--')) {
      rest = rest.slice(rest.indexOf('--') + 1);
    } else break;
  }
  return rest;
}

/** The script of `sh -c '…'`, also spelled `-ec` or `-lc`; null for a shell running a file. */
function scriptAfterC(words: string[]): string | null {
  const flag = words.findIndex((word) => /^-[a-z]*c$/.test(word));
  return flag === -1 ? null : (words[flag + 1] ?? null);
}

/**
 * Up to two plain words after the program: enough for `bun run lint` and `golangci-lint run`.
 * The first flag, path or `./...` ends it, so `go test -race ./...` is `go test`.
 */
function subcommands(args: string[]): string[] {
  const end = args.findIndex((arg) => !/^[A-Za-z][\w:-]*$/.test(arg));
  return args.slice(0, end === -1 ? 2 : Math.min(end, 2));
}
