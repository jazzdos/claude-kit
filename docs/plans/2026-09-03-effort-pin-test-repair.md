# Effort Pin Test Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use kit:build-flow to execute this plan.

**Goal:** Bring `main` back to green after commit `2cfde1b` (Sonnet stages to medium, Fable stages to high) left one stale test assertion and one stale skill doc behind, lock the new effort pins in with tests, and cut a patch release.

**Architecture:** No workflow behaviour changes. The effort values in `build.workflow.js` and `review.workflow.js` stay exactly as they are (Sonnet medium, Fable high). Work is confined to `tests/static/build-flow-runner.test.ts`, one line of `plugins/kit/skills/code-review/SKILL.md`, and the two version manifests. The test harness compiles the workflow script into an `AsyncFunction` with a scripted `agent()` so model and effort per call are observable without spawning agents.

**Tech Stack:** Bun test runner (`bun test`), TypeScript tests, plain JS workflow scripts, JSON plugin manifests.

---

## Before you start

- Run in an isolated worktree off `main` (kit:git-worktrees). Suggested branch: `fix/effort-pin-tests`.
- Baseline: `bun test tests/static` currently reports `145 pass, 1 fail`. The failure is `build-flow runner execution flow > escalates the quality review to fable only on the final batch` at `tests/static/build-flow-runner.test.ts:230`.
- Do not touch any `model:` or `effort:` value in `plugins/kit/skills/build-flow/build.workflow.js` or `plugins/kit/skills/code-review/review.workflow.js`. The user chose to keep them.
- Do not touch `plugins/stories/`. The user chose to leave the stories planner table alone.
- No commit steps. Commits are the user's decision.

Reference values the tests must reflect (read from `plugins/kit/skills/build-flow/build.workflow.js`):

| Stage | Line | Model | Effort |
|---|---|---|---|
| Quality review, non-final batch | 262 | sonnet | medium |
| Quality review, final batch | 262 | fable | high |
| Fix, rounds before the last | 273-275 | sonnet | medium |
| Fix, last round | 273-275 | fable | high |
| Verify-fix, first round | 300 | sonnet | medium |
| Verify-fix, second round | 300 | fable | high |

---

### Task 1: Repair the stale quality-review effort assertion

**Files:**
- Modify: `tests/static/build-flow-runner.test.ts:224-231`

**Step 1: Run the failing test to confirm the failure shape**

Run: `bun test tests/static/build-flow-runner.test.ts --test-name-pattern "escalates the quality review"`
Expected: FAIL. The diff shows received `["medium", "high"]` against expected `["high", "high"]` at line 230.

**Step 2: Correct the expectation to match the pinned values**

Replace the test body so it reads:

```ts
  it("escalates the quality review to fable only on the final batch", async () => {
    const r = await runFlow({ batches: [[task("a")], [task("b")]] }, allClean);

    expect(r.status).toBe("done");
    const quality = r.calls.filter((c) => c.role === "quality");
    // Sonnet-first at medium; the final batch escalates to Fable at high because its
    // `git diff main` review covers the whole run (see build.workflow.js ~L258).
    expect(quality.map((c) => c.opts?.model)).toEqual(["sonnet", "fable"]);
    expect(quality.map((c) => c.opts?.effort)).toEqual(["medium", "high"]);
  });
```

**Step 3: Run the test to verify it passes**

Run: `bun test tests/static/build-flow-runner.test.ts --test-name-pattern "escalates the quality review"`
Expected: PASS, `1 pass, 0 fail`.

---

### Task 2: Lock in effort on the staged fix escalation

The existing test at `tests/static/build-flow-runner.test.ts:209-222` asserts the fix model sequence `["sonnet", "fable"]` but says nothing about effort. Commit `2cfde1b` changed the effort at line 275 of the workflow with no test covering it.

**Files:**
- Modify: `tests/static/build-flow-runner.test.ts:209-222`

**Step 1: Extend the test with an effort assertion**

Replace the test so it reads:

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
```

**Step 2: Run the test to verify it passes**

This is a lock-in test for behaviour that already exists, so it passes on the first run. Its value is that a future edit to line 275 of the workflow fails here instead of silently changing fleet cost.

Run: `bun test tests/static/build-flow-runner.test.ts --test-name-pattern "escalates the fix agent"`
Expected: PASS, `1 pass, 0 fail`.

**Step 3: Prove the assertion bites**

Temporarily change `"medium"` to `"high"` in the new `toEqual` for effort, re-run the same command, and confirm it FAILS with received `["medium", "high"]`. Revert the temporary change. Re-run and confirm PASS.

---

### Task 3: Lock in the verify-fix escalation with a new test

The existing test at `tests/static/build-flow-runner.test.ts:232-245` exercises only one verify-fix round, so the Fable escalation at line 300 of the workflow is untested. The runner's loop is: verify; if it passed, stop; if this is the third failure, block; otherwise dispatch verify-fix (round 1 on sonnet/medium, round 2 on fable/high) and verify again.

**Files:**
- Modify: `tests/static/build-flow-runner.test.ts` (insert directly after the test ending at line 245)

**Step 1: Write the new test**

Insert after the closing `});` of "runs the final verification once and dispatches a verify-fix on failure":

```ts
  it("escalates verify-fix from sonnet/medium to fable/high on the second round", async () => {
    const failing = { passed: false, summary: "1 test failing", failures: [{ check: "t1", detail: "x != y" }] };
    const r = await runFlow({ batches: [[task("a")]] }, (role, { occurrence }) => {
      if (role === "verify") return occurrence < 2 ? failing : verified;
      return allClean(role, { prompt: "", occurrence, calls: [] });
    });

    expect(r.status).toBe("done");
    expect(r.calls.filter((c) => c.role === "verify")).toHaveLength(3);
    const fixes = r.calls.filter((c) => c.role === "verify-fix");
    expect(fixes.map((c) => c.opts?.model)).toEqual(["sonnet", "fable"]);
    expect(fixes.map((c) => c.opts?.effort)).toEqual(["medium", "high"]);
  });
```

**Step 2: Run the new test**

Run: `bun test tests/static/build-flow-runner.test.ts --test-name-pattern "escalates verify-fix"`
Expected: PASS, `1 pass, 0 fail`. If it reports `verify-fix` length 1 or `status: "blocked"`, the `occurrence < 2` gate is wrong; re-read the loop at `build.workflow.js:292-303`.

**Step 3: Prove the assertion bites**

Temporarily change the expected effort array to `["high", "high"]`, re-run, confirm FAIL with received `["medium", "high"]`. Revert. Re-run and confirm PASS.

**Step 4: Run the whole runner test file**

Run: `bun test tests/static/build-flow-runner.test.ts`
Expected: PASS for every test in the file, `0 fail`.

---

### Task 4: Correct the stale model/effort sentence in the code-review skill doc

`plugins/kit/skills/code-review/SKILL.md:43` still describes the pre-`2cfde1b` split. The workflow at `plugins/kit/skills/code-review/review.workflow.js:18-22` now runs correctness, quality, tests, and security on Sonnet at medium, and architecture on Fable at high; the verify stage at line 61 runs Sonnet at medium.

**Files:**
- Modify: `plugins/kit/skills/code-review/SKILL.md:43`

**Step 1: Read the current line**

Run: `sed -n '43p' plugins/kit/skills/code-review/SKILL.md`
Expected output ends with: `Quality, security, and architecture run on Fable (high); correctness and tests on Sonnet (high).`

**Step 2: Replace the trailing sentence**

Change that trailing sentence to:

```
Architecture runs on Fable (high) as the one deep-judgment safety net; correctness, quality, tests, and security run on Sonnet (medium), as does the adversarial verify pass.
```

Leave the rest of line 43 (the sentence about default dimensions and `reviewDims`) unchanged.

**Step 3: Run the skill structure tests**

Run: `bun test tests/static/skills.test.ts tests/static/skill-parser.test.ts`
Expected: PASS, `0 fail`. These check frontmatter and heading structure, which this edit does not touch.

---

### Task 5: Bump the kit plugin to 1.3.1

`tests/static/plugin.test.ts:39-42` asserts that `.claude-plugin/marketplace.json` and `plugins/kit/.claude-plugin/plugin.json` agree on version, so both files change together. Patch bump only: no behaviour change, tests and docs only.

**Files:**
- Modify: `plugins/kit/.claude-plugin/plugin.json:5`
- Modify: `.claude-plugin/marketplace.json:11`

**Step 1: Bump plugin.json**

In `plugins/kit/.claude-plugin/plugin.json` change `"version": "1.3.0"` to `"version": "1.3.1"`. Nothing else in the file changes.

**Step 2: Run the manifest test to see the mismatch**

Run: `bun test tests/static/plugin.test.ts`
Expected: FAIL on `marketplace entry agrees on name and version` with expected `"1.3.1"`, received `"1.3.0"`.

**Step 3: Bump marketplace.json**

In `.claude-plugin/marketplace.json`, inside the `kit` entry only, change `"version": "1.3.0"` to `"version": "1.3.1"`. The `stories` entry stays at `0.2.0`.

**Step 4: Run the manifest test again**

Run: `bun test tests/static/plugin.test.ts`
Expected: PASS, `0 fail`.

---

### Task 6: Full verification

**Step 1: Static suite**

Run: `bun test tests/static`
Expected: `0 fail`. Test count is 147 (146 existing plus the one added in Task 3).

**Step 2: Stories suite (unchanged code, regression guard)**

Run: `bun test tests/stories`
Expected: `0 fail`.

**Step 3: Confirm no workflow values moved**

Run: `git diff main --stat`
Expected: exactly these five files:

```
.claude-plugin/marketplace.json
docs/plans/2026-09-03-effort-pin-test-repair.md
plugins/kit/.claude-plugin/plugin.json
plugins/kit/skills/code-review/SKILL.md
tests/static/build-flow-runner.test.ts
```

Run: `git diff main -- plugins/kit/skills/build-flow/build.workflow.js plugins/kit/skills/code-review/review.workflow.js plugins/stories`
Expected: empty output.

---

## After the run (user's decisions, not part of build-flow)

- Commit and push to `jazzdos/claude-kit`, then refresh the install from the jazzdos-kit marketplace only:

```
claude plugin marketplace update jazzdos-kit
claude plugin update kit@jazzdos-kit
```

- The effort values themselves are unchanged. Per the Fable 5.1 prompting docs ("Consider all effort levels"), the next step is an eval sweep of the Fable stages at `medium` before changing any pin.
