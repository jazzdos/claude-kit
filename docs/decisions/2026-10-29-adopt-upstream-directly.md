# Adopt upstream clanker-kit directly; pause the fork

Date: 2026-10-29. Status: accepted.

## Context

The fork existed for three things: model and effort pins that keep
fable out of workflow stages and run standard stages at sonnet/medium,
a stories manifest with the kit `dependencies` field removed (the
hollow-install trap of 2026-10-11), and the `fork-pins` guard test.
Everything else in the fork is documentation.

Each upstream release costs a merge-and-repin pass. On 2026-10-29
upstream (shousper/clanker-kit) was three commits ahead at kit 1.7.0
with the code-standards split and a new state-cleanup hook, and the
fork was still on 1.6.1.

Jarrod's call on 2026-10-29: "just adopt shouspers", after the
trade-offs were laid out (fable pinned at the frontier story-planning
tier, sonnet at effort high in standard stages, no settings-level pin
override, and the dependency field still present upstream).

## Decision

Install `kit` and `stories` from upstream's `shousper-kit` marketplace
(github shousper/clanker-kit) and accept upstream's pins as shipped.
Uninstall `kit@jazzdos-kit` and `stories@jazzdos-kit` and remove the
`jazzdos-kit` marketplace. Set this project to `status: paused`; it is
not archived, so it can be revived if upstream breaks or the pin policy
needs enforcing again.

The hollow-install trap cannot fire from upstream today because
upstream pushes no `kit--vX.Y.Z` tags, so the dependency lookup finds
nothing and the update stays on the marketplace-clone path. If upstream
starts tagging, the check in `~/.claude/notes/known-fixes.md` (17
`SKILL.md` under the installed kit path) applies again.

## Consequences

- The global model-policy directive no longer forbids fable inside a
  bundled workflow stage; fable stays the orchestrator for the main
  session and for anything authored ad hoc.
- `~/.claude/CLAUDE.md` (source: standards `claude/CLAUDE.md`),
  `~/.claude/notes/known-fixes.md`, `~/.claude/notes/directives-log.md`
  and `inventory/projects.md` in the standards repo are updated to
  match.
- Luminosity still runs the jazzdos-kit plugins until its session is
  idle; the switch there is the same three CLI calls.
- Reviving the fork: branch from `upstream/main`, re-apply the pins
  listed in `tests/static/fork-pins.test.ts`, tag, and reinstall from
  `jazzdos/claude-kit`.
