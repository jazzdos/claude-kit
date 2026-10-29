# claude-kit

## What this project is

The `jazzdos-kit` Claude Code plugin marketplace, a personal fork of
shousper/clanker-kit (formerly shousper/claude-kit). It hosts the `kit`,
`stories` and `writing` plugins. Only `kit` and `stories` are installed;
`writing` is listed but unused (its forced output style conflicts with the
writing pillar in the standards repo).

Paused 2026-10-29: `kit` and `stories` now install from upstream's
`shousper-kit` marketplace with upstream's pins as shipped. See
`docs/decisions/2026-10-29-adopt-upstream-directly.md`. The notes below
describe the fork as it stands if it is revived.

The fork's pin rules (2026-10-13): fable is the orchestrator (main
session) only, so no bundled workflow stage pins it. Judgement stages
(final-batch quality review, fix and verify-fix escalation, code-review
architecture, hard and frontier story planning) run on opus/xhigh, and
every sonnet/high stage upstream runs at sonnet/medium. Build-flow's
final verification stays sonnet/low. `tests/static/fork-pins.test.ts`
fails if an upstream merge reintroduces a fable pin or a 'high' effort.
See `docs/decisions/2026-10-13-restore-opus-judgement-pins.md`.

See README.md (upstream text) and shared/stories/README.md.

## Layout

- `shared/` holds harness-neutral content: skills, hooks, agents,
  commands, code standards, the stories library, and the writing plugin
  body. `plugins/kit-claude/`, `plugins/stories-claude/` and
  `plugins/writing-claude/` symlink into it and add Claude-specific
  files (`hooks.json`, hook wrappers, `launch.md`, `*.workflow.js`).
- `plugins/*-omp/` and `.omp-plugin/` are upstream's plugins for the OMP
  harness (oh-my-pi). They are never installed here. Keep them in the tree
  untouched so the symlink-integrity tests and future upstream merges stay
  clean.
- Model and effort pins live in `plugins/kit-claude/skills/build-flow/build.workflow.js`,
  `plugins/kit-claude/skills/code-review/review.workflow.js` and
  `plugins/stories-claude/skills/work/plan.workflow.js`. The matching
  prose tables are in each plugin's `launch.md` and in the shared
  `SKILL.md` files for build-flow, code-review and using-kit.

## Conventions

- Toolchain: bun. Run `bun install` once after cloning.
- Run `bun run test` before every commit (the `test` script: static,
  stories, fixtures, utils). This is the same command CI runs.
- A bare `bun test` (or `bun run test:all`) also runs `tests/evals`,
  which spawn real Claude Code sessions, take minutes, and cost money.
  Run `bun run test:evals` or `bun run test:evals:smoke` only
  deliberately.
- CI also runs `claude plugin validate .claude-plugin/marketplace.json`
  and `claude plugin validate plugins/<name>` for each plugin with a
  manifest, without `--strict`: the validator does not follow symlinks
  and warns on each symlinked component. Run both locally before a
  release when the CLI is available.
- No linter is configured.
- Version numbers follow upstream verbatim. Bump a patch only for a
  fork-only change with no upstream bump, and bump both
  `plugins/<name>/.claude-plugin/plugin.json` and that plugin's entry in
  `.claude-plugin/marketplace.json` together (checked by the static
  suite). Tag `<plugin>--vX.Y.Z` on main after merging.
- `plugins/stories-claude/.claude-plugin/plugin.json` declares no
  `dependencies`. With one, `claude plugin update kit` resolves kit
  through a git-subdir checkout of `plugins/kit-claude` alone at the
  highest `kit--vX.Y.Z` tag, where the symlinks into `shared/` dangle and
  are dropped, leaving a kit with no skills. Guarded by
  `tests/static/fork-pins.test.ts`; see `docs/decisions/`.
- Since 2026-10-29 `kit` and `stories` install from upstream's
  `shousper-kit` marketplace (shousper/clanker-kit), not from here; the
  README Install block is upstream text and is now the live procedure.
  Reviving the fork means reinstalling from `jazzdos/claude-kit`.
- Edit `plugins/` and `shared/` here, never the installed copy under the
  Claude plugin cache directory (`~/.claude/plugins/cache/`); merge
  first, then update the installed plugin.
- Upstream remote: `upstream` -> github.com/shousper/clanker-kit. To take
  upstream changes, branch from `upstream/main` and re-apply the fork
  pins; `tests/static/fork-pins.test.ts` lists every site.
- In `.gitignore`, the negation block for
  `tests/fixtures/workspace-stories/.claude/` must stay last.
- Design and plan docs: `docs/plans/`. Handoffs: `docs/handoffs/`.
  Decisions: `docs/decisions/`.

## Machines

Developed on lux; remote on GitHub under jazzdos.
