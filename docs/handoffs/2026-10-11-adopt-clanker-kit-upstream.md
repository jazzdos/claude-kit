# Handoff: adopt upstream clanker-kit (2026-10-11)

Branch: `feature/adopt-clanker-kit-upstream`, branched from `upstream/main`
at 6ab3856 (shousper/clanker-kit). Design:
`docs/plans/2026-10-11-adopt-clanker-kit-upstream-design.md`. Plan:
`docs/plans/2026-10-11-adopt-clanker-kit-upstream.md`.

## What this branch does

- Takes upstream verbatim: dual-harness layout (`shared/` plus symlinked
  `plugins/*-claude` and `plugins/*-omp`), dead-agent blocking in the
  runners, stories 0.6.0 state store, standards gate hooks, bundled
  Python and C++ standards, the writing plugin (listed, not installed).
- Re-applies the fork: marketplace `jazzdos-kit` owned by `jazzdos`;
  fable/high in place of every opus/xhigh pin and sonnet/medium in place
  of every sonnet/high pin in `build.workflow.js`, `review.workflow.js`
  and the stories `plan.workflow.js`; matching prose tables in the three
  `launch.md` files and the shared build-flow, code-review and using-kit
  SKILL.md; AGENTS.md, CLAUDE.md, docs triad and the `.gitignore`
  baseline block.
- Adds `tests/static/fork-pins.test.ts`, which fails if a future upstream
  merge reintroduces an opus or xhigh pin on the Claude side.
- Versions follow upstream: kit 1.6.0, stories 0.6.0, writing 0.1.1.

Verification at handoff: `bun run test` 1188 pass, 17 skip, 0 fail;
`claude plugin validate` exits 0 for the marketplace and each of the
three Claude plugins (symlink warnings only).

## Next steps in this repo (need Jarrod's ask)

1. Merge to `main` and push to github.com/jazzdos/claude-kit.
2. Tag `kit--v1.6.0` and `stories--v0.6.0` on main.
3. Update the installed plugins on lux:

```
claude plugin marketplace update jazzdos-kit
claude plugin update kit@jazzdos-kit
claude plugin update stories@jazzdos-kit
```

Installed today: kit 1.3.0 and stories 0.2.0 from the cache at
`~/.claude/plugins/cache/jazzdos-kit/`.

## Follow-ups outside this repo (after the plugin update)

- Run `story doctor` once in each stories project: pd-revision, shopping,
  hiking-trip, env-health, env-health/dataplatform, mine-footprint-seg,
  meta, rl-tba, ~/Documents/standards. It moves the marker to
  `.agents/shousper-stories/config.json` and rewrites the gitignore
  block. pd-revision and meta carry a duplicated gitignore block to check
  afterwards.
- Remove the "run kit:code-standards" line (the skill no longer exists;
  the standards gate replaces it) from CLAUDE.md in wa-mine-rehab-monitor,
  tec-marker-validation, env-health/Bushfire and rl-tba, and from
  rl-tba/AGENTS.md line 21.
- Standards repo on lux: `pillars/claude-md.md:96` is the template line
  behind those four CLAUDE.md files.
- `~/.claude/notes/known-fixes.md` lines 44 to 48 name the old upstream
  (shousper/claude-kit, now shousper/clanker-kit); line 105 references
  the removed skill.
- ENVR3310 and every other non-stories project need nothing.

## Flagged for later

- Writing plugin: forced output style conflicts with `pillars/writing.md`
  on em dashes, and Vale is a new brew dependency. Option: adopt only the
  Vale hook with an em-dash rule matching the pillar.
- Review the bundled Python standards (750 lines, new) against
  STANDARDS.md once upstream's `shousper/standards-units` branch lands;
  that branch reworks the code-standards area across 60 files.
- The standards gate hooks Edit, Write and MultiEdit only. Bypass
  permissions sessions that edit through Bash are never gated.
- `shared/skills/writing-skills/anthropic-best-practices.md` mentions
  Opus three times as third-party reference text; left as upstream wrote
  it.
