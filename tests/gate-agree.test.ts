import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { gateAgree } from '../src/doctor/rules/gate-agree.ts';
import { home } from '../src/lib/paths.ts';
import { cleanup, tempDir, WK_LAND_STEP } from './helpers.ts';

// `~/.wk` sits under `$HOME`, which `tests/preload.ts` points at a sandbox (X2).
afterEach(async () => {
  await rm(join(home(), '.wk'), { recursive: true, force: true });
});

async function withRepo(
  gateCommand: string | null,
  toml: string,
  answers = WK_LAND_STEP,
): Promise<ReturnType<typeof gateAgree>> {
  const dir = await tempDir();
  try {
    const config = gateCommand === null ? {} : { gateCommand };
    await Bun.write(join(dir, '.personal-config.json'), `${JSON.stringify(config, null, 2)}\n`);
    await mkdir(join(home(), '.wk'), { recursive: true });
    await Bun.write(join(home(), '.wk', `${basename(dir)}.toml`), toml);
    return await gateAgree(dir, answers);
  } finally {
    await cleanup(dir);
  }
}

// The same four gates in each file's own shape: an env assignment and an `sh -c` around the
// command string, a `$(gofmt …)` inside `test -z` on one side and inside an assignment on the
// other, flags on one side only, and a `run` array that spans lines.
const COMMAND =
  "GOTOOLCHAIN=local sh -c 'test -z $(gofmt -l .) && go vet ./... && go test -race -count=1 ./... && golangci-lint run ./...'";

const TOML = `[landing]
enabled = true

[gates.env]
GOTOOLCHAIN = "local"

[[gates.run]]
name = "gofmt"
run = ["sh", "-c", 'out=$(gofmt -l .); printf "%s\\n" "$out"; test -z "$out"']

[[gates.run]]
name = "vet" # the cheap one
run = ["go", "vet", "./..."]

[[gates.run]]
name = "test"
run = [
  "go", "test", "./...",
]

[[gates.run]]
name = "lint"
run = ["golangci-lint", "run", "./..."]
`;

describe('gate-agree', () => {
  test('flags a gate in each file that the other lacks', async () => {
    const command = 'go vet ./... && go test ./... && go build ./...';
    const found = await withRepo(command, TOML);
    const messages = found.map((f) => f.message);
    expect(messages).toHaveLength(3);
    expect(messages.some((m) => m.includes('"gofmt"') && m.includes('`gofmt`'))).toBe(true);
    expect(
      messages.some((m) => m.includes('"lint"') && m.includes('`golangci-lint run`')),
    ).toBe(true);
    expect(messages.some((m) => m.includes('gateCommand runs `go build`'))).toBe(true);
    expect(found.every((f) => f.advisory === true)).toBe(true);
    expect(found.find((f) => f.message.includes('"lint"'))?.line).toBe(21);
  });

  test('passes the same gates written in the two shapes', async () => {
    expect(await withRepo(COMMAND, TOML)).toEqual([]);
  });

  test('reads a multi-line literal script as its gate, not its plumbing', async () => {
    const toml = `[[gates.run]]
name = "suites"
run = ["sh", "-c", '''go test -v ./... > out.log 2>&1 || { tail -80 out.log; exit 1; }; if grep -- '--- SKIP' out.log | grep -v 'TestLive'; then exit 1; fi''']
`;
    expect(await withRepo('cd backend && go test -race ./...', toml)).toEqual([]);
  });

  test('says nothing without a gateCommand', async () => {
    expect(await withRepo(null, TOML)).toEqual([]);
  });

  test('says nothing for a profile that does not set landStep wk', async () => {
    expect(await withRepo('bun test', TOML, {})).toEqual([]);
  });
});
