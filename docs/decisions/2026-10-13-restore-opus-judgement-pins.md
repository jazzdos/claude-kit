# Restore opus/xhigh judgement pins; fable is the orchestrator only

Date: 2026-10-13. Status: accepted. Supersedes the fork rule "every
opus/xhigh stage upstream runs on fable/high".

## Context

Standards commit a42a4a5 (directives log, 2026-10-13) set a new model
policy: fable 5.1 is the orchestrator (main session) only, with opus 5.5
at xhigh as its fallback when fable usage is exhausted. Judgement stages
run on opus at xhigh, never fable, and kit's bundled workflows pin no
stage to fable. The fork had rewritten every upstream opus/xhigh pin to
fable/high (`docs/plans/2026-09-03-effort-pin-test-repair.md`,
`docs/plans/2026-10-11-adopt-clanker-kit-upstream.md`).

## Decision

| Stage | Before | Upstream | Now |
|---|---|---|---|
| build-flow quality review, final batch | fable/high | opus/xhigh | opus/xhigh |
| build-flow fix, last round | fable/high | opus/high | opus/xhigh |
| build-flow verify-fix, second round | fable/high | opus/high | opus/xhigh |
| code-review architecture | fable/high | opus/xhigh | opus/xhigh |
| stories planner, hard | fable/high | opus/xhigh | opus/xhigh |
| stories planner, frontier | fable/high | fable/xhigh | opus/xhigh |

The sonnet/high to sonnet/medium rule is unchanged. Build-flow's final
verification stays sonnet/low and code-review's verifiers stay
sonnet/medium.

Two sites depart from upstream. The fix and verify-fix escalation rounds
use xhigh, not upstream's high, because the policy names staged-escalation
fix rounds as judgement stages. The frontier planner uses opus, not
upstream's fable, because the policy forbids fable in bundled workflows.

The using-kit Fan-out table names `opus, effort xhigh` for the hardest
judgement calls instead of upstream's "strongest tier", since fable is
now the strongest tier and the row must not point at it. Its fable row
states the orchestrator-only rule and the opus xhigh fallback.

## Known gap

`kit:code-reviewer` (`shared/agents/code-reviewer.md`) keeps upstream's
`model: inherit`. Dispatched from a fable main session without a model
override, it runs on fable. The using-kit table tells the orchestrator to
pick a model on every Agent call, which covers this; pinning the agent
would diverge from upstream in `shared/`.

## Guard

`tests/static/fork-pins.test.ts` fails if a Claude-side runner or launch
doc names fable, if a runner pins effort 'high', if a runner or launch
doc loses its opus/xhigh pin, or if the shared tables drift. The runner
tests assert each stage's exact model and effort.
