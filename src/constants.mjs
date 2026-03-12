import { join } from "path";
import { homedir } from "os";

export const VERSION = "0.0.11";
export const REPO_URL = "https://github.com/VirenMohindra/claude-code-dashboard";

export const HOME = homedir();
export const CLAUDE_DIR = join(HOME, ".claude");
export const DEFAULT_OUTPUT = join(CLAUDE_DIR, "dashboard.html");
export const CONF = join(CLAUDE_DIR, "dashboard.conf");
export const MAX_DEPTH = 5;
export const MAX_SESSION_SCAN = 1000;
export const SIMILARITY_THRESHOLD = 25;

// Freshness thresholds (seconds)
export const ONE_DAY = 86_400;
export const TWO_DAYS = 172_800;
export const THIRTY_DAYS = 2_592_000;
export const NINETY_DAYS = 7_776_000;
export const ONE_YEAR = 31_536_000;

// Directories to skip during repo discovery
export const PRUNE = new Set([
  "node_modules",
  ".Trash",
  "Library",
  ".cache",
  ".npm",
  ".yarn",
  ".pnpm",
  ".local",
  ".cargo",
  ".rustup",
  ".gradle",
  ".m2",
  ".cocoapods",
  ".android",
  "Caches",
  ".virtualenvs",
  ".pyenv",
  ".nvm",
  ".rbenv",
  ".gem",
  ".docker",
  ".orbstack",
  "go",
  "venv",
  "__pycache__",
  ".tox",
  ".git",
]);

// Lines matching these patterns are skipped when extracting project descriptions.
// Override by adding a YAML frontmatter `description:` field to your CLAUDE.md.
const BOILERPLATE_PATTERNS = [
  "This file provides guidance",
  "CLAUDE.md.*symlink",
  "AGENTS.md.*should contain",
  "Always-loaded guidance",
  "Guidance for coding agents",
  "Rules are split into focused files",
  "Detailed implementation guidance lives in",
];
export const BOILERPLATE_RE = new RegExp(BOILERPLATE_PATTERNS.join("|"));

export const STACK_FILES = {
  "next.config.js": "next",
  "next.config.mjs": "next",
  "next.config.ts": "next",
  "Cargo.toml": "rust",
  "go.mod": "go",
  "requirements.txt": "python",
  "pyproject.toml": "python",
  "setup.py": "python",
  "Package.swift": "swift",
  Gemfile: "ruby",
  "pom.xml": "java",
  "build.gradle": "java",
  "build.gradle.kts": "java",
};

export const SKILL_CATEGORIES = {
  workflow: ["plan", "workflow", "branch", "commit", "pr-", "review", "ship", "deploy", "execute"],
  "code-quality": ["lint", "test-", "quality", "format", "refactor", "clean", "verify", "tdd"],
  debugging: ["debug", "diagnose", "troubleshoot", "ci-fix", "stack-trace", "breakpoint"],
  research: [
    "research",
    "search",
    "analyze",
    "explore",
    "investigate",
    "compare",
    "competitive",
    "audit",
    "find",
  ],
  integrations: ["slack", "github", "figma", "linear", "jira", "notion", "snowflake", "api", "mcp"],
  "project-specific": ["storybook", "react-native"],
};

export const MCP_REGISTRY_URL =
  "https://api.anthropic.com/mcp-registry/v0/servers?visibility=commercial&limit=100";
export const MCP_REGISTRY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Maps detected tech stacks and description keywords to relevant MCP server slugs.
 * Used by the pipeline to compute MCP recommendations.
 *
 * Keys: tech stack names (matching STACK_FILES values) or lowercase keywords
 * found in repo descriptions.
 * Values: array of MCP server slugs from the Anthropic registry.
 */
export const MCP_STACK_HINTS = {
  // Stack-based (keys match STACK_FILES values)
  next: ["vercel", "figma"],
  react: ["figma"],
  python: ["sentry"],
  go: ["sentry"],
  rust: ["sentry"],
  java: ["sentry"],
  expo: ["figma"],

  // Keyword-based (matched against lowercased repo descriptions)
  supabase: ["supabase"],
  stripe: ["stripe"],
  vercel: ["vercel"],
  sentry: ["sentry"],
  notion: ["notion"],
  linear: ["linear"],
  jira: ["atlassian"],
  confluence: ["atlassian"],
  slack: ["slack"],
  figma: ["figma"],
  github: ["github"],
  huggingface: ["hugging-face"],
  "hugging face": ["hugging-face"],
};

export const CATEGORY_ORDER = [
  "workflow",
  "code-quality",
  "debugging",
  "research",
  "integrations",
  "project-specific",
];

// Last verified against Claude Code v2.1.72 (March 2026)
export const QUICK_REFERENCE = {
  essentialCommands: [
    { cmd: "/help", desc: "Show help and available commands" },
    { cmd: "/compact", desc: "Compact conversation to free context" },
    { cmd: "/model", desc: "Switch AI model" },
    { cmd: "/diff", desc: "Interactive diff viewer for changes" },
    { cmd: "/status", desc: "Version, model, account info" },
    { cmd: "/cost", desc: "Show token usage statistics" },
    { cmd: "/plan", desc: "Enter plan mode for complex tasks" },
    { cmd: "/config", desc: "Open settings interface" },
    { cmd: "/mcp", desc: "Manage MCP server connections" },
    { cmd: "/memory", desc: "Edit CLAUDE.md, toggle auto-memory" },
    { cmd: "/permissions", desc: "View or update tool permissions" },
    { cmd: "/init", desc: "Initialize project with CLAUDE.md" },
    { cmd: "/insights", desc: "Generate usage analytics report" },
    { cmd: "/export", desc: "Export conversation as plain text" },
    { cmd: "/pr-comments", desc: "Fetch GitHub PR review comments" },
    { cmd: "/doctor", desc: "Diagnose installation issues" },
  ],
  tools: [
    { name: "Bash", desc: "Execute shell commands" },
    { name: "Read", desc: "Read files (text, images, PDFs, notebooks)" },
    { name: "Write", desc: "Create new files" },
    { name: "Edit", desc: "Modify files via exact string replacement" },
    { name: "Grep", desc: "Search file contents with regex" },
    { name: "Glob", desc: "Find files by pattern" },
    { name: "Agent", desc: "Launch specialized sub-agents" },
    { name: "WebSearch", desc: "Search the web" },
    { name: "WebFetch", desc: "Fetch URL content" },
    { name: "LSP", desc: "Code intelligence (go-to-def, references)" },
  ],
  shortcuts: [
    { keys: "/", desc: "Quick command search" },
    { keys: "!", desc: "Bash mode (run directly)" },
    { keys: "@", desc: "File path autocomplete" },
    { keys: "Ctrl+C", desc: "Cancel generation" },
    { keys: "Ctrl+L", desc: "Clear screen" },
    { keys: "Ctrl+R", desc: "Search history" },
    { keys: "Shift+Tab", desc: "Toggle permission mode" },
    { keys: "Esc Esc", desc: "Rewind conversation" },
    { keys: "Tab", desc: "Toggle thinking" },
  ],
};
