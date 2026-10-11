import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { KIT_CLAUDE_ROOT, MARKETPLACE_DIR, SKILLS_DIR, STORIES_CLAUDE_ROOT } from "../utils/paths";

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

describe("fork: no opus or xhigh pins", () => {
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

  it("never names opus or xhigh in runners or launch prose", () => {
    const offenders = files.filter((f) => /opus|xhigh/i.test(read(f)));
    expect(offenders).toEqual([]);
  });
});

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
