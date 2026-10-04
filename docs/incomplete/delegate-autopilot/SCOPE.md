# Scope: `/delegate` and `/autopilot` as skills the tool installs

Ship the skill that runs one board row through a builder and an auditor (`/delegate`), and the
loop that runs the whole board unattended until it is done or the budget is spent (`/autopilot`).

**Status.** RATIFIED 2026-10-03. Opened 2026-10-03, Opus 5.5, board row 80. Gate answered in
full on 2026-10-03; the answers are in section 7. Sections 1 to 6 are the scope as it went to the
gate and are not edited to match the answers.

**Calls already given, 2026-10-03 (do not re-ask).**

- **The names.** `/delegate` and `/autopilot`.
- **Both are products of this tool**, not personal skills. Zach, in chat, recorded in `PASSOFF.md`
  item 80.
- **This session scopes only.** No skill is built here.

## 1. What exists, verified 2026-10-03

Every row was checked by this session on 2026-10-03. Times in the overnight rows are EDT, read
from the transcript's UTC timestamps minus four hours. Tool counts in that transcript are
de-duplicated by `tool_use` id, because each call appears on two lines of the file.

### The engine

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G1 | The tool ships five skills | `SKILLS = ['close-out', 'scope', 'passoff', 'handoff', 'clean-up']`. Each renders from `templates/skills/<name>.md` to `~/.claude/skills/<name>/SKILL.md`, stamped below its frontmatter | `src/render/skills.ts:17`, `:56-63` |
| G2 | Which tracks get which skills | Light gets `close-out` and `handoff`. The short track that is not light (non-code, full) drops `clean-up`. Code, full gets all five | `src/render/skills.ts:24`, `:45-48` |
| G3 | Track helpers | A board exists only on the full weight. The short track is non-code or light. Git is its own axis, `usesGit` | `src/render/context.ts:77-99` |
| G4 | The `skills` question | Two values, `all` (recommended) and `none`. The `all` label names the five skills. The renderer also accepts an array from a profile, but the question offers no subset | `src/questions/you.ts:383-403`, `src/render/skills.ts:50-54` |
| G5 | Profiles | `starter` and `pro` answer `skills: none`; `zach` answers `all` | `profiles/starter.json:23`, `profiles/pro.json:27`, `profiles/zach.json:27` |
| G6 | The precedent for a new skill | `dfdae1f`, 2026-09-29, "add /clean-up skill": ten files, including `tests/clean-up-skill.test.ts` (114 lines), `tests/golden/full-track.json` and `tests/tracks.test.ts`, which pins five skill files on code, full | `git show --stat dfdae1f`, `tests/tracks.test.ts:281` |
| G7 | No skill named `delegate` or `autopilot` in the engine | `grep -rni delegate src templates` matches the model-routing answer `delegate-or-stop` (`src/questions/you.ts:255`, `src/render/rules.ts:117,127`), the tier-ceiling clause and banner (`src/render/repo.ts:179-196`, `templates/hooks/session-banner.sh:16`), `src/render/ceiling.ts:11`, `src/questions/discover.ts:247`, and two comments (`src/doctor/scan.ts:48`, `src/doctor/rules/tier-ceiling.ts:7`). `grep -rni autopilot src templates docs/choices profiles standard catalog.json README.md tests` prints nothing | run 2026-10-03 |
| G8 | Nothing in the engine names the loop tools | `grep -rniE "ScheduleWakeup\|/loop\b\|get_usage" src templates docs/choices standard` prints nothing | run 2026-10-03 |
| G9 | The rendered model-routing rule forbids a Deep builder | Under `delegate-or-stop` (the recommended answer) the rule says a build is handed off, not delegated, and "a Deep subagent never builds". It is written on the full weight unless `modelRouting` is `skip` | `src/render/rules.ts:109-111`, `:127-143` |
| G10 | Tier names are free text | `models.deep`, `models.default`, `models.fast`, `models.light`. The Agent-family IDs (`modelIds.*`) are asked only when a tier ceiling is set | `src/questions/you.ts:161-245`, `src/questions/discover.ts:259-285` |
| G11 | The short standard has none of Parts 4 to 7 | It has one model line ("The model for work here is ..."), a proof line in place of gates, and no subagent table, relay contract or worktree recipe | `standard/AGENT-PRACTICES.short.md:104-183` |
| G12 | The two commands the personal skill calls exist | `personal-config passoff claim <n>`; `personal-config context --sentinel`, which refuses without a sentinel | `src/commands/passoff.ts:146`, `src/commands/context.ts:9,22-23` |
| G13 | Commit policy | `print-blocks`, `agent-commits`, `no-rule`. Row 78 (`OPEN`) records that the recommended commit guard blocks the commits `agent-commits` tells the agent to make | `src/questions/you.ts:93-115`, `PASSOFF.md:88` |
| G14 | The stamp guard keeps an unstamped file | A file on disk with no stamp is refused, not overwritten (`guard: 'no-stamp'`) | `src/lib/write-plan.ts:15-20`, `:74-77` |
| G15 | The build shares three files with rows 77 to 79 | `catalog.json`, `README.md`, `CHANGELOG.md`, all three rows `OPEN` | `PASSOFF.md:87-90` |

### The personal `/delegate`

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G16 | It is hand-written and unstamped | `~/.claude/skills/delegate/SKILL.md`: 87 lines, 5,364 bytes, modified 2026-09-17 02:28, no `personal-config v` stamp | `wc`, `stat`, `head` |
| G17 | Its steps | 0 preconditions (cleared GATE 1 or GATE 2; open owner questions asked first); 1 read and claim; 2 build in a subagent, worktree, the row's driver, the Part 5 relay contract appended; 3 audit in a second subagent in its own worktree, Deep only for a load-bearing row; 4 sign off through `/close-out`, or two fix rounds and then land early; 5 several rows at once only across lanes with no shared files | the file, lines 13-76 |
| G18 | It carries no personal string | `grep -niE "zach\|~/Projects\|/Users/"` on it prints nothing | run 2026-10-03 |
| G19 | It is not yet generic | It names `fable`, `opus` and `sonnet` directly (`:32-33`). It cites "Parts 4-7" and "Part 5's budget-relay contract" (`:10`, `:35`), which the short standard does not have (G11). Step 2 builds with the row's driver, so a Deep row gets a Deep builder, against G9 | the file |
| G20 | It has been used once on this repo | HANDOFF 92: row 74, Opus 5.5 builder and Opus 5.5 auditor from a Sonnet 5.5 session, two builder passes (the first stopped on a worktree base four commits stale), not committed in that step | `HANDOFF.md:1456` |

### The overnight run, ezhomesteading, 2026-10-03

Source: transcript `~/.claude/projects/-Users-zachshort-Projects-ezhomesteading/f65b3c49-a89b-4b33-9cf4-63a566ad09a4.jsonl`
and the records in `~/Projects/archive/ezhomesteading/overnight-2026-10-03/`.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G21 | The ask | 00:15:12, Zach: delegate as many agents as possible, launch the next when one returns, do not stop, work in worktrees, give a rundown of judgment calls; one opening round of questions, then none; compact at about 500k "if you can self-compact" | transcript |
| G22 | One question round, then the loop | 00:17:09, one `AskUserQuestion` (the usage cap and the money rows' design picks). 00:19:01, `Skill` `loop` with no interval, so dynamic mode; its prompt reads the state file at `/private/tmp/.../scratchpad/orchestrator-state.md` on every wake | transcript |
| G23 | Tool calls, 00:00 to 06:23 | 48 `Agent` (27 opus, 17 fable, 4 sonnet), 27 `ScheduleWakeup` (26 wakes and 1 stop; delays 480, 1200, 1500, 1800 and 3600 s), 17 `SendMessage`, 14 `mcp__ccd_session_mgmt__get_usage`, 1 `AskUserQuestion`, 1 `PushNotification` | transcript, de-duplicated |
| G24 | The timer kept the run alive | Launch freeze at 01:20 (5-hour window at 75%). At 02:00 only one review was in flight; all agents had returned by 02:10. Wakes at 01:57, 02:00, 03:01, 04:02 (3600 s), 05:03 (480 s), 05:15. Fix rounds, both landing rehearsals and the client perf work came after 05:10 | transcript; `orchestrator-state.md`, Queue section |
| G25 | The end | 06:22:57 `ScheduleWakeup` with `stop: true`; 06:22:58 `PushNotification`. Context at the stop: 767,008 tokens on `claude-opus-5-5` | transcript |
| G26 | No automatic compaction | Both compactions are `manual`: 07:46 (776,070 tokens before) and 09:54 (504,727). The session ran `opus[1m]` | transcript `compact_boundary` records; `~/.claude/settings.json:11` |
| G27 | Context against the standard's ceiling | The orchestrator passed 300k at 00:47, 400k at 01:15, 600k at 05:13 and 700k at 05:53. Part 5's Default ceiling is ~400k, landing from ~300k, measured 2026-08-16 | transcript usage records; `standard/AGENT-PRACTICES.boilerplate.md`, Part 5 |
| G28 | What it left | One worktree per row, uncommitted, with commit blocks; one ledger step for the whole run (ezhomesteading HANDOFF 30). The real landing was a separate session: HANDOFF 31, 26 branches through one integration branch, merge `a2a7d026b`, not pushed. Rows went `DONE, HANDOFF 31` only after it | `~/Projects/ezhomesteading/HANDOFF.md:500`, `:508`; `PASSOFF.md:56-76` there |
| G29 | The rundown's shape | One paragraph; what is done; landing rehearsal; defects found and not fixed; merge order and collisions; judgment calls; decisions waiting for the owner; commit blocks | `OVERNIGHT-2026-10-03.md` headings, lines 7-123 |
| G30 | Policy calls the orchestrator took | Builders did not edit the board or the ledger; the orchestrator recorded centrally. Fable subagents built rows 36 and 39 against `model-routing.md`, because Zach asked for Fable work that night | `OVERNIGHT-2026-10-03.md:91-104` |
| G31 | Hazards the run hit | Two rows created migration 0130 (`:82`). Rows 36, 39 and 51 shared files their rows did not each list (`:83-90`). A memory gate held web builds at 02:30 (16 GB machine, 4.5 GB swap). Auto mode turned off at about 00:25 and Zach was asked to turn it back on. Every Fable review of a money row found a real defect (`:95`); row 36 took four review rounds | `OVERNIGHT-2026-10-03.md`; `orchestrator-state.md`, standing orders and Queue |

**Corrections to the board prompt (R5).** These lines in `PASSOFF.md` item 80 were checked and are
wrong as written. The prompt is not edited; the disproof is recorded here.

- "From 02:00 nothing was in flight." One review was still in flight at 02:00; all agents had
  returned by 02:10 (G24).
- "A fresh worktree needed an ignored `.env` that the permission classifier would not let the
  session copy." True, but not during the loop: the denied call is at 08:44 EDT, in the landing
  work after the 06:22 stop (transcript, a `cp $P/web/.env` refused by permission).
- "Without the timer, the session ends at 02:00." More exactly: with nothing in flight and no
  wakeup scheduled, the session goes idle and nothing wakes it.
- The orchestrator's own state file says "LOOP STOPPED ~07:15 EDT". The transcript says 06:22:57.
  The transcript is the record; the state file notes its early clock labels ran fast.

### The harness (Claude Code's runtime; "harness" is the technical term, no substitute)

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G32 | The `loop` skill is bundled | With no interval it runs in dynamic mode: run the prompt now, arm a `Monitor` if the next run waits on an event, then call `ScheduleWakeup` to continue. An interval of 60 minutes or more, or daily wording, offers a cloud schedule first | its text as loaded at 00:19:07 in the transcript; the same "Dynamic mode (rule 3" text is in the CLI 2.1.286 binary |
| G33 | The `ScheduleWakeup` contract | Delay clamped to 60 to 3600 s. `stop: true` ends the loop. Background work the harness tracks re-invokes the session when it finishes, so short polling is waste; a fallback of 1200 s or more is the guidance. The tool is described as the pacing for "/loop dynamic mode" | this session's tool list, 2026-10-03 |
| G34 | `ScheduleWakeup` is in the CLI, not only the desktop app | `var il="ScheduleWakeup"` and `<<autonomous-loop-dynamic>>` are defined in the CLI 2.1.286 binary. The timers are session-scoped ("Session-scoped cron tasks (CronCreate, ScheduleWakeup, /loop) that will wake this session later"). Not run in a plain terminal by this session (R10) | `strings` over `~/.local/share/claude/versions/2.1.286` |
| G35 | The usage tool is the desktop host's | `ccd_session_mgmt` is one of the server names the CLI treats as host-supplied. The CLI's own `get_usage` is a control request a host answers ("get_usage is not supported in this context" when none is registered). No model-callable usage tool was found for a plain terminal. The status line's input carries `rate_limits.five_hour` and `rate_limits.seven_day` (`utilization`, `resets_at`). From binary strings, not a run (R10) | same binary |
| G36 | A session cannot compact itself | No compaction tool is in this session's tool list; `/compact` is the person's command. Only the automatic compaction runs without a person | this session's tool list, 2026-10-03 |
| G37 | Skill frontmatter the CLI reads | `disable-model-invocation` ("reserved for explicit user invocation"), `user-invocable`, `allowed-tools`, `argument-hint`. The shipped templates use only `name` and `description` | binary strings; `templates/skills/clean-up.md:1-4` |
| G38 | The Agent tool | `model` takes a family: `sonnet`, `opus`, `haiku`, `fable`. `isolation: "worktree"`. Agents run in the background by default. `SendMessage` continues an agent with its context | this session's tool list, 2026-10-03 |
| G39 | A `Workflow` tool exists | It orchestrates subagents from a script, needs explicit opt-in (a skill whose text calls it counts), and carries a size guideline of under 10 agents in this session | this session's tool list; "Execute a workflow script" is in the CLI binary |

## 2. What this is, and what it is not

**What this is.** Two skill templates and what renders them: `templates/skills/delegate.md`,
`templates/skills/autopilot.md`, their entries and variables in `src/render/skills.ts`, the
`skills` question in `src/questions/you.ts` (its label at least), the long form
`docs/choices/skills.md`, `catalog.json`, tests (a new suite per skill, the precedent in G6), and
`README.md` and `CHANGELOG.md`. `/delegate` runs one ratified row or `PLANNED` phase. `/autopilot`
reads the board, picks runnable rows, runs each through `/delegate`'s procedure in parallel within
the caps, holds what needs the owner, and ends with a rundown.

**What this is not.** These stay out until a dated supersession says otherwise.

- **Building either skill.** This item scopes only.
- **Any change in ezhomesteading.** Its records are read, not edited.
- **Landing the worktrees a run leaves** (the predicted-merge process of ezhomesteading HANDOFF 31).
  The rundown carries commit blocks and the merge-order notes; merging is the owner's, unless Zach
  adds it at the gate.
- **`standard/` content.** The Part 5 ceiling lead (G26, G27) is recorded in section 5 and not
  acted on here.
- **Rows 77 to 79.**
- **Zach's own `~/.claude/skills/delegate/SKILL.md`.** It is not migrated or edited. The stamp
  guard keeps it (G14), so a re-run of `setup` refuses to overwrite it until Zach removes it.
- **A usage gauge for the plain terminal**, unless option C2 is chosen.
- **A `personal-config` command that runs the loop.** The skills are documents the agent follows;
  the engine stays a renderer.

## 3. Options

Each option carries its defense and the strongest argument against it. "Recommended" marks the
option this scope would take; the decision is Zach's.

### O1. Which tracks are offered each skill

Both skills need a board. `/autopilot` needs `/delegate`, so no track gets `/autopilot` alone.

- **A. Both on code, full, in git only. Recommended.** Everything `/delegate` leans on exists only
  there: worktree isolation, the full standard's Parts 4 to 7 with the relay contract, gates an
  auditor can re-run, and the tier table (G3, G9, G11). It is the line `/clean-up` already draws
  (G2). *Against:* non-code, full has a board and a tier table too, and a person writing documents
  who wants rows run overnight cannot have it; widening later is a new row.
- **B. `/delegate` on every full-weight track, with a short-track variant; `/autopilot` on code,
  full, in git only.** *Against:* without git a builder gets no worktree of its own, so parallel builders
  write one folder; and the variant is a second text to keep true, with a proof line in place of gates.
- **C. Both wherever a board exists.** *Against:* an unattended loop on a folder with no git
  cannot be reviewed by diff, landed or undone.

### O2. How the installer offers them

- **A. Both join `all`; `/autopilot` carries `disable-model-invocation: true`. Recommended.** No
  new question, no new long form, no catalog count change. `/autopilot` then runs only when the
  person types it, and its first step is the opening round where the budget is set (G37).
  `/delegate` stays model-invocable, because `/autopilot` follows it. *Against:* "all" grows to
  seven names, and a student who chose "all" for `/close-out` finds an overnight loop in their
  skills list they never asked about. Support for the frontmatter flag in other harnesses is not
  known.
- **B. `/delegate` joins `all`; `/autopilot` is its own question after `skills`, recommended
  "No".** *Against:* one more question for everyone on code, full, a long form, a stored-profile
  default and count pins in two suites, for a skill that does nothing until typed.
- **C. Turn `skills` into a multi-select.** *Against:* it changes a settled question's shape and
  how every stored profile reads, which is a larger build than this row.

### O3. What `/autopilot` does where the usage tool or the timer is missing

**C1. No usage tool** (the plain terminal, G35).

- **A. Require a countable cap. Recommended.** Where the gauge exists, the opening round asks a
  usage cap. Where it does not, it asks an end time or a row count instead, at least one, and the
  rundown says the budget was not measured. If a limit stops agents, the loop holds on hourly wakes
  and resumes them with `SendMessage` after the reset, as the overnight run did (G24). *Against:* a
  person who wanted "stop at 25% of the week" gets a proxy, and a long end time can spend a whole
  weekly allowance before it binds.
- **B. A status-line bridge** that writes `rate_limits` to a file the loop reads (G35).
  *Against:* it writes a status line into `settings.json`, collides with a person's own, rests on a
  schema read from binary strings, and adds files outside row 80's list.
- **C. Desktop app only.** *Against:* it cuts the terminal users.

**C2. No timer** (`ScheduleWakeup` absent).

- **A. Run while work is in flight, then stop with the rundown. Recommended.** Background agents
  re-invoke the session as each returns (G33), so the loop continues while anything runs. When
  nothing runs and no timer exists, the run ends there and the rundown says why. The opening round
  tells the owner whether this run can hold through a usage freeze. *Against:* the overnight run
  would have ended at about 02:10, with no fix rounds and no landing rehearsals (G24).
- **B. Fall back to `/loop` with a fixed interval (`CronCreate`).** *Against:* it is also a
  session timer; where `ScheduleWakeup` is missing it may be missing too, and nothing here
  verified it.
- **C. Keep a background shell `sleep` in flight to hold the session.** *Against:* it works
  around the harness's own rule against sleeping, may be refused by the permission system in an
  unattended run, and looks like a hang to anyone who checks.

### O4. Where the state file lives

- **A. A run folder in the repo, `docs/incomplete/autopilot-<YYYY-MM-DD>/`, holding `STATE.md`
  and `RUNDOWN.md`. Recommended.** It survives a reboot and an automatic compaction, the next
  session can read it, and `/clean-up` and `personal-config archive` already move such a folder to
  the archive (the overnight records ended up archived the same way). It is inside the working
  directory, so no extra permission. *Against:* it sits in the primary checkout while builders run
  in worktrees, `doctor` scans it (a "currently" in the state file is an `R1` finding), and it is a
  folder of run noise the owner must archive.
- **B. The archive home, outside the repo.** *Against:* the desktop app grants directories one at
  a time (`HANDOFF.md:30-32`), so an unattended session may stop on a permission it cannot get.
- **C. The session scratchpad, as on 2026-10-03.** *Against:* it is under `/private/tmp`, cleared
  on reboot, and invisible to the next session.

### O5. Stop rules and budget

- **A. The opening round sets the caps; the first cap reached stops new launches. Recommended.**
  Caps: usage (where a gauge exists), end time, rows built, parallel agents. In-flight work
  finishes, its reviews run, and the rundown is written. The run also stops when no runnable row is
  left (every remaining row waits on the owner, on another row, or on a file in flight). Defaults
  are section 4's dials. *Against:* the opening round becomes the longest question round of the
  night, and the `AskUserQuestion` tool takes four questions per call.
- **B. Fixed defaults, no opening round.** *Against:* the budget is the owner's call; on
  2026-10-03 it was asked, and the answer (25% of the new week) was not a default anyone would
  have guessed.

### O6. Deep-tier rows (against the shipped model-routing rule)

The rendered rule says a Deep subagent never builds (G9). The overnight run broke it on request
(G30). Two shipped documents must not disagree without saying so in both (standard Part 8.1).

- **A. Hold Deep rows by default; the opening round may lift it for named rows. Recommended.** A
  lifted row gets a Deep builder and an independent Deep review, and the lift is logged as the
  owner's call. `/delegate`, run by the owner on one Deep row, treats that invocation as the
  authorization and says so. One sentence is added to the rendered `model-routing.md` naming this
  exception, which puts `src/render/rules.ts` into the build's files. *Against:* the routing rule
  gains an exception the standard's Part 4 does not carry, and a person who never lifts it finds
  their most important rows untouched every morning.
- **B. Always build Deep rows with a Deep builder, plus a Deep review.** *Against:* it reverses the
  Part 4 reasoning (a Deep subagent's sustained reasoning is lost at the boundary), a settled
  decision that needs a supersession in `standard/`, which is out of scope.
- **C. Build Deep rows with a Default builder, then a Deep review.** *Against:* a quiet downgrade,
  which the routing rule forbids by name.

### O7. When a review runs, and which tier

- **A. Every row gets an auditor before sign-off; Deep for Deep rows and for rows the owner names
  as load-bearing, Default for the rest. Blocking findings go back to the same builder through
  `SendMessage`, at most two fix rounds, then the row is held. Recommended.** Each auditor runs
  in its own worktree and re-runs the gates (G17). *Against:* two rounds was not enough on
  2026-10-03 (row 36 took four, G31), so some rows end held; and a Default auditor misses a silent
  failure in a row mis-tiered as Default.
- **B. A Deep review on every row.** *Against:* cost; Part 4 keeps Deep for a short load-bearing
  artifact, and most rows are not that.
- **C. Review Deep rows only; trust the gates elsewhere.** *Against:* HANDOFF 92's Default auditor
  found five non-blocking defects on an ordinary row (`HANDOFF.md:1464`).

### O8. A row that needs the owner

- **A. Ask what can be asked before the loop; hold the rest on the board, with the reason, and
  list it in the rundown. Recommended.** Before launch, the orchestrator reads each candidate
  row's "Ask before building" and "Waits on". An unanswered owner question goes into the opening
  round, or, once the owner is gone, the row is marked `HELD` with what it waits on. A question a
  builder raises mid-row comes back as its report: a build-level call that only implements a
  settled decision is taken, logged with a one-line reversal (R12); anything else holds the row.
  Copy is never picked (R7): variants go to the rundown. *Against:* rows hold that the overnight
  orchestrator would have pushed through, so less is built by morning.
- **B. Take every call and log it.** *Against:* it makes the owner's calls (R9, R12), and on
  2026-10-03 some of those calls touched files another row owned (G30).
- **C. Hold in the state file only.** *Against:* the board, which every later session reads,
  does not show why the row stopped.

### O9. Board and ledger writes during a run

- **A. Only the orchestrator writes the board and the ledger, in the primary checkout; one ledger
  step per signed-off row, plus one step for the run. Recommended.** It claims each row with
  `personal-config passoff claim` before launch (G12), writes each row's step at the next free
  number read fresh, names the worktree and "not yet committed" (the HANDOFF 92 precedent), and
  closes with a run step pointing at the rundown. *Against:* a night can add twenty steps, and a
  row marked `DONE` while its work sits uncommitted in a worktree reads as landed when it is not.
- **B. One ledger step for the run; rows stay `IN FLIGHT` until landed** (as ezhomesteading did,
  G28). *Against:* every board item ends with its own step (standard Part 7), and rows held
  `IN FLIGHT` for days block the collision check for everyone.

### O10. Commit policy

- **A. Follow the person's policy. Recommended.** `print-blocks`: builders never commit; the
  rundown carries two blocks per worktree, rooted with `git -C`. `agent-commits`: the builder
  commits on its own worktree branch, never pushes, never merges. Where a hook blocks a commit,
  the builder prints the blocks and does not work around it. *Against:* until row 78 lands, the
  recommended guard blocks the `agent-commits` half (G13), so those people get blocks anyway.
- **B. Never commit in an unattended run, whatever the policy.** *Against:* uncommitted worktrees
  are what a worktree cleanup script removes, and the 2026-10-03 rundown had to open with a
  warning not to run it (`OVERNIGHT-2026-10-03.md:11`); it also overrides a policy the person
  chose.

### O11. The engine under `/autopilot`

- **A. The bundled `/loop` in dynamic mode, a state file read on every wake, `ScheduleWakeup`
  holds. Recommended.** It is what worked on 2026-10-03, and `ScheduleWakeup` is described as the
  pacing for exactly this mode (G33). *Against:* it rests on a bundled skill and a tool whose text
  this tool does not control; a harness change can break the loop silently.
- **B. A `Workflow` script.** *Against:* the size guideline is under 10 agents where the night
  launched 48, a workflow cannot ask the owner, and nothing shows one holding through a usage
  freeze (G39).
- **C. A cloud routine (`/schedule`).** *Against:* it runs without the person's machine: no local
  worktrees, databases or Docker, which the backend rows needed (G31).

### O12. How the template names models

- **A. Fill each tier's configured name into the skill at render time, and tell the session to
  pass the Agent tool the family that model belongs to. Recommended.** No `fable`, `opus` or
  `sonnet` in the template (G19, G38); the opening round confirms the mapping. *Against:* a tier
  named in free text ("my big model") may not map to a family, and an unattended session cannot
  ask after the opening round.
- **B. Read `model-routing.md` at run time.** *Against:* it is not written under `modelRouting:
  skip` (G9), and it couples a skill to a rule file's table layout.

### O13. What the end-of-run rundown contains

- **A. A fixed list of sections, in this order. Recommended.** One paragraph. Per row: model,
  worktree path and branch, gates seen, review verdicts, fix rounds, status. Defects found and not
  fixed. Collisions and merge order, including numbered resources claimed twice. Judgment calls,
  each with its reversal. Decisions waiting for the owner, copy variants among them. Budget: usage
  readings or "not measured", agents by model, hours, peak orchestrator context. What was not
  verified (R10). Warnings, such as tools that delete uncommitted worktrees. Commit blocks per
  worktree. This is G29's shape plus the budget and the R10 line. *Against:* long; the 2026-10-03
  rundown was 556 lines, heavy for a two-row run.
- **B. A free-form summary.** *Against:* the fixed shape is what made the landing possible; a
  free summary is not reviewable against what ran.

### O14. The orchestrator's own context

Part 5 sizes a phase to its driver's ceiling. It does not name an orchestrator that reads only
short reports. On 2026-10-03 the orchestrator passed the Default landing point at 00:47 and ran to
767,008 tokens with no automatic compaction (G26, G27).

- **A. No landing on context; the state file carries the run. Recommended.** The orchestrator
  measures itself with `personal-config context` on each wake, records the figure in `STATE.md`,
  and keeps its own reads short; an automatic compaction is survived by re-reading the state file
  first. The owner may set a context cap at the opening round. The skill says, dated, why it does
  not land at Part 5's figure. *Against:* it ships a skill that runs past the ceiling the installed
  standard states, on evidence from one night on a 1M window.
- **B. Land at the standard's figure for the orchestrator's tier.** *Against:* the overnight run
  would have stopped launching at about 01:15, before any fix round (G27).

### O15. A Deep review of the skill text as a done-when for the build

The shipped text's failure is silent: an unattended loop doing the wrong thing all night.

- **A. Yes, plus a supervised runtime pass. Recommended.** One Fable review of both rendered
  skills, verdict only, in its own worktree (Part 4's one Deep subagent job). Then a runtime-pass
  entry the owner walks: `/autopilot` on a scratch repo with a two-row board and a 30-minute end
  time, watched. *Against:* a review of text cannot prove how the loop behaves, and the runtime
  pass costs the owner an attended half hour.
- **B. No; an Opus audit only.** *Against:* the failure is silent, which is the one case Part 4
  assigns Deep to.

### O16. Copy a person reads (R7)

**The `all` label** (G4). The build keeps the label's existing dash after "All of them"; it is
written as a colon here because this document carries no dashes of that kind.

- *Plain, recommended:* "All of them: /close-out, /scope, /passoff, /handoff, /clean-up,
  /delegate, /autopilot"
- *Terse:* "All seven workflow skills"
- *Warm:* "All of them, including two that run your board with subagents"

**`/autopilot`'s description** (the line a person sees in the skills list).

- *Plain, recommended:* "Run the board unattended: each open row goes to its model in a worktree,
  is reviewed, and is reported back. Stops when the board is done or the budget you set is spent."
- *Terse:* "Work the whole board through /delegate, unattended, inside a budget you set."
- *Warm:* "Leave the board running overnight: one round of questions at the start, then every open
  row is built, reviewed and written up for the morning."

## 4. Dials

Asked at the opening round, with these defaults written once in the `/autopilot` template.

| Dial | Recommended default | Evidence |
|---|---|---|
| DIAL-1 Weekly usage, where a gauge exists | Spend at most 25 points of the weekly window | the 2026-10-03 answer (G22) |
| DIAL-2 Five-hour window | Freeze launches at 75%, resume after its reset | the 01:20 freeze (G24) |
| DIAL-3 Agents in flight | 6, of which at most 4 builders | 17 in flight at 01:20; the memory gate fired at 4 web builds (G31) |
| DIAL-4 End time | 8 hours after the start | the run was 00:15 to 06:22 (G21, G25) |
| DIAL-5 Rows | No cap | |
| DIAL-6 Fix rounds per row | 2, then held | the personal skill's step 4 (G17); row 36 needed 4 (G31) |
| DIAL-7 Wake while holding | 3600 s, the maximum | the hourly holds (G24, G33) |
| DIAL-8 Fallback wake while agents run | 1800 s | `ScheduleWakeup` guidance (G33) |
| DIAL-9 Builder relay | ~25 files or two thirds of the work-list | standard Part 5, the relay contract |
| DIAL-10 Orchestrator context cap | None, recorded on each wake | O14 |

## 5. Hazards this work walks into

- **Numbered resources claimed twice.** Two rows each created migration 0130 (G31). Builders take
  no ledger number (only the orchestrator writes the ledger); other numbers are reported per row and
  clashes listed in the rundown.
- **"Files it owns" is only as good as the column.** Rows 36, 39 and 51 shared files their rows
  did not each list (G31). The collision check cannot see an undeclared file.
- **Machine limits.** Memory, ports and per-agent databases. On 2026-10-03 the orchestrator
  started Docker Desktop, which also restarted another project's stack.
- **A fresh worktree lacks ignored files**, and copying a secret file can be refused with no one
  there to approve it (the 08:44 denial). Worktree bases can also be stale (HANDOFF 92).
- **Permission mode.** Auto mode went off at about 00:25 and work waited on Zach. A denied call is
  not retried, so the opening round has to settle the mode.
- **The process must stay alive.** The timers are session-scoped (G34); a closed app, a closed
  terminal or a sleeping machine ends the run.
- **`cd` moves the session's working directory** (`HANDOFF.md:211-213`; the state file's Lessons).
  The orchestrator uses `git -C` and absolute paths.
- **Two shipped texts can disagree.** Unless O6 is settled, the skills and `model-routing.md`
  contradict each other on Deep builds.
- **`disable-model-invocation` on `/delegate` would stop `/autopilot` following it** (G37). Only
  `/autopilot` takes the flag under O2-A.
- **Zach's own unstamped `/delegate` blocks the shipped one** on his machine (G14) until he
  removes it.
- **The build collides with rows 77 to 79** on `catalog.json`, `README.md` and `CHANGELOG.md`
  (G15), and with row 78 on what `agent-commits` means (O10).
- **The Part 5 ceiling lead (for `standard/`, not acted on here).** The Default ceiling, ~400k
  measured 2026-08-16, was passed by 367k with no automatic compaction on a 1M window (G26, G27).
  The standard says to re-measure when a tier's model changes. That is a row of its own if Zach
  wants it.

## 6. Open questions

The batch for the gate. Each maps to the option above.

1. O1, tracks: A (code, full, git only), B or C.
2. O2, install: A (both in `all`, `/autopilot` typed only), B or C.
3. O3, no gauge: A (a countable cap), B or C. No timer: A (run while work is in flight), B or C.
4. O4, state file: A (`docs/incomplete/autopilot-<date>/`), B or C.
5. O5, caps: A (opening round, first cap stops launches) or B.
6. O6, Deep rows: A (held unless lifted, one sentence added to `model-routing.md`), B or C.
7. O7, reviews: A (auditor on every row, Deep where Deep, two fix rounds), B or C.
8. O8, owner rows: A (ask up front, then `HELD` with the reason), B or C.
9. O9, records: A (a step per row plus a run step) or B.
10. O10, commits: A (follow the policy) or B.
11. O11, engine: A (`/loop` dynamic mode), B or C.
12. O12, model names: A (fill tier names, map to a family) or B.
13. O13, rundown: A (fixed sections) or B.
14. O14, orchestrator context: A (no landing, record it) or B.
15. O15, Fable review of the skill text plus a supervised pass as a done-when: A or B.
16. O16, copy: the `all` label and `/autopilot`'s description, plain, terse or warm.
17. Section 4's dial defaults: as written, or which to change.
18. A board row for the Part 5 ceiling lead: yes or no.
19. Add the landing process to this effort: no (as scoped) or yes.

## 7. Answers

**Zach, in chat, 2026-10-03: "all recommended".** Every question in section 6 takes the option
marked recommended in section 3. Spelled out, so the design does not have to re-derive it:

1. O1: A. Both skills on code work, full setup, in git only.
2. O2: A. Both join `all`; `/autopilot` carries `disable-model-invocation: true`; `/delegate`
   stays model-invocable.
3. O3: C1 A, a countable cap (end time or rows) where no usage tool exists. C2 A, run while work
   is in flight, then stop with the rundown and say why.
4. O4: A. `docs/incomplete/autopilot-<YYYY-MM-DD>/`, holding `STATE.md` and `RUNDOWN.md`.
5. O5: A. The opening round sets the caps; the first cap reached stops new launches.
6. O6: A. Deep rows held unless the opening round lifts the hold for named rows; a lifted row gets
   a Deep builder and an independent Deep review; one sentence naming the exception is added to
   the rendered `model-routing.md`, so `src/render/rules.ts` joins the build's files.
7. O7: A. An auditor on every row, Deep for Deep rows and rows named load-bearing, at most two fix
   rounds through `SendMessage`, then held.
8. O8: A. Owner questions asked in the opening round; otherwise `HELD` with what it waits on, and
   listed in the rundown. Copy is never picked.
9. O9: A. Only the orchestrator writes the board and the ledger: a claim before launch, one step
   per signed-off row naming its worktree and "not yet committed", and one step for the run.
10. O10: A. Follow the person's commit policy; where a hook blocks a commit, print the blocks.
11. O11: A. The bundled `/loop` in dynamic mode, the state file read on every wake.
12. O12: A. Tier names filled in at render time; the session maps each to a model family; the
    opening round confirms the mapping.
13. O13: A. The fixed rundown sections, in the order given.
14. O14: A. No landing on the orchestrator's context; its size recorded in `STATE.md` on every
    wake; the skill says, dated, why it does not land at Part 5's figure.
15. O15: A. The build's done-when includes one Fable review of both rendered skill texts and a
    supervised 30-minute runtime pass on a scratch repo with a two-row board.
16. O16: the plain variants, for the `all` label and for `/autopilot`'s description.
17. Section 4's dials as written.
18. Yes: a board row of its own for re-measuring the Part 5 ceiling on a 1M context window.
19. The landing process stays out of this effort.
