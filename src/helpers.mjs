import { execFileSync } from "child_process";
import { HOME } from "./constants.mjs";

export const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const shortPath = (p) => p.replace(HOME, "~");

/** Format large token counts as MM/BB shorthand. Guards against undefined/NaN. */
export function formatTokens(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B tokens`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tokens`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K tokens`;
  return `${n} tokens`;
}

/** Run a git command safely using execFileSync (no shell injection). */
export function gitCmd(repoDir, ...args) {
  try {
    return execFileSync("git", ["-C", repoDir, ...args], {
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

const PROMPT_GENERATORS = {
  "config-drift"(meta) {
    const list = meta.repos.map((r) => `- ${r.name} (${r.commitsSince} commits since last update)`);
    return [
      "These repos have stale CLAUDE.md files:",
      ...list,
      "",
      "For each repo:",
      "1. Read the current CLAUDE.md",
      "2. Run `git log --oneline` to see what changed since the last config update",
      "3. Check if new patterns, tools, or conventions were introduced that should be documented",
      "4. Propose targeted additions — don't rewrite from scratch, just fill gaps",
    ].join("\n");
  },
  "unconfigured-repos"(meta) {
    if (!meta.repos.length) return "Several repos have no Claude Code configuration.";
    const list = meta.repos.map((r) => `- ${r.name} (${r.techStack.join(", ")})`);
    return [
      "These repos have no CLAUDE.md yet:",
      ...list,
      "",
      "Pick the one you want to configure. For that repo:",
      "1. Read the project structure and config files (package.json, pyproject.toml, etc.)",
      "2. Identify the build system, test framework, and linter",
      "3. Generate a concise CLAUDE.md (50-100 lines) with build/test/lint commands and key conventions",
    ].join("\n");
  },
  "mcp-promotion"(meta) {
    const list = meta.servers.map((s) => `- ${s.name} (used in ${s.projectCount} projects)`);
    return [
      "These MCP servers are installed in multiple projects and should be promoted to global:",
      ...list,
      "",
      "To promote a server, run:",
      "  claude mcp add --scope user <server-name> <config>",
      "Then remove the duplicate entries from each project's .mcp.json.",
    ].join("\n");
  },
  "mcp-redundant"(meta) {
    const list = meta.servers.map((s) => `- ${s.name}: remove from ${s.projects.join(", ")}`);
    return [
      "These MCP servers are configured globally AND redundantly in project .mcp.json:",
      ...list,
      "",
      "The global config already covers all projects. Remove the listed project-level entries.",
    ].join("\n");
  },
  "mcp-recommendations"(meta) {
    const list = meta.servers.map(
      (s) =>
        `- ${s.name} — ${s.reasons.join(", ")}` +
        (s.installCommand?.trim() ? `\n  ${s.installCommand.trim()}` : ""),
    );
    return [
      "Based on your tech stacks, these MCP servers would be useful:",
      ...list,
      "",
      "Run any install command above to add a server. Which ones interest you?",
    ].join("\n");
  },
  "shared-skills"(meta) {
    const list = meta.skills.map((s) => `- ${s.name} (relevant in ${s.repoCount} repos)`);
    return [
      "These skills are relevant across multiple repos and would benefit from being global:",
      ...list,
      "",
      "To add a skill globally, copy its definition from any project's .claude/commands/ to ~/.claude/commands/.",
    ].join("\n");
  },
  "health-quickwins"(meta) {
    const list = meta.repos.map((r) => `- ${r.name} (${r.healthScore}/100): ${r.topReason}`);
    return [
      "These repos have easy config health improvements:",
      ...list,
      "",
      "Pick a repo and I'll help you make the specific improvement.",
    ].join("\n");
  },
  "insights-report"() {
    return "Run `/insights` in Claude Code to generate a personalized usage report with patterns, friction points, and suggestions.";
  },
};

/** Convert insights to an actionable prompt for pasting into Claude Code. */
export function insightsToPrompt(insights) {
  if (!insights || !insights.length) return "";
  const sections = [];
  for (const i of insights) {
    const gen = i.meta?.kind && PROMPT_GENERATORS[i.meta.kind];
    if (gen) {
      sections.push(gen(i.meta));
    } else {
      const lines = [`${i.title}`];
      if (i.detail) lines.push(i.detail);
      if (i.action) lines.push(i.action);
      sections.push(lines.join("\n"));
    }
  }
  return [
    "I ran the Claude Code Dashboard and found these items to address:",
    ...sections.map((s, idx) => `${idx + 1}. ${s}`),
    "Which of these would you like to tackle first?",
  ].join("\n\n");
}

export function anonymizePath(p) {
  return p
    .replace(/^\/Users\/[^/]+\//, "~/")
    .replace(/^\/home\/[^/]+\//, "~/")
    .replace(/^C:\\Users\\[^\\]+\\/, "~\\")
    .replace(/^C:\/Users\/[^/]+\//, "~/");
}
