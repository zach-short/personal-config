# 6. CI, and the web test glob

*Opened 2026-09-02, out of the owner asking for CI before any second contributor.*

**Model: Default. Lane A. Waits on nothing.**

You are picking up leaflet, a Go + TypeScript link shortener. Read `HANDOFF.md` first, then
`docs/AGENT-PRACTICES.md` in full, then `.github/` and `web/package.json`.

**Why this exists.** Every gate is run by hand, so a session that forgets one ships a change no
gate saw. CI runs the same four gates on every push to `main`.

Do these, in order:

1. **Run every gate by hand first** and quote its output, so the CI job has a known-good result
   to match.
2. **Write `.github/workflows/ci.yml`** with build, test, lint and typecheck, one job each.
3. **Record it.** Write this file's close-out section, add one log line to `HANDOFF.md`, and mark
   the row `DONE - <date>`.

**Hand back:** the first green CI run's URL, and `git status --short` with the two commit blocks.

## Close-out, 2026-09-08

Done 2026-09-08, Default tier, on `main`, commit `5b1e0d4`. Added `.github/workflows/ci.yml`
with build, test, lint and typecheck. Running the gates by hand first found the web test command
exiting 0 having run nothing since 2026-09-02, because its glob matched no file. Fixing the glob
turned up two failing tests in the shared lib, both fixed here. The ledger's "Gates that lie" now
names the command and says to read the test count, not the exit code. **Left owed:** the
dashboard screens have no tests of their own, only the shared lib does (item 3).
