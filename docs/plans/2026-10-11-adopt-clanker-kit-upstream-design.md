# Design: adopt upstream clanker-kit and re-apply fork pins

Status: approved 2026-10-11
Branch: `feature/adopt-clanker-kit-upstream` (from `upstream/main` at 6ab3856)
Fork point: afe2525

## Context

Upstream shousper/claude-kit was renamed to shousper/clanker-kit and moved
20 commits past the fork point, touching 414 files. The fork carries four
commits over 16 files: model and effort pins (opus/xhigh to fable/high,
sonnet/high to sonnet/medium), the jazzdos-kit marketplace rename, and the
AGENTS.md, CLAUDE.md and docs triad. Seven of the eight fork-touched files
moved in the upstream dual-harness split, so the fork's changes are
re-applied by hand on top of upstream rather than merged.

Installed on this machine today: kit 1.3.0 and stories 0.2.0 from the
jazzdos-kit marketplace, which is sourced from github.com/jazzdos/claude-kit.
The 1.3.1 commit on main was never installed.

## Decisions

| Item | Decision | Reason |
| --- | --- | --- |
| Route | Branch from upstream/main, re-apply fork edits by hand | Fork delta is about 20 lines of pins plus docs; upstream delta is 18k lines |
| Dual-harness layout (shared/ plus symlinked kit-claude, kit-omp) | Adopt as-is | Every later upstream commit assumes it |
| OMP plugins and .omp-plugin/ | Keep in tree, never install | Deleting them breaks the symlink-integrity test and future merges |
| Dead-agent blocking in runners | Adopt | Fixes silent fake-done on stopped or crashed stage agents |
| Stories 0.6.0 | Adopt | Local state store, session-bound loops, in-flight tick hold, worktree-safe hooks, idempotent done |
| Standards gate | Adopt now | Replaces the manual kit:code-standards call; comes with the tree; only Python triggers it in current projects |
| Bundled Python standards (750 lines, new) | Adopt now, review later | At 0.2.0 the Python standards file was a bare heading; check against STANDARDS.md after upstream's standards-units branch lands |
| Writing plugin | Flag for later; stays listed, never installed | Forced output style conflicts with pillars/writing.md on em dashes; Vale is a new brew dependency |
| Version numbers | Keep upstream's verbatim: kit 1.6.0, stories 0.6.0, writing 0.1.1 | The fork is its own marketplace; a patch bump is only needed for fork-only changes without an upstream bump |

## Repo changes

1. Marketplace: `.claude-plugin/marketplace.json` name becomes `jazzdos-kit`,
   owner `jazzdos`, description names the fork. Plugin entries and sources
   stay as upstream (kit at `./plugins/kit-claude`, stories at
   `./plugins/stories-claude`, writing at `./plugins/writing-claude`).
2. Pins, fable/high replaces every opus/xhigh, sonnet/medium replaces
   every sonnet/high:
   - `plugins/kit-claude/skills/build-flow/build.workflow.js` lines 253,
     266, 270, 281, 283, 287, 310
   - `plugins/kit-claude/skills/code-review/review.workflow.js` lines
     18 to 22, 74
   - `plugins/stories-claude/skills/work/plan.workflow.js` lines 27 to 29
     (routine sonnet/medium, hard fable/high, frontier fable/high)
   - Verify stage stays sonnet/low.
3. Prose tables that state the pins: `plugins/kit-claude/skills/build-flow/launch.md`,
   `plugins/kit-claude/skills/code-review/launch.md`,
   `plugins/stories-claude/skills/work/launch.md`.
4. Fan-out table in `shared/skills/using-kit/SKILL.md`: strongest tier row
   says fable at high; frontier row records the standing substitution.
   Lowercase model names pass the neutral-prose test.
5. Tests updated to assert the fork pins:
   `tests/static/build-flow-runner.test.ts`,
   `tests/static/code-review-runner.test.ts`,
   `tests/static/story-planner-runner.test.ts`. A sonnet/medium
   assertion is added where upstream only asserts model names.
6. Fork docs carried over from main: `AGENTS.md`, `CLAUDE.md`,
   `docs/plans/2026-09-03-effort-pin-test-repair.md`,
   `docs/decisions/.gitkeep`, `docs/handoffs/.gitkeep`, and the
   `.gitignore` additions. AGENTS.md is updated for the shared/ layout,
   drops `--strict` from the validate instruction, notes the OMP plugins
   are never installed, and names the upstream as shousper/clanker-kit.
7. README stays upstream text. The known stale install block is already
   recorded in AGENTS.md.

## Rollout to projects

The plugins are user-scope installs from a GitHub-sourced marketplace. The
update path is: merge to main, push on Jarrod's ask, then
`claude plugin marketplace update jazzdos-kit` and
`claude plugin update kit@jazzdos-kit` and `stories@jazzdos-kit`.

Per-project actions after the plugin update, outside this repo:

- Nine stories projects run `story doctor` once: pd-revision, shopping,
  hiking-trip, env-health, env-health/dataplatform, mine-footprint-seg,
  meta, rl-tba, and ~/Documents/standards. The marker moves to
  `.agents/shousper-stories/config.json`, story files move under its
  `local/`, and the gitignore block is rewritten. pd-revision and meta
  carry a duplicated gitignore block to check afterwards.
- No persona copies. No gate in any project names a persona, and the
  files under env-health's `.claude/agents/` are ordinary subagents.
- Four project CLAUDE.md files drop the "run kit:code-standards" line:
  wa-mine-rehab-monitor, tec-marker-validation, env-health/Bushfire,
  rl-tba. rl-tba's AGENTS.md line 21 makes the same claim.
- Standards repo on lux: `pillars/claude-md.md:96` is the template line
  behind those four. `~/.claude/notes/known-fixes.md` lines 45 to 48 name
  the old upstream repo.
- ENVR3310 and every other non-stories project need nothing.

## Flagged for later

- Writing plugin, or only its Vale hook with an em-dash rule matching the
  pillar.
- Review bundled Python standards against STANDARDS.md.
- Upstream branch `shousper/standards-units` reworks code standards
  across 60 files; expect to re-merge the gate area.
- The gate hooks Edit, Write and MultiEdit only. Bypass-permissions
  sessions prefer Bash edits, which it never sees.

## Verification

- `bun run test` green (baseline on upstream/main: 1175 pass, 17 skip).
- `claude plugin validate .claude-plugin/marketplace.json` and each
  `plugins/*/` without `--strict`.
- Effort-pin tests assert fable/high and sonnet/medium at every site.
- No `opus` or `xhigh` pin remains in `plugins/kit-claude/**` or
  `plugins/stories-claude/**` outside OMP files.
