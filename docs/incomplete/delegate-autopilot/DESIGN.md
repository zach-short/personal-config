# Design: `/delegate` and `/autopilot` as skills the tool installs

Ship the skill that runs one board row through a builder and an auditor (`/delegate`), and the
loop that runs the whole board unattended until it is done or the budget is spent (`/autopilot`).

**Status.** `RATIFIED` 2026-10-03. Opened as `SCOPE.md` on 2026-10-03 by Opus 5.5 for board row
80, answered in full at GATE 1 the same day ("all recommended"), committed by Zach as `3fadd95`,
and renamed to this file with `git mv` on 2026-10-04 by board row 81 (Opus 5.5). The scope exactly
as the gate saw it is `git show 3fadd95:docs/incomplete/delegate-autopilot/SCOPE.md`. Its options
section, O1 to O16 with each option's defense and the strongest argument against it, is carried
into the decisions below, so nothing the gate weighed is lost from this file. From here the design
is frozen: it changes by a new dated `D<n>` or an `As built:` note, never by an edit to a decision
in place. `PLAN.md` beside it is Stage 4, approved at GATE 2 on 2026-10-04 ("all recommended",
`PLAN.md` §7). GATE 2 also settled five design questions the first gate left open; they are D20
to D24, added on that date.

**Labels.** G1 to G39 in §1 are the ground truth the gate saw. `PLAN.md` §0 checked G1 to G15
again on 2026-10-04 and continues from G40; where the two differ, the plan's table wins. O1 to O16
and DIAL-1 to DIAL-10 are the scope's names, kept so §8 reads against them. Decision Dn records the
answer to the gate's question n, so D1 to D19 follow the scope's nineteen questions in order. D20
to D24 come from GATE 2. `BD-n` numbers are the plan's.

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

**Corrections found at plan time (R5), 2026-10-04.** Board row 81 checked G1 to G15 again against
`3fadd95`. The rows above are left as the gate saw them; each disproof is here and in `PLAN.md` §0,
whose table wins.

- **G6.** `tests/tracks.test.ts:281` pins five skill files for code work on the full setup *with
  no git* (`CODE_FULL_NO_GIT`, `tests/tracks.test.ts:56`). Under D1 that count stays at five. The
  pin that moves when a skill is added to code, full, in git is the golden's key count, 68, at
  `tests/tracks.test.ts:194`. Row 81's own prompt repeats the wrong line number.
- **G7.** The same grep also prints `src/render/rules.ts:16` and `:129`, and
  `src/questions/you.ts:256` and `:275`. Each is the routing answer's text or a comment about it,
  so the conclusion holds: no skill is named `delegate` or `autopilot`.
- **G14.** The stamp guard sits at `src/lib/write-plan.ts:20` (the `guard` type) and `:101-108`
  (`stampGuard`). The behavior is as stated.
- **G3 is true, and O1 read more into it than it says.** A board is written only on the full
  weight, but not on every full-weight target: under `workProfile: folders` the repo renderer
  writes project folders and neither a board nor a ledger (`src/render/repo.ts:256`, `:373-374`).
  O1 said "Both skills need a board", and D1 offers both on code, full, in git, where a person on
  project folders has none. `PLAN.md` G41 and its GATE 2 question 3 carry it.

## 2. What this is, and what it is not

**What this is.** Two skill templates and what renders them, in the shape the decisions below
fix.

- `templates/skills/delegate.md`, rendered to `~/.claude/skills/delegate/SKILL.md`. It runs one
  ratified board row or `PLANNED` phase through a builder subagent and an auditor subagent, each in
  its own worktree on the right model, and signs it off (§4.1).
- `templates/skills/autopilot.md`, rendered to `~/.claude/skills/autopilot/SKILL.md`, which only
  the person can start (D2). One opening round of questions, then every runnable row through
  `/delegate`'s steps in parallel inside the caps, holding what needs the owner, until a cap or
  the board stops it, and a rundown at the end (§4.2).
- `src/render/skills.ts` offers both on code work, the full setup, in git (D1), fills each tier's
  model name into both (D12), and writes `/autopilot`'s frontmatter flag (D2).
- `src/render/rules.ts` adds one sentence to the rendered `model-routing.md`, under the same
  condition as the skills (D6, §4.3).
- `src/questions/you.ts`: the `all` option's label names seven skills (D16). The question's two
  values do not change (§6).
- `docs/choices/skills.md` gains both skills, each with its defense, the strongest argument
  against it, what it writes and how to undo it. `docs/choices/model-routing.md` gains one line on
  the exception. `catalog.json` is rebuilt, and `README.md` and `CHANGELOG.md` say what shipped.
- Tests: one new suite per skill (the `dfdae1f` precedent, G6), the golden
  `tests/golden/full-track.json`, and its count and docstring in `tests/tracks.test.ts`.
- `RUNTIME-PASS.md` in this folder, carrying the supervised run of D15.

**What this is not.** Each stays out until a dated supersession says otherwise.

- **Any change in ezhomesteading.** Its records are read, not edited.
- **Landing the worktrees a run leaves** (D19). The rundown carries commit blocks and the
  merge-order notes; merging is the owner's.
- **`standard/` content.** The Part 5 ceiling lead is board row 82 (D18). Part 4's Deep subagent
  row is not edited either; D6 says what that costs.
- **Rows 77 to 79**, which own the commit guard and what it blocks.
- **A person's own hand-written skill of either name**, Zach's `~/.claude/skills/delegate/SKILL.md`
  among them. It is not migrated or edited. The stamp guard keeps it (G14), and the long form
  says how to take the shipped skill in its place.
- **A usage gauge for the plain terminal.** D3 chose a countable cap instead.
- **A `personal-config` command that runs the loop.** The skills are documents the agent
  follows; the engine stays a renderer.
- **Any edit to the five shipped skills** (§6).

## 3. Decisions

Each decision states what was decided, why it beat the strongest argument against it, what the
rejected options cost, and what it supersedes. D1 to D19 were ratified by Zach in chat on
2026-10-03 with the words "all recommended" (§8). D20 to D24 were ratified at GATE 2 on
2026-10-04 with the same words (`PLAN.md` §7).

### D1. Both skills are offered on code work, the full setup, in git only (O1, A)

`/delegate` and `/autopilot` render when the work is code, the weight is full, `usesGit` is not
`no`, and `skills` is not `none`. Every other track gets exactly the skills it gets now (G2).

**Defense.** Everything `/delegate` leans on exists only on that track. A worktree per builder
needs git. The full standard carries the subagent table, the relay contract and the gates an
auditor re-runs, and the short standard carries none of them (G11). The tier table is rendered on
the full weight (G9, G10). `/clean-up` already draws the same line (G2).

**The strongest argument against, and why it lost.** Non-code work on the full setup has a board
and a tier table too, so a person writing documents who wants rows run overnight cannot have it,
and widening later is a new row. It lost because the auditor's value is that it re-runs the gates,
and a non-code track has a proof line in place of gates (G11): the review half of `/delegate`
would have nothing mechanical to re-run. Widening is one predicate and one text variant, cheaper
to build when someone asks than to keep true while nobody does.

**Rejected.** *B*, `/delegate` on every full-weight track with a short-track variant: without git
a builder gets no worktree of its own, so parallel builders write one folder, and the variant is a
second text to keep true. *C*, both wherever a board exists: an unattended loop on a folder with
no git cannot be reviewed by diff, landed or undone.

**Open at plan time.** A code, full target in git on project folders has no board (§1
corrections). `PLAN.md` GATE 2 question 3.

### D2. Both join `all`; `/autopilot` runs only when the person types it (O2, A)

The `all` answer installs both. `/autopilot`'s frontmatter carries `disable-model-invocation:
true`. `/delegate` stays model-invocable.

**Defense.** No new question, long form or catalog count. `/autopilot` runs only when typed, and
its first act is the opening round where the budget is set. `/delegate` stays invocable because
`/autopilot` loads it (§7). Verified 2026-10-04 in Claude Code's documentation (Context7
`/websites/code_claude`, page `slash-commands`): with the flag set, only the person can invoke the
skill, its description is not loaded into the model's context, and a model's call to it is
blocked (`PLAN.md` G45).

**The strongest argument against, and why it lost.** "All" grows to seven names, and a student
who chose "all" for `/close-out` finds an overnight loop in their skills list they never asked
about. Support for the flag in other harnesses is not known. It lost because the loop is inert
until typed, the flag keeps its description out of the model's context altogether, and the first
thing it does is ask. For a harness that ignores the flag, the template's first line refuses a run
the person did not type (`PLAN.md` BD-4).

**Rejected.** *B*, its own question after `skills`: one more question for everyone on code, full,
plus a long form, a stored-profile default and count pins in two suites, for a skill that does
nothing until typed. *C*, a multi-select `skills`: it changes a settled question's shape and how
every stored profile reads.

### D3. A countable cap where usage cannot be read; run while work is in flight where no timer exists (O3, C1 A and C2 A)

**No usage tool.** Where the session has a usage gauge, the opening round asks a usage cap. Where
it has none, the round requires an end time or a row count, at least one, and the rundown says the
budget was not measured. If a limit stops agents, the run holds on hourly wakes and resumes them
with `SendMessage` after the reset, as the overnight run did (G24).

**No timer.** Background agents re-invoke the session as each returns (G33), so the run continues
while anything is in flight. When nothing runs and no timer exists, the run ends there and the
rundown says why. The opening round tells the owner whether this run can hold through a usage
freeze.

**Defense.** A cap the session can count still binds where usage cannot be read (G35), and the
rundown's "not measured" shows the owner the proxy for what it is. Ending honestly when nothing can
wake the session is better than a workaround that looks like a hang.

**The strongest argument against, and why it lost.** A person who wanted "stop at 25% of the week"
gets a proxy, and a long end time can spend a whole weekly allowance before it binds; without a
timer, the overnight run would have ended at about 02:10, with no fix rounds and no landing
rehearsals (G24). It lost to what the alternatives cost.

**Rejected.** *C1 B*, a status-line bridge: it writes into `settings.json`, collides with a
person's own status line, rests on a schema read from binary strings, and adds files outside row
80's list. *C1 C*, desktop app only: it cuts the terminal users. *C2 B*, `/loop` with a fixed
interval: also a session timer, likely missing where `ScheduleWakeup` is, and not verified. *C2 C*,
a background `sleep` held in flight: it works around the harness's own rule against sleeping, may
be refused by the permission system in an unattended run, and looks like a hang.

### D4. The run folder is `docs/incomplete/autopilot-<YYYY-MM-DD>/` (O4, A)

It holds `STATE.md`, written on every wake, and `RUNDOWN.md`, written at the end.

**Defense.** It survives a reboot and an automatic compaction, the next session can read it, and
`/clean-up` and `personal-config archive` already move such a folder to the archive. It is inside
the working directory, so it needs no extra permission.

**The strongest argument against, and why it lost.** It sits in the primary checkout while
builders run in worktrees; `doctor` scans it, so a relative-date word in the state file is an `R1`
finding; and it is a folder of run noise the owner must archive. It lost because the scan is
answered by writing the state file with absolute times only (§4.2.4), and the archive step is a
command that exists.

**Rejected.** *B*, the archive home: the desktop app grants directories one at a time
(`HANDOFF.md:30-32`), so an unattended session may stop on a permission nobody is there to grant.
*C*, the session scratchpad: cleared on reboot and invisible to the next session.

### D5. The opening round sets the caps, and the first cap reached stops new launches (O5, A)

The caps are usage (where a gauge exists), end time, and rows built. Agents in flight is a ceiling
on parallel work, not a stop. When a cap is reached, in-flight work finishes, its reviews run, and
the rundown is written. The run also stops when no runnable row is left: every remaining row waits
on the owner, on another row, or on a file in flight. The defaults are the dials in §5.

**Defense.** The budget is the owner's call, and the moment to ask it is before they leave.

**The strongest argument against, and why it lost.** The opening round becomes the longest
question round of the night, and `AskUserQuestion` takes four questions per call. It lost because
fixed defaults guess wrong: on 2026-10-03 the answer (25% of the new week) was not a default
anyone would have guessed. The round's length is bounded instead: the run questions fit in one
call, and a dial caps the rows' own questions (`PLAN.md` DIAL-11).

**Rejected.** *B*, fixed defaults and no opening round.

### D6. Deep rows are held unless the owner names them (O6, A)

A row whose model is the Deep tier is not built unless the owner named it: by lifting its hold in
`/autopilot`'s opening round, or by typing `/delegate` on that one row. A named row gets a Deep
builder and then an independent Deep review, and the step records the lift as the owner's call.
One sentence naming the exception is added to the rendered `model-routing.md` (§4.3).

**Supersession pointer.** This amends the rendered `model-routing.md`. Its "a Deep subagent never
builds" (`src/render/rules.ts:140-141`) now carries one named exception wherever the two skills
render, and stands unchanged everywhere else. It does not amend Part 4 of either standard, which
is out of scope (§2), so the two disagree on purpose. Part 8.1 asks that such a disagreement be
stated in both texts; here it is stated in `model-routing.md` and in both skills, and the standard
cannot carry it until `standard/` is in scope.

**Defense.** The owner names the row, the lift is logged, and a Deep review follows. The overnight
run broke the rule on request (G30), and every Fable review of a money row found a real defect
(G31), so the review half is what makes a lift safe. The routing rule already prefers a hand-off
for any build ("Prefer 2 when the task builds", `src/render/rules.ts:139`) and forbids only a Deep
builder, so `/delegate`'s builds on the other tiers sit inside that preference, as HANDOFF 92 ran.
The sentence therefore names only the Deep exception.

**The strongest argument against, and why it lost.** The routing rule gains an exception the
standard's Part 4 does not carry, and a person who never lifts it finds their most important rows
untouched every morning. It lost because an untouched Deep row is visible (held, and listed in the
rundown), while a Deep row built and wrong is the silent failure the tier exists for.

**Rejected.** *B*, always build Deep rows with a Deep builder: it reverses Part 4's reasoning and
needs a supersession in `standard/`. *C*, a Default builder and then a Deep review: the quiet
downgrade the routing rule forbids by name.

### D7. Every row gets an auditor; at most two fix rounds, then the row is held (O7, A)

Every row is audited before sign-off: Deep for Deep rows and for rows the owner names
load-bearing, Default for the rest. Each auditor runs in its own worktree and re-runs the gates.
Blocking findings go back to the same builder through `SendMessage`, then to a fresh auditor; after
DIAL-6 rounds (two), a row still blocked is held.

**Defense.** The auditor is what catches the confident wrong build. The same builder keeps the
context of its own change, where the personal skill's step 4 spent a fresh builder on each round.

**The strongest argument against, and why it lost.** Two rounds was not enough on 2026-10-03 (row
36 took four, G31), so some rows end held; and a Default auditor misses a silent failure in a row
mis-tiered as Default. It lost because a held row is in front of the owner in the morning, and a
fourth round at 05:00 with nobody watching is what the cap prevents.

**Rejected.** *B*, a Deep review on every row: cost, and Part 4 keeps Deep for a short
load-bearing artifact. *C*, review Deep rows only: HANDOFF 92's Default auditor found five
non-blocking defects on an ordinary row (`HANDOFF.md:1274`).

### D8. Owner questions are asked up front; otherwise the row is held, with the reason (O8, A)

Before launch, the orchestrator reads each candidate row's "Ask before building" and "Waits on". An
unanswered owner question goes into the opening round; once the owner is gone, the row is marked
`HELD` with what it waits on and listed in the rundown. A question a builder raises mid-row comes
back as its report: a build-level call that only implements a settled decision is taken and logged
with a one-line reversal (R12); anything else holds the row. The orchestrator never picks copy
(R7); variants go to the rundown.

**Defense.** The owner's calls stay the owner's, and the board, which every later session reads,
shows why a row stopped.

**The strongest argument against, and why it lost.** Rows hold that the overnight orchestrator
would have pushed through, so less is built by morning. It lost because taking every call makes
the owner's decisions (R9, R12), and on 2026-10-03 some of those calls touched files another row
owned (G30).

**Rejected.** *B*, take every call and log it. *C*, hold in the state file only: the board does
not show why the row stopped.

### D9. Only the orchestrator writes the board and the ledger (O9, A)

In the primary checkout, the orchestrator claims each row with `personal-config passoff claim`
before launch (G12), writes one ledger step per signed-off row at the next free number read fresh,
naming its worktree, its branch and "not yet committed" (the HANDOFF 92 precedent), and closes with
one step for the run that points at the rundown. Builders and auditors never edit either file.

**Defense.** One writer means no two agents race for a step number, and every board item still
ends with its own step, as Part 7 requires.

**The strongest argument against, and why it lost.** A night can add twenty steps, and a row marked
`DONE` while its work sits uncommitted in a worktree reads as landed when it is not. It lost
because the step's "not yet committed" carries the fact, and the alternative leaves rows
`IN FLIGHT` for days, which blocks the collision check for everyone.

**Rejected.** *B*, one ledger step for the run and rows `IN FLIGHT` until landed (as ezhomesteading
did, G28).

### D10. Builders follow the person's commit policy (O10, A)

Under `print-blocks`, builders never commit, and the rundown carries two blocks per worktree,
rooted with `git -C`. Under `agent-commits`, the builder commits on its own worktree branch, never
pushes and never merges. Where a hook blocks a commit, the builder prints the blocks and does not
work around it.

**Defense.** The policy is the person's, chosen at setup.

**The strongest argument against, and why it lost.** Until row 78 lands, the recommended guard
blocks the `agent-commits` half (G13), so those people get blocks anyway. It lost because the build
waits on row 78 (`PLAN.md` §2), so the guard and the policy agree before either skill ships.

**Rejected.** *B*, never commit in an unattended run: it overrides a policy the person chose, and
uncommitted worktrees are what a worktree cleanup script deletes (the 2026-10-03 rundown opened
with that warning, `OVERNIGHT-2026-10-03.md:11`).

### D11. The engine is the bundled `/loop` in dynamic mode (O11, A)

`/autopilot` starts `/loop` with no interval and a prompt that reads the state file first on every
wake; `ScheduleWakeup` paces the waits.

**Defense.** It is what worked on 2026-10-03, and `ScheduleWakeup` is described as the pacing for
exactly this mode (G33).

**The strongest argument against, and why it lost.** It rests on a bundled skill and a tool whose
text this tool does not control, so a harness change can break the loop silently. It lost to what
the alternatives cannot do, and the silent break is partly answered by D15's supervised pass and by
the state file's per-wake readings, where a missing reading shows a missed wake.

**Rejected.** *B*, a `Workflow` script: a size guideline under 10 agents where the night launched
48, no way to ask the owner, and no evidence of one holding through a usage freeze (G39). *C*, a
cloud routine: no local worktrees, databases or Docker, which the backend rows needed (G31).

### D12. Tier names are filled in at render time, and the session maps each to a model family (O12, A)

The template carries no `fable`, `opus` or `sonnet` (G19). Each tier's configured name
(`models.deep`, `models.default`, `models.fast`, and `models.light` when that tier is on) is
filled in at render time, and the skill tells the session to pass the Agent tool the family that
model belongs to. `/autopilot`'s opening round shows the mapping and asks the owner to confirm it.

**Defense.** The names are the person's own (G10), and the Agent tool takes a family (G38).

**The strongest argument against, and why it lost.** A tier named in free text ("my big model") may
not map to a family, and an unattended session cannot ask after the opening round. It lost because
the opening round is exactly where the mapping is confirmed, and a tier that still does not map
holds its rows, which the owner sees.

**Rejected.** *B*, read `model-routing.md` at run time: it is not written under `modelRouting:
skip` (G9), and it couples a skill to a rule file's table layout.

### D13. The rundown has fixed sections, in a fixed order (O13, A)

One paragraph. Per row: model, worktree path and branch, gates seen, review verdicts, fix rounds,
status. Defects found and not fixed. Collisions and merge order, including numbered resources
claimed twice. Judgment calls, each with its reversal. Decisions waiting for the owner, copy
variants among them. Budget: usage readings or "not measured", agents by model, hours, peak
orchestrator context. What was not verified (R10). Warnings, such as tools that delete uncommitted
worktrees. Commit blocks per worktree.

**Defense.** This is G29's shape plus the budget and the R10 line, and the fixed shape is what made
the 2026-10-03 landing possible.

**The strongest argument against, and why it lost.** It is long: the 2026-10-03 rundown was 556
lines, heavy for a two-row run. It lost because a free summary is not reviewable against what ran,
and a short run writes short sections ("none" where a section is empty).

**Rejected.** *B*, a free-form summary.

### D14. The orchestrator does not land on its own context; it records its size on every wake (O14, A)

The orchestrator measures itself with `personal-config context` on each wake, records the figure
in the state file, and keeps its own reads short. An automatic compaction is survived by reading
the state file first. The owner may set a context cap in the opening round (DIAL-10, none by
default). The skill says, with the date, why it does not land at Part 5's figure.

**Defense.** Part 5's ceiling was measured on sessions that read files; an orchestrator that reads
only short reports is a different session. On 2026-10-03 the orchestrator passed the Default
landing point at 00:47 and ran to 767,008 tokens with no automatic compaction (G26, G27).

**The strongest argument against, and why it lost.** It ships a skill that runs past the ceiling
the installed standard states, on evidence from one night on a 1M window. It lost because landing
at Part 5's figure would have stopped launches at about 01:15, before any fix round (G27), and the
evidence gap is board row 82's to close (D18). The skill states the disagreement with Part 5, as
Part 8.1 asks of a deliberate one.

**Rejected.** *B*, land at the standard's figure for the orchestrator's tier.

### D15. The build's done-when includes one Fable review of both skill texts and a supervised run (O15, A)

One Deep review (Fable 5.1) of both rendered skills, verdict only, in its own worktree, which is
Part 4's one Deep subagent job. Then a runtime-pass entry the owner walks: `/autopilot` on a
scratch repo with a two-row board and a 30-minute end time, watched.

**Defense.** The shipped text's failure is silent, an unattended loop doing the wrong thing all
night, which is the one case Part 4 assigns to Deep.

**The strongest argument against, and why it lost.** A review of text cannot prove how the loop
behaves, and the runtime pass costs the owner an attended half hour. It lost because the review and
the pass check different things, and each catches what the other cannot.

**Rejected.** *B*, an Opus audit only.

**Found at plan time.** A personal skill wins over a project skill of the same name (`PLAN.md`
G44), so on a machine that holds a hand-written `/delegate` the pass would silently run that one.
`PLAN.md` GATE 2 question 6.

### D16. The copy is the plain register (O16)

The `all` option's label is "All of them", the existing dash, then `/close-out, /scope, /passoff,
/handoff, /clean-up, /delegate, /autopilot`. (The label keeps its dash; this file carries no dash of
that kind, so it is described here.) `/autopilot`'s description reads: "Run the board unattended:
each open row goes to its model in a worktree, is reviewed, and is reported back. Stops when the
board is done or the budget you set is spent."

`/delegate`'s description was not on the gate. It is new copy a person reads, so R7 puts it to the
owner: `PLAN.md` GATE 2 question 4.

### D17. The dials are as written (§5)

### D18. A board row of its own for re-measuring Part 5's ceilings on a 1M window

Opened as board row 82 in HANDOFF 97.

### D19. The landing process stays out of this effort

### D20. When the caps allow fewer launches than there are runnable rows, board order decides (GATE 2, question 1, A)

The lowest-numbered runnable row launches first. This settles §4.2.2's last line.

**Defense.** `personal-config passoff next` already reads the board this way, and says why:
nothing in a row says which of two lanes matters more (`PLAN.md` G51). The owner wrote the board
in the order they meant, and a rule the session can apply without judgment is the right rule for a
night with nobody watching.

**The strongest argument against, and why it lost.** A large low-numbered row takes a builder slot
that two small rows could have used. It lost because the cost is throughput, which the owner sees
in the rundown, while the alternatives fail silently: ordering by what other rows wait on needs a
reliable reading of free-text "Waits on" cells, and a misreading reorders the night unseen;
ordering by the cheapest tier reorders the owner's priorities by cost.

**Supersedes:** nothing. **Ratified** 2026-10-04, Zach in chat, "all recommended".

### D21. The template fixes the opening round's content, and the session writes the words (GATE 2, question 2, A)

`templates/skills/autopilot.md` fixes which questions are asked, in which call, with which options
and which defaults (§4.2.3). The session words each question, inside the person's chat-style rule
where they chose one. No fixed question text ships, so no copy choice is owed for it (R7).

**Defense.** What governs the night is that the right things are asked with the right defaults,
and the content is what the Deep review and the supervised pass check (D15). Fixed text could not
list more Deep rows than a question's four options allow.

**The strongest argument against, and why it lost.** The wording drifts from run to run, and a
reviewer cannot check the exact text a person will read. It lost because the options and defaults,
which decide the answers, are fixed; the drift is in phrasing only.

**Supersedes:** nothing. **Ratified** 2026-10-04, Zach in chat, "all recommended".

### D22. On project folders, `/delegate` renders and `/autopilot` does not (GATE 2, question 3, A)

`/delegate` renders on both work-record shapes of code, full, in git. On project folders it claims
and records through the phase header, as `/close-out` already does (`src/render/skills.ts:234-241`),
and writes no ledger step or board row. `/autopilot` renders only where a board is written. This
answers D1's open point and §1's correction to G3.

**Defense.** `/delegate`'s source already runs a `PLANNED` phase (G17), so it works on folders as
it stands. Every step of `/autopilot` reads the board, and project folders write none (`PLAN.md`
G41).

**The strongest argument against, and why it lost.** The settled `all` label names `/autopilot`,
and a person on project folders who answers "all" does not get it. It lost because the label
already names skills a track does not get (a light setup gets two of the five it lists, G2), and
the alternatives either withhold a skill that works on folders or add a second reading procedure
with no "Files it owns" table to check collisions against.

**Supersedes:** in part, D1's "both skills" for one shape. D1 stands for every code, full, git
target with a board. **Ratified** 2026-10-04, Zach in chat, "all recommended".

### D23. `/delegate`'s description is the plain register (GATE 2, question 4, R7)

"Build one ratified board row or planned phase with a builder subagent and a separate auditor, each
in its own worktree on the right model, then sign it off. Use when a row has cleared its gate and
you want it built, reviewed and recorded without opening a new session."

The warm and terse variants are in `PLAN.md` §7. This completes D16 for the second skill.
**Ratified** 2026-10-04, Zach in chat, "all recommended".

### D24. A row after a signed-off, uncommitted row waits for the commit, or builds on the branch (GATE 2, question 5, A)

A row whose predecessor in its lane, or an item its "Waits on" names, was signed off in this run
but not committed is not runnable under `print-blocks`: it is held, and its "Waits on" names the
predecessor's commit. Under `agent-commits`, its builder starts from the predecessor's worktree
branch, and the rundown's merge order lists the predecessor first. This settles §4.2.2's second
line.

**Defense.** Nothing is built on work the owner has not seen, and where the agent commits, the
branch is a real base.

**The strongest argument against, and why it lost.** Under `print-blocks`, each lane builds one row
per run. It lost because the alternative that builds more, stacking on an uncommitted patch, breaks
the second row whenever the owner fixes the first after the run, and leaves the merge order as the
owner's puzzle. Holding under both policies would cost `agent-commits` its same-lane chains for no
safety the branch does not already give.

**Supersedes:** nothing; D9 still marks the predecessor `DONE`, and this decides what that `DONE`
means for the row after it. **Ratified** 2026-10-04, Zach in chat, "all recommended".

## 4. The skill texts, outlined

**Amended 2026-10-04, after GATE 2.** Where this file points at a `PLAN.md` GATE 2 question, the
answer is: question 1, D20; question 2, D21; question 3, D22; question 4, D23; question 5, D24;
question 6, `PLAN.md` Phase 3, scope item 1. The pointers in D1, D15, D16 and below are left as
written.

The outlines fix what each text says and in what order. The wording is the build's, inside these
limits: no em dash, no contraction and none of the listed AI-signal phrases (Zach's global hook
blocks a template that carries one, `PLAN.md` G49); no model family name (D12); no Part number of
the standard (row 81's prompt, G19); every placeholder filled at render time.

### 4.1 `/delegate`

Source: Zach's `~/.claude/skills/delegate/SKILL.md` (G16, G17), less its model names and its Part
citations. It is read, not migrated or edited. Its step numbers are kept.

**Frontmatter.** `name: delegate`, and a description that says when it fires (`PLAN.md` GATE 2
question 4). No `disable-model-invocation`, because `/autopilot` loads it (D2).

**Opening paragraph.** What it does: claim one scoped item, build it in a subagent, audit it in a
second, sign it off, with no person opening a fresh session or pasting a prompt. It drives the
standard's rules on model selection, context budget, parallel sessions and closing work, named by
their subject, and replaces none of them.

**The tiers.** A table filled at render time: each tier and its configured model name, `<unset>`
where none was given (as `tierTable` renders it, `src/render/rules.ts:94-107`), the Light row only
where that tier is on. Then: pass the Agent tool's `model` parameter the family each name belongs
to, as that parameter lists its values. Where a name maps to no family the tool lists, or a tier is
`<unset>`, ask the owner before step 2, or, under `/autopilot`, hold the row (D12). Never guess.

**0. Preconditions.**

- The item has cleared its gate. On a board: an `OPEN` row with a model and a written prompt, every
  item its "Waits on" names `DONE`, and no "scope first". On project folders, if the skills render
  there (`PLAN.md` GATE 2 question 3): a `PLANNED` phase with its subagents and done-when stated.
  Otherwise stop and run `/scope`.
- Open owner questions are asked here, in chat, in one batch, before step 1, never handed to a
  builder. Under `/autopilot`, the opening round asked them (D8).
- A Deep row is held unless the person typed `/delegate` on that row in this session, which is the
  authorization (say so in one line, and record it in the step), or `/autopilot`'s opening round
  lifted it. A `/delegate` the model loaded on its own lifts nothing (D6).
- Never spawn a model above the repo's tier ceiling, where the router has one (`PLAN.md` G47).
- Run in the primary checkout, where the board and the ledger are written. In a worktree session,
  stop and say so (`PLAN.md` G52).

**1. Read and claim.** Read the row fresh. Check its "Files it owns" against every row marked
`IN FLIGHT`. Claim it with `personal-config passoff claim <n>`, or the phase header on project
folders, before spawning anything.

**2. Build, in a subagent.** One Agent, `model` from the tiers above, `isolation: "worktree"`. Its
brief is the row's prompt in full, then the relay contract written out in the skill itself with
DIAL-9's numbers (about 25 files, or two thirds of the work-list), then these rules: do not edit the
board or the ledger (D9); the commit clause for the person's policy (D10); run the fresh-checkout
recipe and bring the worktree to the base branch with `git merge --ff-only` before the first gate
(the stale base of HANDOFF 92); never retry a denied call; report the gates as run, the diffstat,
what changed, what is left, any number claimed, any build-level call with its reversal, and any
question for the owner. A relayed pass-off goes to a fresh subagent of the same model; count the
passes.

**3. Audit, in a second subagent.** Its own worktree, never the builder's. Default, or Deep for a
Deep row and for a row the owner named load-bearing (D7). Its brief: the done-when, "What is fixed",
"Not in scope", and the builder's worktree path and branch. It reproduces the builder's change in
its own worktree and never writes the builder's (`PLAN.md` BD-6), re-runs the gates, and returns one
of clean, non-blocking findings or blocking findings, each with a citation. When it returns, check
its diffstat.

**4. Sign off.**

- *Clean, or non-blocking findings.* Record it: on a board, one ledger step at the next free
  number, read fresh, naming the builder's and auditor's models, the worktree, the branch, the
  commit state ("not yet committed" under `print-blocks`), the relay passes, the verdict and each
  finding as `open` (R9), and the row `DONE` against that step; on project folders, the phase
  header and its notes. Then the close-out hand-back blocks: in chat when the person ran
  `/delegate`, into the run's rundown under `/autopilot`.
- *Blocking findings.* Send them to the same builder with `SendMessage`, then a fresh auditor. At
  most DIAL-6 rounds (two). After that the row is `HELD`: its "Waits on" names where the open
  findings are written, and its section gets a dated note of what is done and what is left.

**5. Several rows at once.** Only rows in different lanes whose "Files it owns" do not overlap,
checked across all of them at once. Their Agent calls go out in one message.

**Closing paragraph.** Why the context stays small: only each subagent's final report crosses back.
How to measure this session: `personal-config context --sentinel "<a phrase from this
conversation>"`. A person's `/delegate` lands at the standard's context budget; under `/autopilot`,
D14 governs.

**As built, 2026-10-04 (board row 83, HANDOFF 103).** Two departures, both build-level calls in
`PLAN.md`. The three clauses that say what happens "under `/autopilot`" are not in the Phase 1
text, because that skill does not ship until Phase 2 (BD-17). The tier table has two columns,
Tier and Model, with `tierTable`'s `<unset>` rule and Light-row condition and without its "Use
for" column (BD-19). Everything else follows this outline in order, with the step numbers kept.

### 4.2 `/autopilot`

**Frontmatter.** `name: autopilot`, D16's description, `disable-model-invocation: true`.

#### 4.2.1 Before anything

1. Run only when the person typed `/autopilot` in this session. If the model loaded the skill on
   its own, stop and say so (`PLAN.md` BD-4).
2. Run in the primary checkout (as `/delegate`, step 0).
3. Note which tools this session has: the timer (`ScheduleWakeup`) and a usage gauge (the desktop
   app's `get_usage`). Both answers go into the state file and decide the opening round's wording
   (D3).
4. Load `/delegate` once, with the Skill tool. Its steps run every row; it is not loaded again per
   row (`PLAN.md` BD-3).

#### 4.2.2 Which rows can run

A row is runnable when all of these hold:

- it is `OPEN`, and it is the first `OPEN` row of its lane, because items in a lane run in order;
- every item its "Waits on" names is `DONE`, and a row this run signed off without a commit counts
  as `DONE` only as `PLAN.md` GATE 2 question 5 decides;
- its prompt does not say to scope first;
- its "Files it owns" overlaps no `IN FLIGHT` row;
- its tier maps to a family (D12) and sits at or below the repo's ceiling;
- it is not Deep, or the opening round lifted it (D6);
- its owner questions are answered (D8).

When the caps allow fewer launches than there are runnable rows, the order is `PLAN.md` GATE 2
question 1's.

#### 4.2.3 The opening round

At most four questions in each `AskUserQuestion` call (G22, `PLAN.md` G46). Whether the template
fixes the words or only the content is `PLAN.md` GATE 2 question 2; the content is fixed here.

*First call, always.* Four questions, each with the default first and marked recommended:

1. **Budget.** Where a gauge exists: stop launching at DIAL-4's end time or DIAL-1's share of the
   weekly window, and freeze launches at DIAL-2's share of the five-hour window; a shorter run; or
   a row count the owner types. Where no gauge exists, the question says the budget will not be
   measured, and requires an end time or a row count (D3).
2. **Agents in flight.** DIAL-3 (six, at most four building); fewer; one at a time.
3. **Unattended.** What the run needs: a permission mode that will not stop on a prompt, and the app
   or terminal left open on a machine that stays awake. Where no timer exists, the run ends when
   nothing is in flight and cannot wait out a usage freeze (D3). Ready, or stop here.
4. **Models.** Each tier's name and the family the session will pass. Correct, or the owner types
   the mapping (D12).

*Second call, only when it has something to ask.* Up to three questions:

5. **Deep rows.** Which Deep rows to lift (several may be chosen; none is the default) (D6).
6. **Load-bearing rows.** Which other runnable rows get a Deep review (none is the default) (D7).
7. **Rows to leave out** of this run (none is the default).

*Later calls.* Each candidate row's open "Ask before building" questions, as the row wrote them,
with the row's own options, four per call, at most DIAL-11 calls (`PLAN.md` §3). Copy questions
show their variants, and the owner picks (R7). A row whose questions were not reached is held (D8).

After the round, no more questions. The answers go into the state file, dated and word for word.

#### 4.2.4 The run folder and the state file

`docs/incomplete/autopilot-<YYYY-MM-DD>/`, with a suffix where that date's folder exists
(`PLAN.md` BD-7). `STATE.md` has these sections: **Run** (start time, the folder, the sentinel
phrase for `personal-config context`, the timer and gauge found); **Caps**; **Standing orders**
(lifts, load-bearing rows, rows left out, the row questions' answers); **Rows** (one line per row:
number, tier, status, agent ids, worktree path, branch, relay passes, review rounds, verdict);
**Queue**; **Readings** (one line per wake: time, usage reading or "not measured", orchestrator
context); **Judgment calls** (each with its reversal); **Held** (row and what it waits on). Every
time is absolute, with its zone, and no relative-date word appears, because `doctor` scans the
folder (D4, `PLAN.md` BD-8).

#### 4.2.5 Launch

Claim each row, then run `/delegate`'s step 2 for each, up to DIAL-3, with the Agent calls in one
message. Then start `/loop` with no interval and the wake prompt: read the state file first, then
follow the wake procedure (D11).

#### 4.2.6 The wake procedure

On every wake, and whenever a background agent returns:

1. Read `STATE.md` first. It, not memory, is the record of the run (D4, D14).
2. Record a reading: the time, the usage figure or "not measured", and this session's context from
   `personal-config context --sentinel` (D14).
3. Route each returned agent by `/delegate`'s steps: a builder's report to an auditor, a relay to a
   fresh builder, a verdict to sign-off, a fix round or a hold (D7). Record on the board and in the
   ledger (D9).
4. Check the stop rules (4.2.7).
5. Where the five-hour window has reached DIAL-2, freeze launches and hold on DIAL-7 wakes; after
   the reset, resume stopped agents with `SendMessage` (D3).
6. Otherwise read the board fresh and launch the next runnable rows, up to DIAL-3.
7. Schedule the next wake: DIAL-8 while agents run, DIAL-7 while holding. With nothing in flight,
   nothing runnable and no freeze, end the run (4.2.8).
8. Write `STATE.md` before the turn ends.

#### 4.2.7 Stop rules

- The first cap reached (usage where a gauge exists, end time, rows) stops new launches (D5).
- After a cap, in-flight work finishes and its reviews run. A blocking verdict then holds the row
  rather than starting a new fix round (`PLAN.md` BD-9).
- No runnable row left and nothing in flight: the run ends (D5).
- No timer, and nothing in flight: the run ends, and the rundown says why (D3).
- A limit that stops agents where no gauge exists: hold on DIAL-7 wakes, then resume them (D3).
- The orchestrator's own context never stops the run unless the owner set DIAL-10 (D14). The
  dated reason, in the skill's words: on 2026-10-03 an orchestrator that read only short reports
  ran to 767,008 tokens on a 1M window with no automatic compaction, while Part 5's Default
  ceiling, about 400k measured 2026-08-16, describes sessions that read files.

#### 4.2.8 The end

End the timer (`ScheduleWakeup` with `stop: true`, or no new wake). Write `RUNDOWN.md` in D13's
sections, in D13's order, each present and "none" where empty. Record the run's ledger step,
pointing at the rundown (D9). Where a push notification tool exists, send one line naming the
rundown's path (`PLAN.md` BD-13). Post the rundown's one paragraph and its path in chat.

#### 4.2.9 Standing orders from the hazards

Each line is a hazard in §7 turned into an instruction (`PLAN.md` BD-12).

- Use `git -C <path>` and absolute paths, never `cd`: a `cd` moves the session's working directory.
- A builder that needs an ignored file it cannot copy, an env file for example, stops and reports.
  A denied call is never retried.
- Do not start, stop or restart services outside this repo.
- Builders take no ledger number. Every other number a row claims (a migration, a fixture id) is
  reported, and two rows claiming one number go under Collisions.
- "Files it owns" is only as good as the column: a builder that must touch a file its row does not
  list stops and reports.

**As built, 2026-10-05 (board row 84, HANDOFF 104).** The text follows this outline with these
departures, each a build-level call in `PLAN.md` §1, most of them fixes to findings of the Fable
review. §4.2.2: a row runs only when every row before it in its lane is finished, not when it is the
first `OPEN` one, so a `HELD` row holds its lane (BD-22); the overlap check covers the launch set as
well as the rows in flight; a load-bearing row whose Deep review the ceiling forbids is held; under
`agent-commits` a predecessor whose commit a hook blocked counts as not committed, so D24's hold
applies to it (BD-21). §4.2.4: `STATE.md` gains a **Reports** section, and the rundown is written
from the state file (BD-21). §4.2.5: the wake prompt reloads either skill after a compaction
(BD-24). §4.2.6: a builder's question for the owner gets its own step, and the launch comes before
the stop rules (BD-21). §4.2.7: a cap ends the run once nothing is in flight, and the run ends
whenever nothing is in flight after a wake's launches, except a hold with a timer (BD-21). §4.2.9's
orders are carried into each builder's brief. §4.1: the auditor's brief gains its own rules
(BD-23), and the `/autopilot` lines render on a board only, where that skill renders (D22). §4.3
renders in its final form on a board, and in its Phase 1 form on project folders (BD-20).

### 4.3 The sentence in `model-routing.md`

It follows "a Deep subagent never builds, because the boundary discards the sustained reasoning
that tier is for." (`src/render/rules.ts:140-141`), in the same paragraph, and renders only where
both skills render (`PLAN.md` BD-1). Under `warn-only` the rule has no such line, and under `skip`
no file, so neither gets the sentence. Exact text:

> One exception, and only one: a Deep row may be built by a Deep subagent when I named that row
> myself, by running `/delegate` on it or by lifting its hold at the start of `/autopilot`, and
> that build then gets an independent Deep review.

Until `/autopilot` ships, the clause "or by lifting its hold at the start of `/autopilot`" is left
out (`PLAN.md` BD-14).

## 5. Dials

As ratified (D17). Asked at the opening round, with these defaults written once in the
`/autopilot` template. `PLAN.md` §3 adds DIAL-11.

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

## 6. Rules that survive unchanged

A build phase does not touch these, however helpful the edit looks.

- **The five shipped skills' text.** `templates/skills/{close-out,scope,passoff,handoff,clean-up}.md`
  render the bytes they render now. The golden proves it: only new keys and `model-routing.md`
  move (`PLAN.md` §5).
- **The `skills` question's two values**, `all` and `none`, its id, its `configKey` and its place
  in the phase. Only the `all` label changes (D16). The renderer's acceptance of an array from a
  profile stays as it is.

  **As built, 2026-10-05 (G54, Zach's call).** The renderer never accepted an array: `answer()`
  returns its fallback for a value that is not a string, so an array read as `none` and the
  per-skill path in `src/render/skills.ts` was unreachable. Zach chose to remove that path, not to
  wire it up, because no question, catalog option or long form describes a per-skill answer. An
  array still renders no skill, so no rendered byte moves. One residue stays: `when: skills isNot
  none` reads an array as answered, so `/write-doc`'s question is still asked under one, and
  `src/render/write-doc.ts:55` renders nothing for it.
- **The offer on every other track.** Light keeps `/close-out` and `/handoff`; non-code, full keeps
  four; code, full without git keeps five (G2, and the pin at `tests/tracks.test.ts:281`).
- **`standard/`**, both standards, byte for byte. Board row 82 owns the ceiling lead (D18).
- **The rest of `model-routing.md`.** One sentence is added (§4.3); the tier table, the
  `warn-only` and `skip` answers and every other line render as before.
- **The stamp guard** (G14). A hand-written skill of either name is refused, not replaced.
- **The profiles' `skills` answers**: `starter` and `pro` answer `none`, `zach` answers `all` (G5).
- **`commits.md` and the commit guard.** Rows 77 to 79 own them.
- **The engine is a renderer.** No command runs the loop (§2).

## 7. Hazards this work walks into

From the scope, as the gate saw them:

- **Numbered resources claimed twice.** Two rows each created migration 0130 (G31). Builders take
  no ledger number; other numbers are reported per row and clashes listed in the rundown.
- **"Files it owns" is only as good as the column.** Rows 36, 39 and 51 shared files their rows
  did not each list (G31). The collision check cannot see an undeclared file.
- **Machine limits.** Memory, ports and per-agent databases. On 2026-10-03 the orchestrator
  started Docker Desktop, which also restarted another project's stack.
- **A fresh worktree lacks ignored files**, and copying a secret file can be refused with nobody
  there to approve it (the 08:44 denial). Worktree bases can also be stale (HANDOFF 92).
- **Permission mode.** Auto mode went off at about 00:25 and work waited on Zach. A denied call is
  not retried, so the opening round has to settle the mode.
- **The process must stay alive.** The timers are session-scoped (G34); a closed app, a closed
  terminal or a sleeping machine ends the run.
- **`cd` moves the session's working directory** (`HANDOFF.md:211-213`). The orchestrator uses
  `git -C` and absolute paths.
- **Two shipped texts can disagree.** D6 settles the skills against `model-routing.md`; the
  standard's Part 4 still disagrees with both, on purpose (D6).
- **`disable-model-invocation` on `/delegate` would stop `/autopilot` following it** (G37). Only
  `/autopilot` takes the flag (D2).
- **Zach's own unstamped `/delegate` blocks the shipped one** on his machine (G14) until he
  removes it.
- **The build collides with rows 77 to 79** on `catalog.json`, `README.md` and `CHANGELOG.md`
  (G15), and with row 78 on what `agent-commits` means (D10).
- **The Part 5 ceiling lead** is board row 82 (D18).

Found at plan time, 2026-10-04:

- **Project folders write no board** (§1 corrections), so `/autopilot` has nothing to read there.
- **A personal skill wins over a project skill of the same name** (`PLAN.md` G44). A project-level
  install cannot stand in for a hand-written personal `/delegate` in a test.
- **The `skills` long form says an existing skill is backed up and replaced**; the stamp guard
  refuses an unstamped one (`PLAN.md` G43). The long form is wrong for exactly the case this build
  creates.
- **A worktree session cannot write the primary checkout** (`PLAN.md` G52), where the board and the
  ledger live.
- **A row after a signed-off, uncommitted row** builds on a base that lacks its predecessor's work,
  in the same lane or through "Waits on". `PLAN.md` GATE 2 question 5.

## 8. Gate record

### 8.0 The questions, as the gate saw them, 2026-10-03

The batch from the scope's §6, word for word. Each maps to the option of the same number in the
scope's §3 (`git show 3fadd95:docs/incomplete/delegate-autopilot/SCOPE.md`).

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

### 8.1 Answers, Zach in chat, 2026-10-03

**"all recommended".** Every question took the option marked recommended. The scope spelled each
answer out in its §7, and that text is kept here word for word:

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
