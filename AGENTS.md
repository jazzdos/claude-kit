# claude-kit

## What this project is

The `jazzdos-kit` Claude Code plugin marketplace, hosting the `kit` and
`stories` plugins (`plugins/kit/`, `plugins/stories/`). It is a personal
fork of shousper/claude-kit in which opus/xhigh stages run on fable/high.
See README.md and plugins/stories/README.md.

## Conventions

- Toolchain: bun. Run `bun install` once after cloning.
- Run `bun run test` before every commit (the `test` script: static,
  stories, fixtures, utils). This is the same command CI runs.
- A bare `bun test` (or `bun run test:all`) also runs `tests/evals`,
  which spawn real Claude Code sessions, take minutes, and cost money.
  Run `bun run test:evals` or `bun run test:evals:smoke` only
  deliberately.
- CI also runs `claude plugin validate plugins/<name> --strict` for
  both plugins; run it locally before a release when the CLI is
  available.
- No linter is configured.
- Version bump rule: bump both `plugins/<name>/.claude-plugin/plugin.json`
  and that plugin's entry in `.claude-plugin/marketplace.json` together
  (checked by the static test suite). The two plugins version and
  release independently; tag `<plugin>--vX.Y.Z` on main after merging.
- Install `kit@jazzdos-kit` and `stories@jazzdos-kit` from this
  marketplace only, never from `shousper-kit`. The README Install block
  is upstream text that still names shousper.
- Edit `plugins/` here, never the installed copy under the Claude
  plugin cache directory (`~/.claude/plugins/cache/`); merge first,
  then update the installed plugin.
- In `.gitignore`, the negation block for
  `tests/fixtures/workspace-stories/.claude/` must stay last.
- Design and plan docs: `docs/plans/`. Handoffs: `docs/handoffs/`.
  Decisions: `docs/decisions/`.

## Machines

Developed on lux; remote on GitHub under jazzdos.
