# Drop the stories manifest's dependency on kit

Date: 2026-10-11. Status: accepted.

## Context

The 2026-10-11 release (kit 1.6.0, stories 0.6.0) was installed with
`claude plugin marketplace update jazzdos-kit`, then
`claude plugin update kit@jazzdos-kit`, then
`claude plugin update stories@jazzdos-kit` on Claude Code 2.1.296. Kit
landed in `~/.claude/plugins/cache/jazzdos-kit/kit/1.6.0-d163944273cc`
with 13 files and no `SKILL.md`; no `kit:*` skill loaded and every kit
hook failed, since they source the missing `hooks/shared` library. A
complete copy sat beside it in `kit/1.6.0` and was later marked
orphaned. Stories 0.6.0 installed complete.

Reproduced in an isolated `CLAUDE_CONFIG_DIR` with `--debug-file`. The
update log shows the mechanism:

1. `plugins/stories-claude/.claude-plugin/plugin.json` declared
   `"dependencies": [{ "name": "kit", "version": "^1.2.0" }]`.
2. Updating a plugin that an installed plugin depends on makes Claude
   Code resolve it as "highest tag satisfying ^1.2.0 from stories". It
   found `kit--v1.6.0` and switched the source to
   `{"source":"git-subdir","path":"plugins/kit-claude","ref":"kit--v1.6.0"}`.
3. A git-subdir source is a sparse checkout of that path alone, into a
   temp dir. The 22 symlinks into the repo-root `shared/` dangle there,
   and the copy into the cache logs `copyDir: skipping broken symlink`
   for each one. The result is recorded as the installed path, under a
   `<version>-<sha12>` name with `resolvedVersion: 1.6.0`.
4. Without a dependent, the same update copies from the marketplace
   clone, where the symlinks resolve and are dereferenced into real
   files. That is the path stories took, and the path a fresh
   `claude plugin install kit@jazzdos-kit` takes.

The constraint is read from the installed stories manifest, not the
marketplace clone (tested both ways). A local-directory marketplace
reproduces the fault too, using the local repo's tags.

Upstream shousper/clanker-kit carries the same dependency but pushes
no tags, so the tag lookup finds nothing there and the update stays on
the marketplace path. This fork tags every release.

## Decision

Remove the `dependencies` field from the stories Claude manifest and
bump stories to 0.6.1 (fork-only change, no upstream bump).
`tests/static/fork-pins.test.ts` fails if an upstream merge brings the
field back.

## Alternatives considered

- Flatten `plugins/kit-claude` at release time so the git-subdir
  checkout is self-contained. Rejected: it breaks upstream's shared/
  layout and the symlink-integrity tests, and needs a build step on
  every release.
- Stop pushing `<plugin>--vX.Y.Z` tags. Rejected: the trap re-arms the
  first time anyone tags, and the README release convention stays.
- Wait for Claude Code to dereference symlinks that resolve inside the
  repository. Out of the fork's control; a bug report was queued from
  the session that found the fault.

## Consequences

- Installing stories no longer pulls kit in automatically; the README
  Install block already installs kit first.
- The fix only takes effect on a machine once stories 0.6.1 is
  installed there, because the constraint comes from the installed
  manifest. Until then every `claude plugin update kit@jazzdos-kit`
  reproduces the hollow install. Rollout: merge, push, tag
  `stories--v0.6.1`, then `claude plugin marketplace update jazzdos-kit`
  and `claude plugin update stories@jazzdos-kit`.
- Check after any kit update: the installed kit path must hold 17
  `SKILL.md` files. The command is in `~/.claude/notes/known-fixes.md`.

## Verification

- Isolated config, dependency present: update from 1.3.0 lands in
  `1.6.0-d163944273cc`, 0 `SKILL.md`, 22 skipped symlinks.
- Isolated config, dependency removed: update from 1.3.0 lands in
  `1.6.0`, 17 `SKILL.md`, no git-subdir source in the log.
- Local-directory marketplace from this branch: same result as the
  dependency-removed case (recorded in the handoff).
