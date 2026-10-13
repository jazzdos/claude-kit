# Restore opus/xhigh judgement pins (design)

Date: 2026-10-13. Approved by Jarrod in session.

## Context

Model policy changed in standards commit a42a4a5
(`~/.claude/notes/directives-log.md`, entry 2026-10-13): fable 5.1 is the
orchestrator (main session) only, with opus 5.5 at xhigh as its fallback
when fable usage is exhausted. Judgement stages (final quality gates,
architecture review, adversarial verification, staged-escalation fix
rounds, hard and frontier story planning) run on opus at xhigh, never
fable. Kit's bundled workflows pin no stage to fable.

This reverses the fork rule "every opus/xhigh stage upstream runs on
fable/high" (AGENTS.md, introduced by
`docs/plans/2026-09-03-effort-pin-test-repair.md` and re-applied by
`docs/plans/2026-10-11-adopt-clanker-kit-upstream.md`). The separate rule
"every sonnet/high stage runs at sonnet/medium" stays. Verifier stages
stay as they are.

Upstream values come from `upstream/main` (6ab3856, also the merge base).

## Pin table

| Site | Now | Upstream | New |
|---|---|---|---|
| build-flow quality review, final batch | fable/high | opus/xhigh | opus/xhigh |
| build-flow fix, last round | fable/high | opus/high | opus/xhigh |
| build-flow verify-fix, second round | fable/high | opus/high | opus/xhigh |
| code-review architecture dimension | fable/high | opus/xhigh | opus/xhigh |
| stories planner, hard | fable/high | opus/xhigh | opus/xhigh |
| stories planner, frontier | fable/high | fable/xhigh | opus/xhigh |
| every sonnet stage | sonnet/medium | sonnet/high | sonnet/medium |
| build-flow final verification | sonnet/low | sonnet/low | sonnet/low |
| code-review verifiers | sonnet/medium | sonnet/high | sonnet/medium |

Two sites depart from upstream on purpose. Fix and verify-fix escalation
use xhigh because the policy names staged-escalation fix rounds as
judgement stages. The frontier planner uses opus because the policy
forbids fable in bundled workflows.

## Decisions taken in the brainstorm

- Code-review verifiers stay sonnet/medium. They fan out one agent per
  finding, upstream chose sonnet deliberately, and the brief's site list
  omits them.
- `kit:code-reviewer` keeps `model: inherit` (upstream value). The
  using-kit table already tells the orchestrator to pick a model on every
  Agent call. Recorded in the decision record as a known inherit path.
- `shared/skills/code-review/SKILL.md:40` keeps the fork's wording, which
  matches the workflow (upstream's sentence puts quality and security on
  the arbiter tier, which its own workflow does not do). Only the arbiter
  effort changes, high to xhigh.
- The using-kit "Hardest judgment calls" row says `opus, effort xhigh`,
  not upstream's "strongest tier", since fable is now the strongest tier.
  Lowercase keeps `tests/static/neutral-prose.test.ts` satisfied.
- `tests/fixtures/events/claude-skill-activation.jsonl` is an untouched
  upstream fixture and stays as is.

## Changes

1. Workflows: `plugins/kit-claude/skills/build-flow/build.workflow.js`,
   `plugins/kit-claude/skills/code-review/review.workflow.js`,
   `plugins/stories-claude/skills/work/plan.workflow.js`, per the table,
   with the inline comments updated.
2. Prose: the three `launch.md` files; the shared build-flow table
   ("medium (xhigh on final)", "medium (xhigh on the arbiter round)");
   shared code-review line 40; using-kit Fan-out table, where the fable
   row becomes the orchestrator-only rule with the opus xhigh fallback.
3. Fork docs: AGENTS.md fork rule (lines 11-14), the marketplace
   description, and the fork-rule line in `~/.claude/notes/known-fixes.md`.
4. Tests, written first and seen failing:
   - `tests/static/build-flow-runner.test.ts`,
     `tests/static/code-review-runner.test.ts`,
     `tests/static/story-planner-runner.test.ts` assert opus/xhigh at the
     restored sites.
   - `tests/static/fork-pins.test.ts` becomes the guard for the new rule:
     no `*-claude` workflow or `launch.md` names fable; each judgement
     stage is opus/xhigh; no workflow effort is `'high'` (the sonnet/medium
     rule); using-kit carries the orchestrator row. The marketplace
     identity and stories no-dependencies guards stay.
5. Decision record `docs/decisions/2026-10-13-restore-opus-judgement-pins.md`.
6. Versions: kit 1.6.0 to 1.6.1, stories 0.6.1 to 0.6.2, in each
   `plugin.json` and in `.claude-plugin/marketplace.json`.

## Verification and release

- `bun run test` (never bare `bun test`).
- `grep -rIn -i fable . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.worktrees`
  shows fable only in: the using-kit orchestrator row, the AGENTS.md
  rule, the fork-pins guard, the upstream fixture, and dated docs under
  `docs/`.
- Merge to main, tag `kit--v1.6.1` and `stories--v0.6.2`, push main and
  tags, `claude plugin marketplace update jazzdos-kit`, update
  `kit@jazzdos-kit` and `stories@jazzdos-kit`, then the known-fixes check
  (17 SKILL.md files in the installed kit).
