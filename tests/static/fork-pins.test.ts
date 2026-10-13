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

  // Each fork-only prose line, asserted verbatim so a partial upstream revert fails.
  const proseLines: [string, string, string[]][] = [
    [
      resolve(KIT_CLAUDE_ROOT, "skills/build-flow/launch.md"),
      "build-flow launch.md",
      [
        "| Quality review | Sonnet (Opus on the final batch — its cumulative diff review is the whole-run safety net) | medium (xhigh on final) |",
        "| Fix (staged) | Sonnet → Opus | medium (xhigh on the Opus round) |",
      ],
    ],
    [
      resolve(KIT_CLAUDE_ROOT, "skills/code-review/launch.md"),
      "code-review launch.md",
      ["architecture, the one deep-judgment safety net, runs on Opus (xhigh). Verifiers run on Sonnet (medium)."],
    ],
    [
      resolve(STORIES_CLAUDE_ROOT, "skills/work/launch.md"),
      "stories work launch.md",
      ["routine → Sonnet (effort medium), hard → Opus (effort xhigh), frontier → Opus (effort xhigh)."],
    ],
    [
      resolve(SKILLS_DIR, "build-flow/SKILL.md"),
      "shared build-flow SKILL.md",
      [
        "| Quality review | worker (arbiter on the final batch — its cumulative diff review is the whole-run safety net) | medium (xhigh on final) |",
        "| Fix (staged) | worker → arbiter | medium (xhigh on the arbiter round) |",
      ],
    ],
    [
      resolve(SKILLS_DIR, "code-review/SKILL.md"),
      "shared code-review SKILL.md",
      ["Architecture runs on the arbiter tier (xhigh); correctness, quality, tests, and security run on the worker tier (medium)."],
    ],
  ];
  for (const [file, name, lines] of proseLines) {
    it(`${name} carries the fork pin lines verbatim`, () => {
      const text = read(file);
      for (const line of lines) expect(text).toContain(line);
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
