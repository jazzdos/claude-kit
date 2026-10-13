# Restore opus/xhigh judgement pins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use kit:build-flow to execute this plan.

**Goal:** Pin every judgement stage in the fork's Claude-side workflows to opus/xhigh, pin no stage to fable, keep every sonnet stage at medium, and make the prose, guard tests and versions match.

**Architecture:** Three workflow scripts hold the pins (`build.workflow.js`, `review.workflow.js`, `plan.workflow.js`). Hermetic runner tests assert the pins by executing the scripts against a fake `agent()`. `tests/static/fork-pins.test.ts` is the fork's regression guard over the scripts and the prose that documents them. Design: `docs/plans/2026-10-13-restore-opus-judgement-pins-design.md`.

**Tech Stack:** bun test (TypeScript), plain JavaScript workflow scripts, Markdown, JSON manifests.

**Test command rule:** run single files with `bun test tests/static/<file>.test.ts`, and the suite with `bun run test`. Never run a bare `bun test` (it also runs `tests/evals`, which spawn paid Claude sessions).

---

### Task 1: Runner tests assert opus/xhigh at the judgement stages (red)

**Files:**
- Modify: `tests/static/build-flow-runner.test.ts:209-262`
- Modify: `tests/static/code-review-runner.test.ts:80-93`
- Modify: `tests/static/story-planner-runner.test.ts:126-129`

**Step 1: Edit `tests/static/build-flow-runner.test.ts`**

Replace the fix-escalation test title and its two expectations:

```ts
  it("escalates the fix agent from sonnet/medium to opus/xhigh on the final round", async () => {
```
```ts
    const fixes = r.calls.filter((c) => c.role === "fix");
    expect(fixes.map((c) => c.opts?.model)).toEqual(["sonnet", "opus"]);
    expect(fixes.map((c) => c.opts?.effort)).toEqual(["medium", "xhigh"]);
```

Replace the quality-review test title and its two expectations:

```ts
  it("escalates the quality review to opus/xhigh only on the final batch", async () => {
```
```ts
    expect(quality.map((c) => c.opts?.model)).toEqual(["sonnet", "opus"]);
    expect(quality.map((c) => c.opts?.effort)).toEqual(["medium", "xhigh"]);
```

Replace the verify-fix test title and its last two expectations (the `["low", "low", "low"]` verifier assertion stays):

```ts
  it("escalates verify-fix from sonnet/medium to opus/xhigh on the second round", async () => {
```
```ts
    const fixes = r.calls.filter((c) => c.role === "verify-fix");
    expect(fixes.map((c) => c.opts?.model)).toEqual(["sonnet", "opus"]);
    expect(fixes.map((c) => c.opts?.effort)).toEqual(["medium", "xhigh"]);
```

Leave "runs implementation, spec review and re-check on sonnet at medium" unchanged.

**Step 2: Edit `tests/static/code-review-runner.test.ts`**

```ts
  it("pins the architecture dimension to opus/xhigh and the rest to sonnet/medium", async () => {
```
```ts
      "review:architecture": ["opus", "xhigh"],
```

Leave the four sonnet/medium dimension rows and "verifies findings on sonnet at medium" unchanged.

**Step 3: Edit `tests/static/story-planner-runner.test.ts`**

```ts
  it("claude pins model and effort per complexity: routine sonnet/medium, hard and frontier opus/xhigh", async () => {
    const { calls } = await runClaude([story("st-0001"), story("st-0002", "hard"), story("st-0003", "frontier")], () => planned);
    expect(calls.map((c) => [c.model, c.effort])).toEqual([["sonnet", "medium"], ["opus", "xhigh"], ["opus", "xhigh"]]);
  });
```

**Step 4: Run the three files and confirm they fail**

Run: `bun test tests/static/build-flow-runner.test.ts tests/static/code-review-runner.test.ts tests/static/story-planner-runner.test.ts`
Expected: FAIL, exactly 5 failing tests (3 build-flow, 1 code-review, 1 story-planner), each showing `"fable"` received where `"opus"` was expected.

### Task 2: Rewrite the fork guard for the new rule (red)

**Files:**
- Modify (full rewrite): `tests/static/fork-pins.test.ts`

**Step 1: Replace the file with:**

```ts
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { KIT_CLAUDE_ROOT, MARKETPLACE_DIR, SKILLS_DIR, STORIES_CLAUDE_ROOT } from "../utils/paths";

// jazzdos-kit is a fork of shousper/clanker-kit with two standing pin rules (2026-10-13,
// docs/decisions/2026-10-13-restore-opus-judgement-pins.md). Fable is the orchestrator
// (main session) only, so no Claude-side runner pins it; every judgement stage runs on
// opus/xhigh. Every sonnet/high stage upstream runs at sonnet/medium, so no runner pins
// effort 'high'. These guards fail the moment an upstream merge reintroduces a fable pin
// or a 'high' effort, or a prose table drifts from the pins.

const read = (p: string) => readFileSync(p, "utf-8");

const ORCHESTRATOR_ROW =
  "| fable | orchestrator (main session) only, never a subagent or workflow stage; when fable usage is exhausted, the orchestrator falls back to opus, effort xhigh |";

describe("fork: marketplace identity", () => {
  it("is published as jazzdos-kit, owned by jazzdos", () => {
    const m = JSON.parse(read(resolve(MARKETPLACE_DIR, "marketplace.json")));
    expect(m.name).toBe("jazzdos-kit");
    expect(m.owner).toEqual({ name: "jazzdos" });
    expect(m.plugins.map((p: { name: string }) => p.name)).toEqual(["kit", "writing", "stories"]);
  });
});

describe("fork: Claude-side runners and launch prose", () => {
  const root = resolve(MARKETPLACE_DIR, "..", "plugins");
  const files: string[] = [];
  for (const plugin of readdirSync(root)) {
    if (!plugin.endsWith("-claude")) continue;
    for (const skill of readdirSync(join(root, plugin, "skills"))) {
      const dir = join(root, plugin, "skills", skill);
      if (!statSync(dir).isDirectory()) continue;
      for (const f of readdirSync(dir)) {
        if (f.endsWith(".workflow.js") || f === "launch.md") files.push(join(dir, f));
      }
    }
  }

  it("finds the runner and launch files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("never name fable", () => {
    const offenders = files.filter((f) => /fable/i.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("never pin effort 'high' in a runner (sonnet/high runs at sonnet/medium)", () => {
    const offenders = files.filter((f) => f.endsWith(".workflow.js") && /['"]high['"]/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});

describe("fork: judgement stages pin opus/xhigh on the Claude side", () => {
  const workflows = [
    resolve(KIT_CLAUDE_ROOT, "skills/build-flow/build.workflow.js"),
    resolve(KIT_CLAUDE_ROOT, "skills/code-review/review.workflow.js"),
    resolve(STORIES_CLAUDE_ROOT, "skills/work/plan.workflow.js"),
  ];
  for (const file of workflows) {
    it(`${file.split("/plugins/")[1]} pins opus at xhigh`, () => {
      const src = read(file);
      expect(src).toMatch(/['"]opus['"]/);
      expect(src).toMatch(/['"]xhigh['"]/);
    });
  }

  const prose = [
    resolve(KIT_CLAUDE_ROOT, "skills/build-flow/launch.md"),
    resolve(KIT_CLAUDE_ROOT, "skills/code-review/launch.md"),
    resolve(STORIES_CLAUDE_ROOT, "skills/work/launch.md"),
  ];
  for (const file of prose) {
    it(`${file.split("/plugins/")[1]} names Opus at xhigh`, () => {
      const text = read(file);
      expect(text).toMatch(/\bOpus\b/);
      expect(text).toMatch(/\bxhigh\b/);
    });
  }

  it("shared skill tables match the pins, and name fable only as the orchestrator", () => {
    const usingKit = read(resolve(SKILLS_DIR, "using-kit/SKILL.md"));
    expect(usingKit).toContain("| opus, effort xhigh |");
    expect(usingKit).toContain(ORCHESTRATOR_ROW);
    expect(usingKit.replace(ORCHESTRATOR_ROW, "")).not.toMatch(/fable/i);
    for (const skill of ["build-flow", "code-review"]) {
      const text = read(resolve(SKILLS_DIR, skill, "SKILL.md"));
      expect(text).not.toMatch(/fable/i);
      expect(text).toMatch(/\bxhigh\b/);
    }
  });
});

describe("fork: stories declares no plugin dependencies", () => {
  // Claude Code 2.1.296 resolves a plugin that another installed plugin depends on
  // through a git-subdir source at the highest `<plugin>--vX.Y.Z` tag satisfying the
  // range. That source checks out plugins/<plugin>-claude alone, so its symlinks into
  // shared/ dangle and the copy drops them: `claude plugin update kit` then installs a
  // kit with no skills (2026-10-11). Upstream carries the dependency but pushes no tags;
  // this fork tags every release, so the dependency must stay out of the manifest.
  it("plugins/stories-claude/.claude-plugin/plugin.json has no dependencies field", () => {
    const manifest = JSON.parse(read(resolve(STORIES_CLAUDE_ROOT, ".claude-plugin/plugin.json")));
    expect(manifest.dependencies).toBeUndefined();
  });
});
```

**Step 2: Run it and confirm the new guards fail**

Run: `bun test tests/static/fork-pins.test.ts`
Expected: FAIL. Passing: marketplace identity, "finds the runner and launch files", stories no-dependencies. Failing: "never name fable", "never pin effort 'high'", the three "pins opus at xhigh", the three "names Opus at xhigh", and the shared skill tables test (9 failures).

### Task 3: Restore the workflow pins (green for the runner tests)

**Files:**
- Modify: `plugins/kit-claude/skills/build-flow/build.workflow.js:267,270,281,283,310`
- Modify: `plugins/kit-claude/skills/code-review/review.workflow.js:15-17,23`
- Modify: `plugins/stories-claude/skills/work/plan.workflow.js:28-29`

**Step 1: `build.workflow.js`**

Line 267 comment:
```js
    // Quality reviews run on Sonnet at medium; the final batch escalates to Opus at xhigh — its
```
Line 270:
```js
      phase: 'Review', model: finalBatch ? 'opus' : 'sonnet', effort: finalBatch ? 'xhigh' : 'medium', schema: REVIEW_SCHEMA,
```
Line 281:
```js
    const fixModel = round < MAX_FIX_ROUNDS - 1 ? 'sonnet' : 'opus' // staged escalation
```
Line 283, change only the effort expression:
```js
    const fix = await stage(`fix:b${b + 1}:r${round + 1}`, fixPrompt(batch, findings), { phase: 'Fix', model: fixModel, effort: fixModel === 'opus' ? 'xhigh' : 'medium', schema: IMPL_SCHEMA })
```
Line 310:
```js
  const fix = await stage(`verify-fix:r${v + 1}`, verifyFixPrompt(verification), { phase: 'Verify', model: v === 0 ? 'sonnet' : 'opus', effort: v === 0 ? 'medium' : 'xhigh', schema: IMPL_SCHEMA })
```
Do not touch the implementation, spec, re-check (sonnet/medium) or final verification (sonnet/low) stages.

**Step 2: `review.workflow.js`**

Lines 14-17 comment become:
```js
// Sonnet-first: measured across 6 weeks of runs, 69% of review agents return
// zero actionable findings — a top-tier model everywhere was paying frontier rates
// for "LGTM". Architecture keeps Opus (xhigh) as the one deep-judgment safety net;
// the other four dimensions and the verifiers run Sonnet at medium.
```
Line 23:
```js
  { key: 'architecture', focus: 'plan/design alignment, module boundaries, sound abstractions, scalability', model: 'opus', effort: 'xhigh' },
```
The verifier stage (`model: 'sonnet', effort: 'medium'`, line 75) stays.

**Step 3: `plan.workflow.js`**

```js
  hard: { model: 'opus', effort: 'xhigh' },
  frontier: { model: 'opus', effort: 'xhigh' }, // human opt-in, made at board approval
```

**Step 4: Run the runner tests**

Run: `bun test tests/static/build-flow-runner.test.ts tests/static/code-review-runner.test.ts tests/static/story-planner-runner.test.ts`
Expected: PASS, 0 failures.

Run: `bun test tests/static/fork-pins.test.ts`
Expected: still FAIL, only on the launch prose ("never name fable", the three "names Opus at xhigh") and the shared skill tables test. The workflow guards ("never pin effort 'high'", the three "pins opus at xhigh") now pass.

### Task 4: Restore the prose that documents the pins (green for the guard)

**Files:**
- Modify: `plugins/kit-claude/skills/build-flow/launch.md:55-56`
- Modify: `plugins/kit-claude/skills/code-review/launch.md:16`
- Modify: `plugins/stories-claude/skills/work/launch.md:21`
- Modify: `shared/skills/build-flow/SKILL.md:54-55`
- Modify: `shared/skills/code-review/SKILL.md:40`
- Modify: `shared/skills/using-kit/SKILL.md:110-111`

**Step 1: `plugins/kit-claude/skills/build-flow/launch.md` rows 55-56**

```md
| Quality review | Sonnet (Opus on the final batch — its cumulative diff review is the whole-run safety net) | medium (xhigh on final) |
| Fix (staged) | Sonnet → Opus | medium (xhigh on the Opus round) |
```

**Step 2: `plugins/kit-claude/skills/code-review/launch.md` line 16**

```md
`review.workflow.js` pins per-dimension `model`/`effort` in its default `reviewDims`: correctness, quality, tests, and security run on Sonnet (medium); architecture, the one deep-judgment safety net, runs on Opus (xhigh). Verifiers run on Sonnet (medium). Pass a custom `reviewDims` (`[{ key, focus, model, effort }, ...]`) to change this.
```

**Step 3: `plugins/stories-claude/skills/work/launch.md` line 21**

```md
`plan.workflow.js` pins the planner per story complexity: routine → Sonnet (effort medium), hard → Opus (effort xhigh), frontier → Opus (effort xhigh). Every model decision lives in that file; nothing in this session chooses, retries, or substitutes a model.
```

**Step 4: `shared/skills/build-flow/SKILL.md` rows 54-55**

```md
| Quality review | worker (arbiter on the final batch — its cumulative diff review is the whole-run safety net) | medium (xhigh on final) |
| Fix (staged) | worker → arbiter | medium (xhigh on the arbiter round) |
```

**Step 5: `shared/skills/code-review/SKILL.md` line 40**

Change only `Architecture runs on the arbiter tier (high);` to `Architecture runs on the arbiter tier (xhigh);`. The full line becomes:

```md
The default dimensions are correctness, quality, tests, security, and architecture; override `reviewDims` to focus or extend the review. Architecture runs on the arbiter tier (xhigh); correctness, quality, tests, and security run on the worker tier (medium). Exact model pinning is per-platform — see `launch.md` in this skill's directory.
```

**Step 6: `shared/skills/using-kit/SKILL.md` rows 110-111**

```md
| Hardest judgment calls (final quality gate, architecture, adversarial verify of critical findings) | opus, effort xhigh |
| fable | orchestrator (main session) only, never a subagent or workflow stage; when fable usage is exhausted, the orchestrator falls back to opus, effort xhigh |
```

Keep `opus` lowercase: `tests/static/neutral-prose.test.ts` rejects `| Opus` in shared SKILL.md tables.

**Step 7: Run the guard and the prose tests**

Run: `bun test tests/static/fork-pins.test.ts tests/static/neutral-prose.test.ts tests/static/launch-resources.test.ts`
Expected: PASS, 0 failures.

### Task 5: Fork docs, decision record and marketplace description

**Files:**
- Modify: `AGENTS.md:11-14`
- Modify: `.claude-plugin/marketplace.json:3`
- Create: `docs/decisions/2026-10-13-restore-opus-judgement-pins.md`

**Step 1: `AGENTS.md` lines 11-14 become**

```md
The fork's pin rules (2026-10-13): fable is the orchestrator (main
session) only, so no bundled workflow stage pins it. Judgement stages
(final-batch quality review, fix and verify-fix escalation, code-review
architecture, hard and frontier story planning) run on opus/xhigh, and
every sonnet/high stage upstream runs at sonnet/medium. Build-flow's
final verification stays sonnet/low. `tests/static/fork-pins.test.ts`
fails if an upstream merge reintroduces a fable pin or a 'high' effort.
See `docs/decisions/2026-10-13-restore-opus-judgement-pins.md`.
```

**Step 2: `.claude-plugin/marketplace.json` line 3 becomes**

```json
  "description": "Personal Claude Code toolkit (jazzdos fork of shousper/clanker-kit: judgement stages on opus/xhigh, sonnet stages at medium)",
```

**Step 3: Create `docs/decisions/2026-10-13-restore-opus-judgement-pins.md`**

```md
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
```

**Step 4: Check the manifest still parses and the static suite for plugins passes**

Run: `bun test tests/static/plugin.test.ts tests/static/fork-pins.test.ts`
Expected: PASS, 0 failures.

### Task 6: Bump kit and stories versions

**Files:**
- Modify: `plugins/kit-claude/.claude-plugin/plugin.json:4`
- Modify: `plugins/stories-claude/.claude-plugin/plugin.json:4`
- Modify: `.claude-plugin/marketplace.json:11,23`

**Step 1: Set the versions**

- `plugins/kit-claude/.claude-plugin/plugin.json`: `"version": "1.6.1",`
- `.claude-plugin/marketplace.json` kit entry (line 11): `"version": "1.6.1",`
- `plugins/stories-claude/.claude-plugin/plugin.json`: `"version": "0.6.2",`
- `.claude-plugin/marketplace.json` stories entry (line 23): `"version": "0.6.2",`

Leave the writing entry (0.1.1) and every `plugins/*-omp` and `.omp-plugin` manifest unchanged.

**Step 2: Run the version-sync tests**

Run: `bun test tests/static/plugin.test.ts tests/static/stories-plugins.test.ts`
Expected: PASS, 0 failures.

### Task 7: Full verification

**Step 1: Full suite**

Run: `bun run test`
Expected: 0 fail (baseline before this plan: 1189 pass, 17 skip, 0 fail across 98 files).

**Step 2: Fable grep**

Run: `grep -rIn -i fable . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.worktrees | grep -v '^./docs/'`
Expected: hits only in `shared/skills/using-kit/SKILL.md` (the orchestrator row), `AGENTS.md` (the pin rule), `tests/static/fork-pins.test.ts` (the guard), and `tests/fixtures/events/claude-skill-activation.jsonl` (untouched upstream fixture). Nothing in any `*.workflow.js`, `launch.md`, other test file, or `.claude-plugin/marketplace.json`.

**Step 3: Plugin validation**

Run: `claude plugin validate .claude-plugin/marketplace.json && claude plugin validate plugins/kit-claude && claude plugin validate plugins/stories-claude`
Expected: each reports valid; symlink warnings are expected (the validator does not follow symlinks).

## After the plan (orchestrator, not the workflow)

- Update the fork-rule line in `~/.claude/notes/known-fixes.md` (line 45, outside this repo) to the new rule.
- kit:verify, then kit:finish-branch: merge to main, tag `kit--v1.6.1` and `stories--v0.6.2`, push main and tags, `claude plugin marketplace update jazzdos-kit`, `claude plugin update kit@jazzdos-kit`, `claude plugin update stories@jazzdos-kit`, then the known-fixes check (installed kit has 17 `SKILL.md` files).
