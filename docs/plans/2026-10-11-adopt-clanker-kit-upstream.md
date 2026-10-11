# Adopt upstream clanker-kit and re-apply fork pins: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use kit:build-flow to execute this plan.

**Goal:** Turn this worktree (branched from `upstream/main` at 6ab3856) into the jazzdos-kit fork by re-applying the fork's marketplace identity, model/effort pins, prose tables, and project docs, with tests that fail if an upstream merge ever reintroduces an opus or xhigh pin.

**Architecture:** Upstream moved every fork-touched file in its dual-harness split, so nothing is merged; each fork edit is re-applied by hand on the new paths. The fork's one rule: every opus/xhigh stage runs on fable/high, every sonnet/high stage runs at sonnet/medium, verifier stages stay sonnet/low. Three bundled workflow files carry the pins, three `launch.md` files and three shared `SKILL.md` tables state them in prose, and three existing runner tests plus one new guard test assert them. Design: `docs/plans/2026-10-11-adopt-clanker-kit-upstream-design.md`.

**Tech Stack:** bun test (static suite at `tests/static`), JSON plugin manifests, markdown skills. No build step. Tests compile the workflow `.js` files into AsyncFunctions with faked runtime globals, so a pin change is observable through `opts.model` and `opts.effort` on recorded agent calls.

**Worktree:** `/Users/jarrodbaker/Documents/claude-kit/.worktrees/adopt-clanker-kit-upstream`. All paths below are relative to it. Baseline before any edit: `bun run test` reports 1175 pass, 17 skip, 0 fail.

**Do not touch:** `plugins/*-omp/`, `.omp-plugin/`, `shared/writing/`, `README.md`, any `plugin.json`, any version number. Upstream's version numbers (kit 1.6.0, stories 0.6.0, writing 0.1.1) are kept verbatim.

---

### Task 1: Marketplace identity, guarded by a new fork test

**Files:**
- Create: `tests/static/fork-pins.test.ts`
- Modify: `.claude-plugin/marketplace.json:2-6`

**Step 1: Write the failing test**

Create `tests/static/fork-pins.test.ts` with exactly this content:

```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { MARKETPLACE_DIR } from "../utils/paths";

// jazzdos-kit is a fork of shousper/clanker-kit with one standing substitution: every
// opus/xhigh stage runs on fable/high, and every sonnet/high stage runs at sonnet/medium.
// These guards fail the moment an upstream merge reintroduces an opus or xhigh pin, or a
// prose table that still names Opus, so the substitution cannot silently regress.

const read = (p: string) => readFileSync(p, "utf-8");

describe("fork: marketplace identity", () => {
  it("is published as jazzdos-kit, owned by jazzdos", () => {
    const m = JSON.parse(read(resolve(MARKETPLACE_DIR, "marketplace.json")));
    expect(m.name).toBe("jazzdos-kit");
    expect(m.owner).toEqual({ name: "jazzdos" });
    expect(m.plugins.map((p: { name: string }) => p.name)).toEqual(["kit", "writing", "stories"]);
  });
});
```

**Step 2: Run it to confirm it fails**

Run: `bun test tests/static/fork-pins.test.ts`
Expected: 1 fail, with `Expected: "jazzdos-kit"` / `Received: "shousper-kit"`.

**Step 3: Rename the marketplace**

In `.claude-plugin/marketplace.json`, replace the first six lines

```json
{
  "name": "shousper-kit",
  "description": "Personal Claude Code toolkit",
  "owner": {
    "name": "shousper"
  },
```

with

```json
{
  "name": "jazzdos-kit",
  "description": "Personal Claude Code toolkit (jazzdos fork of shousper/clanker-kit: opus/xhigh stages run on fable/high, sonnet stages at medium)",
  "owner": {
    "name": "jazzdos"
  },
```

Leave the `plugins` array untouched.

**Step 4: Run the test and the manifest suite**

Run: `bun test tests/static/fork-pins.test.ts tests/static/plugin.test.ts`
Expected: all pass, 0 fail.

---

### Task 2: build-flow runner pins

**Files:**
- Modify: `tests/static/build-flow-runner.test.ts:209-231`
- Modify: `plugins/kit-claude/skills/build-flow/build.workflow.js:253,266-270,281-283,287,310`

**Step 1: Rewrite the two pin tests and add two more**

In `tests/static/build-flow-runner.test.ts`, replace the block that starts at line 209 with `it("escalates the fix model from sonnet to opus on the final round"` and ends at line 231 with `});` (the end of the "escalates the quality review to opus only on the final batch" test) with:

```ts
  it("escalates the fix agent from sonnet/medium to fable/high on the final round", async () => {
    const dirty = { approved: false, findings: [{ severity: "critical", issue: "x" }] };
    const r = await runFlow(
      { batches: [[task("a")]], maxFixRounds: 2 },
      (role) =>
        role === "impl" || role === "fix" ? impl
        : role === "spec" || role === "recheck" ? dirty
        : role === "verify" ? verified
        : clean,
    );

    const fixes = r.calls.filter((c) => c.role === "fix");
    expect(fixes.map((c) => c.opts?.model)).toEqual(["sonnet", "fable"]);
    expect(fixes.map((c) => c.opts?.effort)).toEqual(["medium", "high"]);
  });

  it("escalates the quality review to fable/high only on the final batch", async () => {
    const r = await runFlow({ batches: [[task("a")], [task("b")]] }, allClean);

    expect(r.status).toBe("done");
    const quality = r.calls.filter((c) => c.role === "quality");
    expect(quality.map((c) => c.opts?.model)).toEqual(["sonnet", "fable"]);
    expect(quality.map((c) => c.opts?.effort)).toEqual(["medium", "high"]);
  });

  it("runs implementation, spec review and re-check on sonnet at medium", async () => {
    const dirty = { approved: false, findings: [{ severity: "major", issue: "y" }] };
    const r = await runFlow({ batches: [[task("a")]] }, (role, ctx) =>
      role === "spec" && ctx.occurrence === 0 ? dirty : allClean(role, ctx),
    );

    expect(r.status).toBe("done");
    for (const role of ["impl", "spec", "recheck"] as Role[]) {
      const calls = r.calls.filter((c) => c.role === role);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.map((c) => c.opts?.model)).toEqual(calls.map(() => "sonnet"));
      expect(calls.map((c) => c.opts?.effort)).toEqual(calls.map(() => "medium"));
    }
  });

  it("escalates verify-fix from sonnet/medium to fable/high on the second round", async () => {
    const failing = { passed: false, summary: "1 test failing", failures: [{ check: "t1", detail: "x != y" }] };
    const r = await runFlow({ batches: [[task("a")]] }, (role, ctx) =>
      role === "verify" ? (ctx.occurrence < 2 ? failing : verified) : allClean(role, ctx),
    );

    expect(r.status).toBe("done");
    expect(r.calls.filter((c) => c.role === "verify")).toHaveLength(3);
    const verifier = r.calls.filter((c) => c.role === "verify");
    expect(verifier.map((c) => c.opts?.effort)).toEqual(["low", "low", "low"]);
    const fixes = r.calls.filter((c) => c.role === "verify-fix");
    expect(fixes.map((c) => c.opts?.model)).toEqual(["sonnet", "fable"]);
    expect(fixes.map((c) => c.opts?.effort)).toEqual(["medium", "high"]);
  });
```

`Role`, `runFlow`, `task`, `impl`, `clean`, `verified` and `allClean` already exist above line 200 in this file. Do not add imports.

**Step 2: Run to confirm the four tests fail**

Run: `bun test tests/static/build-flow-runner.test.ts`
Expected: 4 fail (model `"opus"` where `"fable"` expected, effort `"high"` where `"medium"` expected); every other test in the file passes.

**Step 3: Re-pin the workflow**

In `plugins/kit-claude/skills/build-flow/build.workflow.js` make these exact replacements:

Line 253, implementation:
```js
    const r = await stage(`impl:${task.id}`, implPrompt(task), { phase: 'Implement', model: 'sonnet', effort: 'high', schema: IMPL_SCHEMA })
```
becomes
```js
    const r = await stage(`impl:${task.id}`, implPrompt(task), { phase: 'Implement', model: 'sonnet', effort: 'medium', schema: IMPL_SCHEMA })
```

Line 266, spec review:
```js
    () => stage(`spec:b${b + 1}`, specPrompt(batch), { phase: 'Review', model: 'sonnet', effort: 'high', schema: REVIEW_SCHEMA }),
```
becomes
```js
    () => stage(`spec:b${b + 1}`, specPrompt(batch), { phase: 'Review', model: 'sonnet', effort: 'medium', schema: REVIEW_SCHEMA }),
```

Lines 267-270, quality review comment and pin:
```js
    // Quality reviews run on Sonnet; the final batch escalates to Opus — its
    // `git diff main` covers the whole run, so this is the run-level safety net.
    () => stage(`quality:b${b + 1}`, qualityPrompt(batch), {
      phase: 'Review', model: finalBatch ? 'opus' : 'sonnet', effort: finalBatch ? 'xhigh' : 'high', schema: REVIEW_SCHEMA,
```
becomes
```js
    // Quality reviews run on Sonnet at medium; the final batch escalates to Fable at high — its
    // `git diff main` covers the whole run, so this is the run-level safety net.
    () => stage(`quality:b${b + 1}`, qualityPrompt(batch), {
      phase: 'Review', model: finalBatch ? 'fable' : 'sonnet', effort: finalBatch ? 'high' : 'medium', schema: REVIEW_SCHEMA,
```

Line 281, staged fix model:
```js
    const fixModel = round < MAX_FIX_ROUNDS - 1 ? 'sonnet' : 'opus' // staged escalation
```
becomes
```js
    const fixModel = round < MAX_FIX_ROUNDS - 1 ? 'sonnet' : 'fable' // staged escalation
```

Line 283, fix effort:
```js
    const fix = await stage(`fix:b${b + 1}:r${round + 1}`, fixPrompt(batch, findings), { phase: 'Fix', model: fixModel, effort: 'high', schema: IMPL_SCHEMA })
```
becomes
```js
    const fix = await stage(`fix:b${b + 1}:r${round + 1}`, fixPrompt(batch, findings), { phase: 'Fix', model: fixModel, effort: fixModel === 'fable' ? 'high' : 'medium', schema: IMPL_SCHEMA })
```

Line 287, re-check:
```js
    const recheck = await stage(`recheck:b${b + 1}:r${round}`, recheckPrompt(batch, findings), { phase: 'Review', model: 'sonnet', effort: 'high', schema: REVIEW_SCHEMA })
```
becomes
```js
    const recheck = await stage(`recheck:b${b + 1}:r${round}`, recheckPrompt(batch, findings), { phase: 'Review', model: 'sonnet', effort: 'medium', schema: REVIEW_SCHEMA })
```

Line 310, verify-fix:
```js
  const fix = await stage(`verify-fix:r${v + 1}`, verifyFixPrompt(verification), { phase: 'Verify', model: v === 0 ? 'sonnet' : 'opus', effort: 'high', schema: IMPL_SCHEMA })
```
becomes
```js
  const fix = await stage(`verify-fix:r${v + 1}`, verifyFixPrompt(verification), { phase: 'Verify', model: v === 0 ? 'sonnet' : 'fable', effort: v === 0 ? 'medium' : 'high', schema: IMPL_SCHEMA })
```

Line 302 (final verification, `model: 'sonnet', effort: 'low'`) is unchanged.

**Step 4: Run the file**

Run: `bun test tests/static/build-flow-runner.test.ts`
Expected: all pass, 0 fail.

**Step 5: Confirm no opus or xhigh string remains**

Run: `grep -n -E "'opus'|'xhigh'|Opus" plugins/kit-claude/skills/build-flow/build.workflow.js`
Expected: no output.

---

### Task 3: code-review runner pins

**Files:**
- Modify: `tests/static/code-review-runner.test.ts:80-92`
- Modify: `plugins/kit-claude/skills/code-review/review.workflow.js:15-22,74`

**Step 1: Rewrite the pin test and add a verifier test**

In `tests/static/code-review-runner.test.ts`, replace the test that begins at line 80 with `it("pins the architecture dimension to opus and the rest to sonnet"` and ends at line 92 with `});` with:

```ts
  it("pins the architecture dimension to fable/high and the rest to sonnet/medium", async () => {
    const seen: Record<string, [string | undefined, string | undefined]> = {};
    await runReview({}, (prompt, opts) => {
      if (isReview(prompt)) seen[opts.label!] = [opts.model, opts.effort];
      return isReview(prompt) ? { findings: [] } : { real: true };
    });
    expect(seen).toEqual({
      "review:correctness": ["sonnet", "medium"],
      "review:quality": ["sonnet", "medium"],
      "review:tests": ["sonnet", "medium"],
      "review:security": ["sonnet", "medium"],
      "review:architecture": ["fable", "high"],
    });
  });

  it("verifies findings on sonnet at medium", async () => {
    const verdicts: Array<[string | undefined, string | undefined]> = [];
    await runReview({ diffRef: "main" }, (prompt, opts) => {
      if (isVerdict(prompt)) verdicts.push([opts.model, opts.effort]);
      return oneRealFinding(prompt, opts);
    });
    expect(verdicts).toEqual([["sonnet", "medium"]]);
  });
```

`runReview`, `isReview`, `isVerdict` and `oneRealFinding` already exist above line 70 in this file.

**Step 2: Run to confirm both fail**

Run: `bun test tests/static/code-review-runner.test.ts`
Expected: 2 fail; the rest pass.

**Step 3: Re-pin the workflow**

In `plugins/kit-claude/skills/code-review/review.workflow.js`:

Lines 15-16, the comment:
```js
// zero actionable findings — Opus everywhere was paying frontier rates for
// "LGTM". Architecture keeps Opus as the one deep-judgment safety net.
```
becomes
```js
// zero actionable findings — a top-tier model everywhere was paying frontier rates
// for "LGTM". Architecture keeps Fable (high) as the one deep-judgment safety net;
// the other four dimensions and the verifiers run Sonnet at medium.
```

Lines 18-22, the dimension table: change `effort: 'high'` to `effort: 'medium'` on the correctness, quality, tests and security lines, and change the architecture line from `model: 'opus', effort: 'xhigh'` to `model: 'fable', effort: 'high'`. The result:
```js
  { key: 'correctness', focus: 'logic errors, bugs, broken edge cases, race conditions', model: 'sonnet', effort: 'medium' },
  { key: 'quality', focus: 'separation of concerns, DRY, naming, error handling, maintainability', model: 'sonnet', effort: 'medium' },
  { key: 'tests', focus: 'tests verify real behavior (not mocks), edge cases covered, all passing', model: 'sonnet', effort: 'medium' },
  { key: 'security', focus: 'injection, auth, secrets, unsafe operations', model: 'sonnet', effort: 'medium' },
  { key: 'architecture', focus: 'plan/design alignment, module boundaries, sound abstractions, scalability', model: 'fable', effort: 'high' },
```

Line 74, the verifier:
```js
      { phase: 'Verify', model: 'sonnet', effort: 'high', schema: VERDICT_SCHEMA },
```
becomes
```js
      { phase: 'Verify', model: 'sonnet', effort: 'medium', schema: VERDICT_SCHEMA },
```

**Step 4: Run the file**

Run: `bun test tests/static/code-review-runner.test.ts`
Expected: all pass, 0 fail.

**Step 5: Confirm no opus or xhigh string remains**

Run: `grep -n -E "'opus'|'xhigh'|Opus" plugins/kit-claude/skills/code-review/review.workflow.js`
Expected: no output.

---

### Task 4: stories planner tier pins

**Files:**
- Modify: `tests/static/story-planner-runner.test.ts:126-129`
- Modify: `plugins/stories-claude/skills/work/plan.workflow.js:26-30`

**Step 1: Update the tier expectation**

In `tests/static/story-planner-runner.test.ts`, replace lines 126-129:
```ts
  it("claude pins model and effort per complexity", async () => {
    const { calls } = await runClaude([story("st-0001"), story("st-0002", "hard"), story("st-0003", "frontier")], () => planned);
    expect(calls.map((c) => [c.model, c.effort])).toEqual([["sonnet", "high"], ["opus", "xhigh"], ["fable", "xhigh"]]);
  });
```
with
```ts
  it("claude pins model and effort per complexity: routine sonnet/medium, hard and frontier fable/high", async () => {
    const { calls } = await runClaude([story("st-0001"), story("st-0002", "hard"), story("st-0003", "frontier")], () => planned);
    expect(calls.map((c) => [c.model, c.effort])).toEqual([["sonnet", "medium"], ["fable", "high"], ["fable", "high"]]);
  });
```

**Step 2: Run to confirm it fails**

Run: `bun test tests/static/story-planner-runner.test.ts`
Expected: 1 fail; the OMP test in the same describe block still passes.

**Step 3: Re-pin the tier table**

In `plugins/stories-claude/skills/work/plan.workflow.js`, replace lines 26-30:
```js
const TIER = {
  routine: { model: 'sonnet', effort: 'high' },
  hard: { model: 'opus', effort: 'xhigh' },
  frontier: { model: 'fable', effort: 'xhigh' }, // human opt-in, made at board approval
}
```
with
```js
const TIER = {
  routine: { model: 'sonnet', effort: 'medium' },
  hard: { model: 'fable', effort: 'high' },
  frontier: { model: 'fable', effort: 'high' }, // human opt-in, made at board approval
}
```

**Step 4: Run the file**

Run: `bun test tests/static/story-planner-runner.test.ts`
Expected: all pass, 0 fail.

---

### Task 5: Prose tables and the pin guard

**Files:**
- Modify: `tests/static/fork-pins.test.ts` (append)
- Modify: `plugins/kit-claude/skills/build-flow/launch.md:53-58`
- Modify: `plugins/kit-claude/skills/code-review/launch.md:16`
- Modify: `plugins/stories-claude/skills/work/launch.md:21`
- Modify: `shared/skills/using-kit/SKILL.md:109-111`
- Modify: `shared/skills/build-flow/SKILL.md:52-57`
- Modify: `shared/skills/code-review/SKILL.md:40`

Depends on Tasks 2, 3 and 4 (the source-string guard below reads the three workflow files).

**Step 1: Extend the guard test**

In `tests/static/fork-pins.test.ts`, change the import line to
```ts
import { KIT_CLAUDE_ROOT, MARKETPLACE_DIR, SKILLS_DIR, STORIES_CLAUDE_ROOT } from "../utils/paths";
```
and append at the end of the file:

```ts
describe("fork: no opus/xhigh pins on the Claude side", () => {
  const workflows = [
    resolve(KIT_CLAUDE_ROOT, "skills/build-flow/build.workflow.js"),
    resolve(KIT_CLAUDE_ROOT, "skills/code-review/review.workflow.js"),
    resolve(STORIES_CLAUDE_ROOT, "skills/work/plan.workflow.js"),
  ];
  for (const file of workflows) {
    it(`${file.split("/plugins/")[1]} pins no opus or xhigh`, () => {
      const src = read(file);
      expect(src).not.toMatch(/['"]opus['"]/);
      expect(src).not.toMatch(/['"]xhigh['"]/);
      expect(src).toMatch(/['"]fable['"]/);
    });
  }

  const prose = [
    resolve(KIT_CLAUDE_ROOT, "skills/build-flow/launch.md"),
    resolve(KIT_CLAUDE_ROOT, "skills/code-review/launch.md"),
    resolve(STORIES_CLAUDE_ROOT, "skills/work/launch.md"),
  ];
  for (const file of prose) {
    it(`${file.split("/plugins/")[1]} names Fable, never Opus or xhigh`, () => {
      const text = read(file);
      expect(text).not.toMatch(/\bOpus\b/);
      expect(text).not.toMatch(/\bxhigh\b/);
      expect(text).toMatch(/\bFable\b/);
    });
  }

  it("shared skill tables carry the fork's effort levels, not xhigh", () => {
    const sanctioned = "standing request: substitute for every opus/xhigh stage (fable, effort high)";
    for (const skill of ["using-kit", "build-flow", "code-review"]) {
      const text = read(resolve(SKILLS_DIR, skill, "SKILL.md")).replaceAll(sanctioned, "");
      expect(text).not.toMatch(/\bxhigh\b/);
    }
    const usingKit = read(resolve(SKILLS_DIR, "using-kit/SKILL.md"));
    expect(usingKit).toContain("| fable, effort high |");
    expect(usingKit).toContain(sanctioned);
  });
});
```

The standing-request row in using-kit is the one sanctioned mention of `xhigh` on the Claude side; it is stripped before the regex check so the same test can both require the row and ban every other mention.

**Step 2: Run to confirm the prose tests fail**

Run: `bun test tests/static/fork-pins.test.ts`
Expected: the three workflow-source tests pass (Tasks 2-4 done), the three `launch.md` tests fail, the shared-skill test fails.

**Step 3: Rewrite the prose**

`plugins/kit-claude/skills/build-flow/launch.md`, lines 53-58, replace the table body:
```
| Implementation | Sonnet | high |
| Spec review | Sonnet | high |
| Quality review | Sonnet (Opus on the final batch — its cumulative diff review is the whole-run safety net) | high (xhigh on final) |
| Fix (staged) | Sonnet → Opus | high |
| Post-fix re-check (scoped to the findings) | Sonnet | high |
| Final verification (full suite + lint, once per run) | Sonnet | low |
```
with
```
| Implementation | Sonnet | medium |
| Spec review | Sonnet | medium |
| Quality review | Sonnet (Fable on the final batch — its cumulative diff review is the whole-run safety net) | medium (high on final) |
| Fix (staged) | Sonnet → Fable | medium (high on the Fable round) |
| Post-fix re-check (scoped to the findings) | Sonnet | medium |
| Final verification (full suite + lint, once per run) | Sonnet | low |
```

`plugins/kit-claude/skills/code-review/launch.md`, line 16, replace:
```
`review.workflow.js` pins per-dimension `model`/`effort` in its default `reviewDims`: correctness, quality, tests, and security run on Sonnet (high); architecture, the one deep-judgment safety net, runs on Opus (xhigh). Pass a custom `reviewDims` (`[{ key, focus, model, effort }, ...]`) to change this.
```
with
```
`review.workflow.js` pins per-dimension `model`/`effort` in its default `reviewDims`: correctness, quality, tests, and security run on Sonnet (medium); architecture, the one deep-judgment safety net, runs on Fable (high). Verifiers run on Sonnet (medium). Pass a custom `reviewDims` (`[{ key, focus, model, effort }, ...]`) to change this.
```

`plugins/stories-claude/skills/work/launch.md`, line 21, replace:
```
`plan.workflow.js` pins the planner per story complexity: routine → Sonnet (effort high), hard → Opus (effort xhigh), frontier → Fable (effort xhigh). Every model decision lives in that file; nothing in this session chooses, retries, or substitutes a model.
```
with
```
`plan.workflow.js` pins the planner per story complexity: routine → Sonnet (effort medium), hard → Fable (effort high), frontier → Fable (effort high). Every model decision lives in that file; nothing in this session chooses, retries, or substitutes a model.
```

`shared/skills/using-kit/SKILL.md`, lines 110-111, replace:
```
| Hardest judgment calls (final quality gate, architecture, adversarial verify of critical findings) | strongest tier, effort xhigh |
| frontier tier | only on explicit human request |
```
with
```
| Hardest judgment calls (final quality gate, architecture, adversarial verify of critical findings) | fable, effort high |
| fable | standing request: substitute for every opus/xhigh stage (fable, effort high) |
```
Line 109 (`standard tier, effort high`) stays as upstream wrote it; it governs ad-hoc fan-out, not the bundled workflows.

`shared/skills/build-flow/SKILL.md`, lines 52-57, replace the table body:
```
| Implementation | worker | high |
| Spec review | worker | high |
| Quality review | worker (arbiter on the final batch — its cumulative diff review is the whole-run safety net) | high (xhigh on final) |
| Fix (staged) | worker → arbiter | high |
| Post-fix re-check (scoped to the findings) | worker | high |
| Final verification (full suite + lint, once per run) | verifier | low |
```
with
```
| Implementation | worker | medium |
| Spec review | worker | medium |
| Quality review | worker (arbiter on the final batch — its cumulative diff review is the whole-run safety net) | medium (high on final) |
| Fix (staged) | worker → arbiter | medium (high on the arbiter round) |
| Post-fix re-check (scoped to the findings) | worker | medium |
| Final verification (full suite + lint, once per run) | verifier | low |
```

`shared/skills/code-review/SKILL.md`, line 40, replace the sentence
```
Quality, security, and architecture run on the arbiter tier (xhigh); correctness and tests run on the worker tier (high).
```
with
```
Architecture runs on the arbiter tier (high); correctness, quality, tests, and security run on the worker tier (medium).
```
Leave the rest of line 40 unchanged.

**Step 4: Run the guard and the neutral-prose test**

Run: `bun test tests/static/fork-pins.test.ts tests/static/neutral-prose.test.ts tests/static/skills.test.ts`
Expected: all pass, 0 fail. The neutral-prose test bans capitalised `| Sonnet` and `| Opus` in shared SKILL.md tables; the lowercase `fable` rows do not match it.

**Step 5: Whole-tree check**

Run: `grep -rn -E "'opus'|'xhigh'|\bOpus\b|\bxhigh\b" plugins/kit-claude plugins/stories-claude shared/skills --include=*.js --include=*.md | grep -v "standing request: substitute"`
Expected: no output.

---

### Task 6: Fork project docs and gitignore

**Files:**
- Modify: `.gitignore:11-17`
- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Create: `docs/plans/2026-09-03-effort-pin-test-repair.md` (copied from `main`)
- Create: `docs/decisions/.gitkeep`, `docs/handoffs/.gitkeep`

No automated test covers these files; verification is by inspection commands in Steps 5 and 6.

**Step 1: Restore the gitignore baseline block**

In `.gitignore`, insert after the `Cargo.lock` line (line 11) and before the `# Eval fixture:` comment:

```
# Standards section 5 baseline
.env
MACHINES.md
data/
outputs/

```

The two `!tests/fixtures/workspace-stories/.claude/` negation lines must remain the last two lines of the file.

**Step 2: Copy the unchanged fork docs from main**

Run, from the worktree root:
```
mkdir -p docs/decisions docs/handoffs
git show main:CLAUDE.md > CLAUDE.md
git show main:docs/plans/2026-09-03-effort-pin-test-repair.md > docs/plans/2026-09-03-effort-pin-test-repair.md
touch docs/decisions/.gitkeep docs/handoffs/.gitkeep
```
Expected: four new files, no errors. `CLAUDE.md` is identical to the one on `main`.

**Step 3: Write AGENTS.md for the new layout**

Create `AGENTS.md` with exactly this content:

```markdown
# claude-kit

## What this project is

The `jazzdos-kit` Claude Code plugin marketplace, a personal fork of
shousper/clanker-kit (formerly shousper/claude-kit). It hosts the `kit`,
`stories` and `writing` plugins. Only `kit` and `stories` are installed;
`writing` is listed but unused (its forced output style conflicts with the
writing pillar in the standards repo).

The fork's one rule: every opus/xhigh stage upstream runs on fable/high
here, and every sonnet/high stage runs at sonnet/medium. Verifier stages
stay sonnet/low. `tests/static/fork-pins.test.ts` fails if an upstream
merge reintroduces an opus or xhigh pin.

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
- Install `kit@jazzdos-kit` and `stories@jazzdos-kit` from this
  marketplace only, never from `shousper-kit`. The README Install block
  is upstream text that still names shousper.
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
```

**Step 4: Confirm the gitignore ordering**

Run: `tail -2 .gitignore`
Expected:
```
!tests/fixtures/workspace-stories/.claude/
!tests/fixtures/workspace-stories/.claude/**
```

**Step 5: Confirm the docs tree**

Run: `git status --porcelain -- AGENTS.md CLAUDE.md docs .gitignore`
Expected: `AGENTS.md`, `CLAUDE.md`, `docs/decisions/.gitkeep`, `docs/handoffs/.gitkeep`, `docs/plans/2026-09-03-effort-pin-test-repair.md`, the two 2026-10-11 plan docs as untracked (`??`), and `.gitignore` as modified (` M`).

**Step 6: Confirm the README test still passes**

Run: `bun test tests/static/readme.test.ts`
Expected: all pass. README.md is untouched.

---

### Task 7: Whole-suite and manifest verification

**Files:** none modified.

**Step 1: Full static suite**

Run: `bun run test 2>&1 | tail -8`
Expected: `0 fail`, `17 skip`, and a pass count above the 1175 baseline (the new and rewritten tests in Tasks 1, 2, 3 and 5 add to it).

**Step 2: Manifest validation, non-strict, as CI runs it**

Run:
```
claude plugin validate .claude-plugin/marketplace.json
for m in plugins/*/.claude-plugin/plugin.json; do claude plugin validate "${m%/.claude-plugin/plugin.json}"; done
```
Expected: each command exits 0. Warnings about symlinked components are expected and acceptable; errors are not. If the `claude` CLI is unavailable in the agent's shell, record that in the task summary instead of skipping silently.

**Step 3: Final pin sweep**

Run: `grep -rn -E "'opus'|'xhigh'" plugins/kit-claude plugins/stories-claude shared/skills`
Expected: no output.

**Step 4: Diff review against upstream**

Run: `git diff --stat upstream/main`
Expected: exactly these paths and no others:
```
 .claude-plugin/marketplace.json
 .gitignore
 plugins/kit-claude/skills/build-flow/build.workflow.js
 plugins/kit-claude/skills/build-flow/launch.md
 plugins/kit-claude/skills/code-review/launch.md
 plugins/kit-claude/skills/code-review/review.workflow.js
 plugins/stories-claude/skills/work/launch.md
 plugins/stories-claude/skills/work/plan.workflow.js
 shared/skills/build-flow/SKILL.md
 shared/skills/code-review/SKILL.md
 shared/skills/using-kit/SKILL.md
 tests/static/build-flow-runner.test.ts
 tests/static/code-review-runner.test.ts
 tests/static/story-planner-runner.test.ts
```
plus untracked `AGENTS.md`, `CLAUDE.md`, `docs/`, and `tests/static/fork-pins.test.ts` (`git status --porcelain | grep '^??'`). Any other tracked file in the diff is a mistake to revert.

---

## Batch order for kit:build-flow

- Batch 0: Task 1, Task 2, Task 3, Task 4 (independent files).
- Batch 1: Task 5, Task 6 (Task 5 reads the Task 2-4 outputs; Task 6 is independent but kept out of batch 0 to keep that batch's review focused on pins).
- Batch 2: Task 7.

## Out of scope, handled after merge (see the design doc)

- Push and plugin update on Jarrod's ask.
- `story doctor` in the nine stories projects.
- Removing the `kit:code-standards` line from four project CLAUDE.md files, `pillars/claude-md.md:96`, and the known-fixes notes.
