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

const INSIGHT_ICONS = {
  warning: "\u26A0\uFE0F",
  tip: "\u2728",
  promote: "\u2B06",
  info: "\u2139\uFE0F",
};

/** Convert an insights array to a markdown string suitable for pasting into Claude Code. */
export function insightsToMarkdown(insights) {
  if (!insights || !insights.length) return "";
  const lines = ["# Dashboard Insights\n"];
  for (const i of insights) {
    const icon = INSIGHT_ICONS[i.type] || INSIGHT_ICONS.info;
    lines.push(`## ${icon} ${i.title}`);
    if (i.detail) lines.push(i.detail);
    if (i.action) lines.push(`**Action:** ${i.action}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function anonymizePath(p) {
  return p
    .replace(/^\/Users\/[^/]+\//, "~/")
    .replace(/^\/home\/[^/]+\//, "~/")
    .replace(/^C:\\Users\\[^\\]+\\/, "~\\")
    .replace(/^C:\/Users\/[^/]+\//, "~/");
}
