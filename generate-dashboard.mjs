#!/usr/bin/env node
/**
 * Claude Code Dashboard Generator
 *
 * Scans your home directory for git repos, collects Claude Code configuration
 * (commands, rules, AGENTS.md/CLAUDE.md), and generates a self-contained
 * HTML dashboard.
 *
 * Usage:
 *   npx claude-code-dashboard
 *   node generate-dashboard.mjs [--output path] [--open] [--help] [--version]
 *
 * Config: ~/.claude/dashboard.conf (optional)
 *   - One directory per line to restrict scanning scope
 *   - chain: A -> B -> C  to define dependency chains
 *   - Lines starting with # are comments
 */

import { execFileSync, execFile } from "child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
  lstatSync,
  readlinkSync,
} from "fs";
import { join, basename, dirname } from "path";
import { homedir } from "os";

// ── Constants ────────────────────────────────────────────────────────────────

const VERSION = "0.4.0";

const HOME = homedir();
const CLAUDE_DIR = join(HOME, ".claude");
const DEFAULT_OUTPUT = join(CLAUDE_DIR, "dashboard.html");
const CONF = join(CLAUDE_DIR, "dashboard.conf");
const MAX_DEPTH = 5;

// Freshness thresholds (seconds)
const ONE_DAY = 86_400;
const TWO_DAYS = 172_800;
const THIRTY_DAYS = 2_592_000;
const NINETY_DAYS = 7_776_000;
const ONE_YEAR = 31_536_000;

// Directories to skip during repo discovery
const PRUNE = new Set([
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
const BOILERPLATE_RE = new RegExp(BOILERPLATE_PATTERNS.join("|"));

// ── CLI Argument Parsing ─────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    output: DEFAULT_OUTPUT,
    open: false,
    json: false,
    catalog: false,
    command: null,
    template: null,
    dryRun: false,
  };
  let i = 2; // skip node + script
  if (argv[2] === "init") {
    args.command = "init";
    i = 3;
  }
  while (i < argv.length) {
    switch (argv[i]) {
      case "--help":
      case "-h":
        console.log(`claude-code-dashboard v${VERSION}

Scans your home directory for git repos with Claude Code configuration
and generates a self-contained HTML dashboard.

Usage:
  claude-code-dashboard [options]

Options:
  --output, -o <path>  Output path (default: ~/.claude/dashboard.html)
  --json               Output full data model as JSON instead of HTML
  --catalog            Generate a shareable skill catalog HTML page
  --open               Open the dashboard in your default browser after generating
  --version, -v        Show version
  --help, -h           Show this help

Subcommands:
  init                 Scaffold Claude Code config for current directory
    --template, -t <stack>  Override auto-detected stack (next, react, python, etc.)
    --dry-run               Preview what would be created without writing files

Config file: ~/.claude/dashboard.conf
  Add directories (one per line) to restrict scanning scope.
  Define dependency chains: chain: A -> B -> C
  Lines starting with # are comments.`);
        process.exit(0);
      case "--version":
      case "-v":
        console.log(VERSION);
        process.exit(0);
      case "--output":
      case "-o":
        args.output = argv[++i];
        if (!args.output) {
          console.error("Error: --output requires a path argument");
          process.exit(1);
        }
        // Expand ~ at the start of the path
        if (args.output.startsWith("~")) {
          args.output = args.output.replace(/^~/, HOME);
        }
        break;
      case "--json":
        args.json = true;
        break;
      case "--catalog":
        args.catalog = true;
        break;
      case "--open":
        args.open = true;
        break;
      case "--template":
      case "-t":
        args.template = argv[++i];
        if (!args.template) {
          console.error("Error: --template requires a stack argument");
          process.exit(1);
        }
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        console.error(`Unknown option: ${argv[i]}\nRun with --help for usage.`);
        process.exit(1);
    }
    i++;
  }
  return args;
}

const cliArgs = parseArgs(process.argv);

// ── Tech Stack Detection (const, must precede init handler) ─────────────────

const STACK_FILES = {
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

// ── Template Sections for init ──────────────────────────────────────────────

const TEMPLATE_SECTIONS = {
  next: {
    purpose: "Next.js web application",
    commands: "npm run dev, npm run build, npm run lint, npm test",
    rules: [
      "Use App Router conventions",
      "Server components by default, 'use client' only when needed",
      "Use TypeScript strict mode",
    ],
  },
  react: {
    purpose: "React application",
    commands: "npm start, npm run build, npm run lint, npm test",
    rules: [
      "Functional components with hooks",
      "Co-locate component, test, and styles",
      "Use TypeScript strict mode",
    ],
  },
  python: {
    purpose: "Python application",
    commands: "pytest, ruff check ., ruff format .",
    rules: [
      "Type hints on all public functions",
      "Use dataclasses/pydantic for data models",
      "Keep modules focused and small",
    ],
  },
  node: {
    purpose: "Node.js application",
    commands: "npm start, npm test, npm run lint",
    rules: [
      "Use ES modules (import/export)",
      "Handle errors explicitly, never swallow",
      "Use async/await over callbacks",
    ],
  },
  go: {
    purpose: "Go application",
    commands: "go build ./..., go test ./..., golangci-lint run",
    rules: [
      "Handle all errors explicitly",
      "Use interfaces for testability",
      "Keep packages focused",
    ],
  },
  expo: {
    purpose: "Expo/React Native mobile application",
    commands: "npx expo start, npm test, npm run lint",
    rules: [
      "Use Expo SDK APIs over bare React Native",
      "Test on both iOS and Android",
      "Use TypeScript strict mode",
    ],
  },
  rust: {
    purpose: "Rust application",
    commands: "cargo build, cargo test, cargo clippy",
    rules: [
      "Prefer owned types in public APIs",
      "Use Result for fallible operations",
      "Document public items",
    ],
  },
  swift: {
    purpose: "Swift application",
    commands: "swift build, swift test",
    rules: [
      "Use Swift concurrency (async/await)",
      "Protocol-oriented design",
      "Prefer value types",
    ],
  },
  generic: {
    purpose: "Software project",
    commands: "",
    rules: [
      "Follow existing patterns in the codebase",
      "Test before committing",
      "Keep functions focused and small",
    ],
  },
};

function generateTemplate(stack, exemplar, pattern) {
  const t = TEMPLATE_SECTIONS[stack] || TEMPLATE_SECTIONS.generic;
  const lines = [];

  lines.push(`# ${basename(process.cwd())}`);
  lines.push("");
  lines.push(`> ${t.purpose}`);
  lines.push("");

  if (t.commands) {
    lines.push("## Commands");
    lines.push("");
    for (const cmd of t.commands.split(", ")) {
      lines.push(`- \`${cmd}\``);
    }
    lines.push("");
  }

  lines.push("## Architecture");
  lines.push("");
  lines.push("<!-- Describe key directories, data flow, and patterns -->");
  lines.push("");

  lines.push("## Rules");
  lines.push("");
  for (const rule of t.rules) {
    lines.push(`- ${rule}`);
  }
  lines.push("");

  lines.push("## Quality Gates");
  lines.push("");
  lines.push("- [ ] All tests passing");
  lines.push("- [ ] Linter clean");
  lines.push("- [ ] No TypeScript errors");
  lines.push("");

  if (exemplar) {
    lines.push(
      `<!-- Based on ${exemplar.name} (health: ${exemplar.healthScore}, pattern: ${pattern}) -->`,
    );
  }

  return lines.join("\n");
}

// ── Init Subcommand ─────────────────────────────────────────────────────────

if (cliArgs.command === "init") {
  const cwd = process.cwd();
  const stackInfo = detectTechStack(cwd);
  const stack = cliArgs.template || stackInfo.stacks[0] || "generic";

  // Scan repos to find exemplar
  let exemplar = null;
  let pattern = "minimal";
  if (existsSync(CONF)) {
    const initRoots = getScanRoots();
    const initRepoPaths = findGitRepos(initRoots, MAX_DEPTH);
    const configuredForInit = [];
    for (const repoDir of initRepoPaths) {
      const commands = scanMdDir(join(repoDir, ".claude", "commands"));
      const rules = scanMdDir(join(repoDir, ".claude", "rules"));
      let agentsFile = null;
      if (existsSync(join(repoDir, "AGENTS.md"))) agentsFile = join(repoDir, "AGENTS.md");
      else if (existsSync(join(repoDir, "CLAUDE.md"))) agentsFile = join(repoDir, "CLAUDE.md");
      if (!agentsFile && commands.length === 0 && rules.length === 0) continue;
      const sections = agentsFile ? extractSections(agentsFile) : [];
      const ts = detectTechStack(repoDir);
      const fc = freshnessClass(getFreshness(repoDir));
      const health = computeHealthScore({
        hasAgentsFile: !!agentsFile,
        desc: agentsFile ? extractProjectDesc(agentsFile) : [],
        commandCount: commands.length,
        ruleCount: rules.length,
        sectionCount: sections.length,
        freshnessClass: fc,
      });
      configuredForInit.push({
        name: basename(repoDir),
        commands,
        rules,
        sections,
        techStack: ts.stacks,
        healthScore: health.score,
        hasAgentsFile: !!agentsFile,
      });
    }
    exemplar = findExemplar([stack], configuredForInit);
    if (exemplar) pattern = detectConfigPattern(exemplar);
  }

  const content = generateTemplate(stack, exemplar, pattern);
  const claudeMdPath = join(cwd, "CLAUDE.md");

  if (cliArgs.dryRun) {
    console.log(`Would create: ${claudeMdPath}`);
    console.log(`Stack: ${stack}`);
    if (exemplar) console.log(`Exemplar: ${exemplar.name} (${pattern})`);
    console.log("---");
    console.log(content);
    process.exit(0);
  }

  if (existsSync(claudeMdPath)) {
    console.error(
      `Error: ${claudeMdPath} already exists. Remove it first or use --dry-run to preview.`,
    );
    process.exit(1);
  }

  writeFileSync(claudeMdPath, content);
  console.log(
    `Created ${claudeMdPath} (stack: ${stack}${exemplar ? `, based on ${exemplar.name}` : ""})`,
  );
  process.exit(0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const shortPath = (p) => p.replace(HOME, "~");

/** Run a git command safely using execFileSync (no shell injection). */
function gitCmd(repoDir, ...args) {
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

// ── Repo Discovery ───────────────────────────────────────────────────────────

function findGitRepos(roots, maxDepth) {
  const repos = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === ".git") {
        repos.push(dir);
        return; // don't recurse inside a git repo's subdirs
      }
      if (PRUNE.has(entry)) continue;
      const full = join(dir, entry);
      try {
        if (statSync(full).isDirectory()) walk(full, depth + 1);
      } catch {
        /* permission denied, symlink loops, etc */
      }
    }
  }
  for (const root of roots) {
    if (existsSync(root)) walk(root, 0);
  }
  return repos;
}

function getScanRoots() {
  if (existsSync(CONF)) {
    const dirs = readFileSync(CONF, "utf8")
      .split("\n")
      .map((l) => l.replace(/#.*/, "").trim())
      .filter((l) => l && !l.startsWith("chain:"))
      .map((l) => l.replace(/^~/, HOME))
      .filter((d) => existsSync(d));
    if (dirs.length) return dirs;
  }
  return [HOME];
}

// ── Markdown Parsing ─────────────────────────────────────────────────────────

function getDescFromContent(content) {
  const lines = content.split("\n");

  // YAML frontmatter
  if (lines[0] === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") break;
      const m = lines[i].match(/^description:\s*(.+)/);
      if (m) return m[1].trim();
    }
  }

  if (lines[0]?.startsWith("# ")) return lines[0].slice(2);

  // First non-empty, non-frontmatter line
  for (const l of lines.slice(0, 5)) {
    const t = l.trim();
    if (t && t !== "---" && !t.startsWith("```")) {
      return t.length > 60 ? t.slice(0, 57) + "..." : t;
    }
  }
  return "";
}

function getDesc(filepath) {
  try {
    return getDescFromContent(readFileSync(filepath, "utf8"));
  } catch {
    return "";
  }
}

function extractProjectDesc(filepath) {
  let lines;
  try {
    lines = readFileSync(filepath, "utf8").split("\n");
  } catch {
    return [];
  }

  const result = [];
  let inCode = false;
  let foundContent = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (line.startsWith("# ") && result.length === 0) continue;
    if (!line.trim() && !foundContent) continue;
    if (line.startsWith("## ") && foundContent) break;
    if (line.startsWith("## ") && !foundContent) continue;
    if (BOILERPLATE_RE.test(line)) continue;
    if (/^[^#|`]/.test(line) && line.trim().length > 5) {
      foundContent = true;
      result.push(line.replace(/\*\*/g, "").replace(/`/g, ""));
      if (result.length >= 2) break;
    }
  }
  return result;
}

function extractSections(filepath) {
  let lines;
  try {
    lines = readFileSync(filepath, "utf8").split("\n");
  } catch {
    return [];
  }

  const sections = [];
  let current = null;
  let inCode = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    if (line.startsWith("## ")) {
      current = { name: line.slice(3), preview: [] };
      sections.push(current);
      continue;
    }
    if (current && current.preview.length < 3 && !line.startsWith("#") && line.trim()) {
      let cleaned = line.replace(/\*\*/g, "").replace(/`/g, "").replace(/^- /, "");
      if (cleaned.trim().length > 2) {
        if (cleaned.length > 80) cleaned = cleaned.slice(0, 77) + "...";
        current.preview.push(cleaned.trim());
      }
    }
  }
  return sections;
}

function extractSteps(filepath) {
  let lines;
  try {
    lines = readFileSync(filepath, "utf8").split("\n");
  } catch {
    return [];
  }

  const steps = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      steps.push({ type: "section", text: line.slice(3) });
    } else if (/^\d+\. /.test(line)) {
      steps.push({ type: "step", text: line.replace(/^\d+\. /, "").replace(/\*\*/g, "") });
    } else if (line.startsWith("- **")) {
      const m = line.match(/^- \*\*([^*]+)\*\*/);
      if (m) steps.push({ type: "key", text: m[1] });
    }
    if (steps.length >= 12) break;
  }
  return steps;
}

// ── Data Collection ──────────────────────────────────────────────────────────

function scanMdDir(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const full = join(dir, f);
      const name = f.slice(0, -3);
      const desc = getDesc(full);
      results.push({ name, desc: desc || "No description", filepath: full });
    }
  } catch {
    /* directory unreadable */
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Skill Source Detection ───────────────────────────────────────────────────

const SKILL_CATEGORIES = {
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

const CATEGORY_ORDER = [
  "workflow",
  "code-quality",
  "debugging",
  "research",
  "integrations",
  "project-specific",
];

/**
 * Detect where a skill was sourced from:
 * - "superpowers" — tracked in the obra/superpowers-skills git repo
 * - "skills.sh" — installed via skills.sh, symlinked from ~/.agents/skills/
 * - "custom" — user-created, not tracked by any known source
 */
function detectSkillSource(skillName, skillsDir) {
  const skillPath = join(skillsDir, skillName);

  // 1. Check if it's a symlink → skills.sh
  try {
    const stat = lstatSync(skillPath);
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(skillPath);
      if (target.includes(".agents/skills") || target.includes(".agents\\skills")) {
        // Try to read source info from skill-lock.json
        const lockPath = join(HOME, ".agents", ".skill-lock.json");
        if (existsSync(lockPath)) {
          try {
            const lock = JSON.parse(readFileSync(lockPath, "utf8"));
            const entry = lock.skills?.[skillName];
            if (entry) {
              return {
                type: "skills.sh",
                repo: entry.source || "",
                url: (entry.sourceUrl || "").replace(/\.git$/, ""),
              };
            }
          } catch {
            /* malformed JSON */
          }
        }
        return { type: "skills.sh" };
      }
    }
  } catch {
    /* not a symlink or unreadable */
  }

  // 2. Check if it comes from the git repo (e.g. obra/superpowers-skills)
  if (existsSync(join(skillsDir, ".git"))) {
    const remote = gitCmd(skillsDir, "remote", "get-url", "origin");
    if (remote) {
      // obra/superpowers-skills convention: skills live under a skills/ directory in the repo.
      // This may not match other skill repos with flat structures.
      const tracked = gitCmd(skillsDir, "ls-tree", "--name-only", "HEAD:skills/");
      if (tracked) {
        const trackedNames = new Set(tracked.split("\n").filter(Boolean));
        if (trackedNames.has(skillName)) {
          const repoSlug = remote.replace(/\.git$/, "").replace(/^https?:\/\/github\.com\//, "");
          return {
            type: "superpowers",
            repo: repoSlug,
            url: remote.replace(/\.git$/, ""),
          };
        }
      }
    }
  }

  // 3. Fallback: custom
  return { type: "custom" };
}

/** Categorize a skill based on its name and description content. */
function categorizeSkill(name, content) {
  const nameLower = name.toLowerCase();
  const contentLower = content.toLowerCase();
  let bestCategory = "workflow";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(SKILL_CATEGORIES)) {
    // Name matches get 3x weight since the name is the strongest signal
    const nameScore = keywords.reduce((sum, kw) => sum + (nameLower.includes(kw) ? 3 : 0), 0);
    const contentScore = keywords.reduce((sum, kw) => sum + (contentLower.includes(kw) ? 1 : 0), 0);
    const score = nameScore + contentScore;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }
  return bestCategory;
}

/** Scan ~/.claude/skills/ — each subdirectory with a SKILL.md is a skill. */
function scanSkillsDir(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const skillFile = join(dir, entry, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      let content = "";
      try {
        content = readFileSync(skillFile, "utf8");
      } catch {
        /* unreadable */
      }
      const desc = getDescFromContent(content);
      const source = detectSkillSource(entry, dir);
      const category = categorizeSkill(entry, content);
      results.push({
        name: entry,
        desc: desc || "No description",
        filepath: skillFile,
        source,
        category,
      });
    }
  } catch {
    /* directory unreadable */
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Config Health Score ──────────────────────────────────────────────────────

function computeHealthScore(repo) {
  let score = 0;
  const reasons = [];

  // Has AGENTS.md/CLAUDE.md (30 points)
  if (repo.hasAgentsFile) {
    score += 30;
  } else {
    reasons.push("add CLAUDE.md");
  }

  // Has description (10 points)
  if (repo.desc && repo.desc.length > 0) {
    score += 10;
  } else {
    reasons.push("add project description");
  }

  // Has commands (20 points)
  if (repo.commandCount > 0) {
    score += Math.min(20, repo.commandCount * 10);
  } else {
    reasons.push("add commands");
  }

  // Has rules (20 points)
  if (repo.ruleCount > 0) {
    score += Math.min(20, repo.ruleCount * 10);
  } else {
    reasons.push("add rules");
  }

  // Has sections / structured config (10 points)
  if (repo.sectionCount > 0) {
    score += Math.min(10, repo.sectionCount * 2);
  } else {
    reasons.push("add structured sections");
  }

  // Freshness (10 points)
  if (repo.freshnessClass === "fresh") {
    score += 10;
  } else if (repo.freshnessClass === "aging") {
    score += 5;
    reasons.push("update config (aging)");
  } else {
    reasons.push("update config (stale)");
  }

  return { score: Math.min(100, score), reasons };
}

// ── Tech Stack Detection ────────────────────────────────────────────────────

function detectTechStack(repoDir) {
  const stacks = new Set();
  let hasPackageJson = false;

  try {
    const entries = new Set(readdirSync(repoDir));

    for (const [file, stack] of Object.entries(STACK_FILES)) {
      if (entries.has(file)) stacks.add(stack);
    }

    if (entries.has("package.json")) {
      hasPackageJson = true;
      // Check for React/Expo in package.json if no framework detected yet
      if (!stacks.has("next") && !stacks.has("expo")) {
        try {
          const pkg = JSON.parse(readFileSync(join(repoDir, "package.json"), "utf8"));
          const allDeps = {
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {}),
          };
          if (allDeps["expo"]) stacks.add("expo");
          else if (allDeps["next"]) stacks.add("next");
          else if (allDeps["react"]) stacks.add("react");
        } catch {
          /* malformed package.json */
        }
      }
      if (stacks.size === 0) stacks.add("node");
    }
  } catch {
    /* unreadable dir */
  }

  return { stacks: [...stacks], hasPackageJson };
}

// ── Drift Detection ─────────────────────────────────────────────────────────

function computeDrift(repoDir, configTimestamp) {
  if (!configTimestamp) return { level: "unknown", commitsSince: 0 };

  // Count commits since the config was last updated
  const countStr = gitCmd(repoDir, "rev-list", "--count", `--since=${configTimestamp}`, "HEAD");
  if (!countStr) return { level: "unknown", commitsSince: 0 };

  const parsed = Number(countStr);
  if (!Number.isFinite(parsed)) return { level: "unknown", commitsSince: 0 };

  const commitsSince = Math.max(0, parsed - 1); // -1 to exclude the config commit itself

  if (commitsSince === 0) return { level: "synced", commitsSince: 0 };
  if (commitsSince <= 5) return { level: "low", commitsSince };
  if (commitsSince <= 20) return { level: "medium", commitsSince };
  return { level: "high", commitsSince };
}

// ── Cross-Repo Suggestions ──────────────────────────────────────────────────

function findExemplar(stack, configuredRepos) {
  if (!stack || stack.length === 0) return null;
  let best = null;
  let bestScore = -1;
  for (const repo of configuredRepos) {
    const repoStacks = repo.techStack || [];
    const overlap = stack.filter((s) => repoStacks.includes(s)).length;
    const score = overlap * 100 + (repo.healthScore || 0);
    if (overlap > 0 && score > bestScore) {
      bestScore = score;
      best = repo;
    }
  }
  return best;
}

function generateSuggestions(exemplar) {
  if (!exemplar) return [];
  const suggestions = [];
  if (exemplar.hasAgentsFile) suggestions.push("add CLAUDE.md");
  if (exemplar.commands?.length > 0)
    suggestions.push(`add commands (${exemplar.name} has ${exemplar.commands.length})`);
  if (exemplar.rules?.length > 0)
    suggestions.push(`add rules (${exemplar.name} has ${exemplar.rules.length})`);
  return suggestions;
}

function detectConfigPattern(repo) {
  if (repo.rules.length >= 3) return "modular";
  if (repo.sections.length >= 3) return "monolithic";
  if (repo.commands.length >= 2 && repo.sections.length === 0) return "command-heavy";
  return "minimal";
}

function computeConfigSimilarity(repoA, repoB) {
  if (!repoA || !repoB) return 0;
  let matches = 0;
  let total = 0;

  // Section name overlap (Jaccard similarity)
  const sectionsA = new Set((repoA.sections || []).map((s) => s.name || s));
  const sectionsB = new Set((repoB.sections || []).map((s) => s.name || s));
  if (sectionsA.size > 0 || sectionsB.size > 0) {
    const intersection = [...sectionsA].filter((s) => sectionsB.has(s)).length;
    const union = new Set([...sectionsA, ...sectionsB]).size;
    matches += intersection;
    total += union;
  }

  // Stack overlap
  const stackA = new Set(repoA.techStack || []);
  const stackB = new Set(repoB.techStack || []);
  if (stackA.size > 0 || stackB.size > 0) {
    const intersection = [...stackA].filter((s) => stackB.has(s)).length;
    const union = new Set([...stackA, ...stackB]).size;
    matches += intersection;
    total += union;
  }

  // Same config pattern bonus
  if (repoA.configPattern && repoA.configPattern === repoB.configPattern) {
    matches += 1;
    total += 1;
  } else {
    total += 1;
  }

  return total > 0 ? Math.round((matches / total) * 100) : 0;
}

// ── Freshness ───────────────────────────────────────────────────────────────

function getFreshness(repoDir) {
  const ts = gitCmd(
    repoDir,
    "log",
    "-1",
    "--format=%ct",
    "--",
    "CLAUDE.md",
    "AGENTS.md",
    ".claude/",
  );
  const parsed = Number(ts);
  return Number.isFinite(parsed) ? parsed : 0;
}

function relativeTime(ts) {
  if (!ts) return "unknown";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < ONE_DAY) return "today";
  if (diff < TWO_DAYS) return "yesterday";
  if (diff < THIRTY_DAYS) return `${Math.floor(diff / ONE_DAY)}d ago`;
  if (diff < ONE_YEAR) return `${Math.floor(diff / THIRTY_DAYS)}mo ago`;
  return `${Math.floor(diff / ONE_YEAR)}y ago`;
}

function freshnessClass(ts) {
  if (!ts) return "stale";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < THIRTY_DAYS) return "fresh";
  if (diff < NINETY_DAYS) return "aging";
  return "stale";
}

// ── Collect Everything ───────────────────────────────────────────────────────

const scanRoots = getScanRoots();
const allRepoPaths = findGitRepos(scanRoots, MAX_DEPTH);

const globalCmds = scanMdDir(join(CLAUDE_DIR, "commands"));
const globalRules = scanMdDir(join(CLAUDE_DIR, "rules"));
const globalSkills = scanSkillsDir(join(CLAUDE_DIR, "skills"));

const configured = [];
const unconfigured = [];
const seenNames = new Map();

for (const repoDir of allRepoPaths) {
  const name = basename(repoDir);

  // Collision-safe display key
  const count = (seenNames.get(name) || 0) + 1;
  seenNames.set(name, count);
  const key = count > 1 ? `${name}__${count}` : name;

  const repo = {
    key,
    name,
    path: repoDir,
    shortPath: shortPath(repoDir),
    commands: scanMdDir(join(repoDir, ".claude", "commands")),
    rules: scanMdDir(join(repoDir, ".claude", "rules")),
    desc: [],
    sections: [],
    freshness: 0,
    freshnessText: "",
    freshnessClass: "stale",
  };

  // AGENTS.md / CLAUDE.md
  let agentsFile = null;
  if (existsSync(join(repoDir, "AGENTS.md"))) agentsFile = join(repoDir, "AGENTS.md");
  else if (existsSync(join(repoDir, "CLAUDE.md"))) agentsFile = join(repoDir, "CLAUDE.md");

  if (agentsFile) {
    repo.desc = extractProjectDesc(agentsFile);
    repo.sections = extractSections(agentsFile);
  }

  const hasConfig = repo.commands.length > 0 || repo.rules.length > 0 || agentsFile;

  // Tech stack (for both configured and unconfigured)
  const stackInfo = detectTechStack(repoDir);
  repo.techStack = stackInfo.stacks;

  if (hasConfig) {
    repo.freshness = getFreshness(repoDir);
    repo.freshnessText = relativeTime(repo.freshness);
    repo.freshnessClass = freshnessClass(repo.freshness);

    // Health score
    const health = computeHealthScore({
      hasAgentsFile: !!agentsFile,
      desc: repo.desc,
      commandCount: repo.commands.length,
      ruleCount: repo.rules.length,
      sectionCount: repo.sections.length,
      freshnessClass: repo.freshnessClass,
    });
    repo.healthScore = health.score;
    repo.healthReasons = health.reasons;
    repo.hasAgentsFile = !!agentsFile;
    repo.configPattern = detectConfigPattern(repo);

    // Drift detection
    const drift = computeDrift(repoDir, repo.freshness);
    repo.drift = drift;

    configured.push(repo);
  } else {
    unconfigured.push(repo);
  }
}

// Sort configured by richness (most config first)
configured.sort((a, b) => {
  const score = (r) =>
    r.commands.length * 3 + r.rules.length * 2 + r.sections.length + (r.desc.length > 0 ? 1 : 0);
  return score(b) - score(a);
});

unconfigured.sort((a, b) => a.name.localeCompare(b.name));

// Compute suggestions for unconfigured repos (needs full configured list)
for (const repo of unconfigured) {
  const exemplar = findExemplar(repo.techStack, configured);
  if (exemplar) {
    repo.suggestions = generateSuggestions(exemplar);
    repo.exemplarName = exemplar.name;
  } else {
    repo.suggestions = [];
    repo.exemplarName = "";
  }
}

// Compute similar repos for configured repos
for (const repo of configured) {
  const similar = configured
    .filter((r) => r !== repo)
    .map((r) => ({ name: r.name, similarity: computeConfigSimilarity(repo, r) }))
    .filter((r) => r.similarity >= 40)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 2);
  repo.similarRepos = similar;
}

// Detect consolidation opportunities
const consolidationGroups = [];
const byStack = {};
for (const repo of configured) {
  for (const s of repo.techStack || []) {
    if (!byStack[s]) byStack[s] = [];
    byStack[s].push(repo);
  }
}
for (const [stack, repos] of Object.entries(byStack)) {
  if (repos.length >= 3) {
    let pairCount = 0;
    let simSum = 0;
    for (let i = 0; i < repos.length; i++) {
      for (let j = i + 1; j < repos.length; j++) {
        simSum += computeConfigSimilarity(repos[i], repos[j]);
        pairCount++;
      }
    }
    const avgSimilarity = pairCount > 0 ? Math.round(simSum / pairCount) : 0;
    if (avgSimilarity >= 30) {
      consolidationGroups.push({
        stack,
        repos: repos.map((r) => r.name),
        avgSimilarity,
        suggestion: `${repos.length} ${stack} repos with ${avgSimilarity}% avg similarity — consider shared global rules`,
      });
    }
  }
}

// Dependency chains from config
function parseChains() {
  if (!existsSync(CONF)) return [];
  const chains = [];
  for (const line of readFileSync(CONF, "utf8").split("\n")) {
    const m = line.match(/^chain:\s*(.+)/i);
    if (!m) continue;
    const raw = m[1];
    if (raw.includes("<-")) {
      chains.push({ nodes: raw.split(/\s*<-\s*/), arrow: "&larr;" });
    } else {
      chains.push({ nodes: raw.split(/\s*->\s*/), arrow: "&rarr;" });
    }
  }
  return chains;
}
const chains = parseChains();

// Stats
const totalRepos = allRepoPaths.length;
const configuredCount = configured.length;
const unconfiguredCount = unconfigured.length;
const coveragePct = totalRepos > 0 ? Math.round((configuredCount / totalRepos) * 100) : 0;
const totalRepoCmds = configured.reduce((sum, r) => sum + r.commands.length, 0);
const avgHealth =
  configured.length > 0
    ? Math.round(configured.reduce((sum, r) => sum + (r.healthScore || 0), 0) / configured.length)
    : 0;
const driftCount = configured.filter(
  (r) => r.drift && (r.drift.level === "medium" || r.drift.level === "high"),
).length;

const now = new Date();
const timestamp =
  now
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toLowerCase() +
  " at " +
  now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();

const scanScope = existsSync(CONF) ? `config: ${shortPath(CONF)}` : "~/ (depth 5)";

// ── JSON Output (short-circuit before HTML generation) ──────────────────────

if (cliArgs.json) {
  const jsonData = {
    version: VERSION,
    generatedAt: now.toISOString(),
    scanScope,
    stats: {
      totalRepos,
      configuredRepos: configuredCount,
      unconfiguredRepos: unconfiguredCount,
      coveragePct,
      globalCommands: globalCmds.length,
      globalRules: globalRules.length,
      skills: globalSkills.length,
      repoCommands: totalRepoCmds,
      avgHealthScore: avgHealth,
      driftingRepos: driftCount,
    },
    globalCommands: globalCmds.map((c) => ({ name: c.name, description: c.desc })),
    globalRules: globalRules.map((r) => ({ name: r.name, description: r.desc })),
    skills: globalSkills.map((s) => ({
      name: s.name,
      description: s.desc,
      source: s.source,
      category: s.category,
    })),
    chains: chains.map((c) => ({
      nodes: c.nodes.map((n) => n.trim()),
      direction: c.arrow === "&rarr;" ? "forward" : "backward",
    })),
    configuredRepos: configured.map((r) => ({
      name: r.name,
      path: r.shortPath,
      commands: r.commands.map((c) => ({ name: c.name, description: c.desc })),
      rules: r.rules.map((ru) => ({ name: ru.name, description: ru.desc })),
      sections: r.sections.map((s) => s.name),
      description: r.desc,
      techStack: r.techStack || [],
      healthScore: r.healthScore || 0,
      healthReasons: r.healthReasons || [],
      freshness: {
        timestamp: r.freshness,
        relative: r.freshnessText,
        class: r.freshnessClass,
      },
      drift: r.drift || { level: "unknown", commitsSince: 0 },
      configPattern: r.configPattern || "minimal",
      similarRepos: r.similarRepos || [],
    })),
    consolidationGroups,
    unconfiguredRepos: unconfigured.map((r) => ({
      name: r.name,
      path: r.shortPath,
      techStack: r.techStack || [],
      suggestions: r.suggestions || [],
      exemplar: r.exemplarName || "",
    })),
  };

  const jsonOutput = JSON.stringify(jsonData, null, 2);

  if (cliArgs.output !== DEFAULT_OUTPUT) {
    mkdirSync(dirname(cliArgs.output), { recursive: true });
    writeFileSync(cliArgs.output, jsonOutput);
    console.log(cliArgs.output);
  } else {
    process.stdout.write(jsonOutput + "\n");
  }
  process.exit(0);
}

// ── Catalog Output (short-circuit before main HTML) ─────────────────────────
// Note: --json takes precedence over --catalog if both are passed

if (cliArgs.catalog) {
  const groups = groupSkillsByCategory(globalSkills);
  const catalogHtml = generateCatalogHtml(groups, globalSkills.length, timestamp);
  const outputPath =
    cliArgs.output !== DEFAULT_OUTPUT ? cliArgs.output : join(CLAUDE_DIR, "skill-catalog.html");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, catalogHtml);
  console.log(outputPath);
  if (cliArgs.open) {
    const cmd =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    execFile(cmd, [outputPath]);
  }
  process.exit(0);
}

// ── HTML Rendering ───────────────────────────────────────────────────────────

function renderSections(sections) {
  return sections
    .map(
      (s) =>
        `<details class="agent-section"><summary>${esc(s.name)}</summary>` +
        (s.preview.length
          ? `<div class="agent-section-preview">${s.preview.map((l) => `<div class="line">${esc(l)}</div>`).join("")}</div>`
          : "") +
        `</details>`,
    )
    .join("");
}

function renderCmd(cmd, prefix = "/") {
  const steps = extractSteps(cmd.filepath);
  const d = esc(cmd.desc);
  if (steps.length) {
    const body = steps.map((s) => `<div class="detail-${s.type}">${esc(s.text)}</div>`).join("");
    return `<details class="cmd-detail"><summary><span class="cmd-name">${prefix}${esc(cmd.name)}</span><span class="cmd-desc">${d}</span></summary><div class="detail-body">${body}</div></details>`;
  }
  return `<div class="cmd-row"><span class="cmd-name">${prefix}${esc(cmd.name)}</span><span class="cmd-desc">${d}</span></div>`;
}

function renderRule(rule) {
  const sections = extractSections(rule.filepath);
  const d = esc(rule.desc);
  if (sections.length) {
    return `<details class="cmd-detail"><summary><span class="cmd-name">${esc(rule.name)}</span><span class="cmd-desc">${d}</span></summary><div class="detail-body">${renderSections(sections)}</div></details>`;
  }
  return `<div class="cmd-row"><span class="cmd-name">${esc(rule.name)}</span><span class="cmd-desc">${d}</span></div>`;
}

function sourceBadgeHtml(source) {
  if (!source) return "";
  switch (source.type) {
    case "superpowers":
      return `<span class="badge source superpowers">superpowers</span>`;
    case "skills.sh": {
      const label = source.repo ? `skills.sh &middot; ${esc(source.repo)}` : "skills.sh";
      return `<span class="badge source skillssh">${label}</span>`;
    }
    default:
      return `<span class="badge source custom">custom</span>`;
  }
}

function renderSkill(skill) {
  const sections = extractSections(skill.filepath);
  const d = esc(skill.desc);
  const badge = sourceBadgeHtml(skill.source);
  if (sections.length) {
    return `<details class="cmd-detail"><summary><span class="cmd-name skill-name">${esc(skill.name)}</span>${badge}<span class="cmd-desc">${d}</span></summary><div class="detail-body">${renderSections(sections)}</div></details>`;
  }
  return `<div class="cmd-row"><span class="cmd-name skill-name">${esc(skill.name)}</span>${badge}<span class="cmd-desc">${d}</span></div>`;
}

function groupSkillsByCategory(skills) {
  const groups = {};
  for (const cat of CATEGORY_ORDER) {
    groups[cat] = [];
  }
  for (const skill of skills) {
    const cat = skill.category || "workflow";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(skill);
  }
  // Remove empty categories
  for (const cat of Object.keys(groups)) {
    if (groups[cat].length === 0) delete groups[cat];
  }
  return groups;
}

function generateCatalogHtml(groups, totalCount, ts) {
  let cards = "";
  for (const [cat, skills] of Object.entries(groups)) {
    const heading = cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    let rows = "";
    for (const s of skills) {
      const badge = sourceBadgeHtml(s.source);
      let hint = "";
      if (s.source) {
        switch (s.source.type) {
          case "superpowers":
            hint = "Included with superpowers-skills";
            break;
          case "skills.sh":
            hint = s.source.repo
              ? `Installed via skills.sh (${esc(s.source.repo)})`
              : "Installed via skills.sh";
            break;
          default:
            hint = `Custom skill — copy from ~/.claude/skills/${esc(s.name)}/`;
        }
      }
      rows += `
      <div class="cat-skill">
        <div class="cat-skill-head">
          <span class="cat-skill-name">${esc(s.name)}</span>${badge}
        </div>
        <div class="cat-skill-desc">${esc(s.desc)}</div>
        ${hint ? `<div class="cat-skill-hint">${hint}</div>` : ""}
      </div>`;
    }
    cards += `
    <section class="cat-group">
      <h2>${esc(heading)} <span class="cat-n">${skills.length}</span></h2>
      ${rows}
    </section>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude Code Skill Catalog</title>
<style>
  :root {
    --bg: #0a0a0a; --surface: #111; --surface2: #1a1a1a; --border: #262626;
    --text: #e5e5e5; --text-dim: #777; --accent: #c4956a; --accent-dim: #8b6a4a;
    --green: #4ade80; --blue: #60a5fa; --purple: #a78bfa; --yellow: #fbbf24;
    --red: #f87171;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    background: var(--bg); color: var(--text);
    padding: 2.5rem 2rem; line-height: 1.5; max-width: 900px; margin: 0 auto;
  }
  code { font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; }
  h1 { font-size: 1.4rem; font-weight: 600; color: var(--accent); margin-bottom: .2rem; }
  .sub { color: var(--text-dim); font-size: .78rem; margin-bottom: 2rem; }
  .cat-group { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; margin-bottom: 1.25rem; }
  .cat-group h2 { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); margin-bottom: .75rem; display: flex; align-items: center; gap: .5rem; }
  .cat-n { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: .05rem .35rem; font-size: .65rem; color: var(--accent); }
  .cat-skill { padding: .5rem .25rem; border-bottom: 1px solid var(--border); }
  .cat-skill:last-child { border-bottom: none; }
  .cat-skill-head { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
  .cat-skill-name { font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; font-weight: 600; color: var(--yellow); font-size: .82rem; }
  .cat-skill-desc { color: var(--text-dim); font-size: .75rem; margin-top: .15rem; }
  .cat-skill-hint { font-size: .65rem; color: var(--blue); margin-top: .2rem; opacity: .8; }
  .badge { font-size: .55rem; padding: .1rem .35rem; border-radius: 3px; font-weight: 600; }
  .badge.source.superpowers { background: rgba(167,139,250,.1); border: 1px solid rgba(167,139,250,.2); color: var(--purple); }
  .badge.source.skillssh { background: rgba(96,165,250,.1); border: 1px solid rgba(96,165,250,.2); color: var(--blue); }
  .badge.source.custom { background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.2); color: var(--yellow); }
  @media (max-width: 600px) { body { padding: 1.5rem 1rem; } }
</style>
</head>
<body>
<h1>Claude Code Skill Catalog</h1>
<div class="sub">${totalCount} skills &middot; generated ${esc(ts)}</div>
${cards}
</body>
</html>`;
}

function renderBadges(repo) {
  const b = [];
  if (repo.commands.length) b.push(`<span class="badge cmds">${repo.commands.length} cmd</span>`);
  if (repo.rules.length) b.push(`<span class="badge rules">${repo.rules.length} rules</span>`);
  if (repo.sections.length)
    b.push(`<span class="badge agent">${repo.sections.length} sections</span>`);
  if (repo.techStack && repo.techStack.length)
    b.push(`<span class="badge stack">${esc(repo.techStack.join(", "))}</span>`);
  return b.join("");
}

function healthScoreColor(score) {
  if (score >= 80) return "var(--green)";
  if (score >= 50) return "var(--yellow)";
  return "var(--red)";
}

function renderHealthBar(repo) {
  if (repo.healthScore === undefined) return "";
  const s = Math.max(0, Math.min(100, repo.healthScore || 0));
  const color = healthScoreColor(s);
  return `<div class="health-bar"><div class="health-fill" style="width:${s}%;background:${color}"></div><span class="health-label">${s}</span></div>`;
}

function renderDriftIndicator(repo) {
  if (!repo.drift || repo.drift.level === "unknown" || repo.drift.level === "synced") return "";
  const cls = `drift-${esc(repo.drift.level)}`;
  const n = Number(repo.drift.commitsSince) || 0;
  return `<span class="drift ${cls}" title="${n} commits since config update">${n}&#8203;&#916;</span>`;
}

function renderRepoCard(repo) {
  const badges = renderBadges(repo);
  const preview = repo.desc[0] ? esc(repo.desc[0].slice(0, 120)) : "";
  const drift = renderDriftIndicator(repo);

  let body = "";

  body += `<div class="repo-meta"><span class="repo-path">${esc(repo.shortPath)}</span>`;
  body += `<span class="freshness ${repo.freshnessClass}">${esc(repo.freshnessText)}${drift}</span></div>`;

  body += renderHealthBar(repo);

  if (repo.desc.length) {
    body += `<div class="repo-desc">${repo.desc.map((l) => esc(l)).join("<br>")}</div>`;
  }

  if (repo.healthReasons && repo.healthReasons.length) {
    body += `<div class="label">Quick Wins</div>`;
    body += `<div class="quick-wins">${repo.healthReasons.map((r) => `<span class="quick-win">${esc(r)}</span>`).join("")}</div>`;
  }

  if (repo.commands.length) {
    body += `<div class="label">Commands</div>`;
    body += repo.commands.map((c) => renderCmd(c)).join("");
  }

  if (repo.rules.length) {
    body += `<div class="label">Rules</div>`;
    body += repo.rules.map((r) => renderRule(r)).join("");
  }

  if (repo.sections.length) {
    body += `<div class="label">Agent Config</div>`;
    body += renderSections(repo.sections);
  }

  return `<details class="repo-card" data-name="${esc(repo.name)}" data-path="${esc(repo.shortPath)}" data-stack="${esc((repo.techStack || []).join(","))}">
  <summary>
    <div class="repo-header">
      <div class="repo-name">${esc(repo.name)}<span class="freshness-dot ${repo.freshnessClass}"></span></div>
    </div>
    ${preview ? `<div class="repo-preview">${preview}</div>` : ""}
    ${badges ? `<div class="badges">${badges}</div>` : ""}
  </summary>
  <div class="repo-body">${body}</div>
</details>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude Code Dashboard</title>
<style>
  :root {
    --bg: #0a0a0a; --surface: #111; --surface2: #1a1a1a; --border: #262626;
    --text: #e5e5e5; --text-dim: #777; --accent: #c4956a; --accent-dim: #8b6a4a;
    --green: #4ade80; --blue: #60a5fa; --purple: #a78bfa; --yellow: #fbbf24;
    --red: #f87171;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    background: var(--bg); color: var(--text);
    padding: 2.5rem 2rem; line-height: 1.5; max-width: 1200px; margin: 0 auto;
  }
  code, .cmd-name { font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; }
  h1 { font-size: 1.4rem; font-weight: 600; color: var(--accent); margin-bottom: .2rem; }
  .sub { color: var(--text-dim); font-size: .78rem; margin-bottom: 1.5rem; }
  kbd { background: var(--surface2); border: 1px solid var(--border); border-radius: 3px; padding: .05rem .3rem; font-size: .7rem; font-family: inherit; }

  .top-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
  @media (max-width: 900px) { .top-grid { grid-template-columns: 1fr; } }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; overflow: hidden; }
  .card.full { grid-column: 1 / -1; }
  .card h2 { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); margin-bottom: .75rem; display: flex; align-items: center; gap: .5rem; }
  .card h2 .n { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: .05rem .35rem; font-size: .65rem; color: var(--accent); }

  .cmd-row, details.cmd-detail > summary { display: flex; align-items: baseline; padding: .35rem .25rem; gap: .75rem; border-bottom: 1px solid var(--border); font-size: .82rem; }
  .cmd-row:last-child, details.cmd-detail:last-child:not([open]) > summary { border-bottom: none; }
  .cmd-name { font-weight: 600; color: var(--green); white-space: nowrap; font-size: .8rem; flex-shrink: 0; }
  .cmd-desc { color: var(--text-dim); font-size: .75rem; text-align: right; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  details.cmd-detail { border-bottom: 1px solid var(--border); }
  details.cmd-detail:last-child { border-bottom: none; }
  details.cmd-detail > summary { cursor: pointer; list-style: none; border-radius: 4px; transition: background .1s; }
  details.cmd-detail[open] > summary, details.cmd-detail > summary:hover { background: var(--surface2); }
  details.cmd-detail > summary::-webkit-details-marker { display: none; }
  .detail-body { padding: .6rem .5rem .6rem 1rem; background: var(--surface2); border-radius: 0 0 6px 6px; margin-bottom: .15rem; }
  .detail-section { color: var(--blue); font-size: .72rem; font-weight: 600; margin-top: .35rem; }
  .detail-section:first-child { margin-top: 0; }
  .detail-step, .detail-key { font-size: .7rem; padding: .1rem 0 .1rem .9rem; position: relative; }
  .detail-step { color: var(--text); }
  .detail-step::before { content: "\\2192"; position: absolute; left: 0; color: var(--accent-dim); font-size: .65rem; }
  .detail-key { color: var(--yellow); }
  .detail-key::before { content: "\\2022"; position: absolute; left: .15rem; color: var(--accent-dim); }

  .label { color: var(--text-dim); font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin: .85rem 0 .35rem; }
  .label:first-child { margin-top: 0; }

  .agent-section { border-bottom: 1px solid var(--border); }
  .agent-section:last-child { border-bottom: none; }
  .agent-section > summary { cursor: pointer; list-style: none; display: flex; align-items: baseline; padding: .3rem .25rem; font-size: .78rem; font-weight: 500; color: var(--text); border-radius: 4px; transition: background .1s; }
  .agent-section > summary::-webkit-details-marker { display: none; }
  .agent-section > summary:hover, .agent-section[open] > summary { background: var(--surface2); }
  .agent-section[open] > summary { color: var(--blue); }
  .agent-section-preview { padding: .3rem .4rem .5rem 1rem; background: var(--surface2); border-radius: 0 0 4px 4px; margin-bottom: .1rem; }
  .agent-section-preview .line { color: var(--text-dim); font-size: .68rem; line-height: 1.5; padding: .05rem 0; }

  .chain { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; padding: .65rem .75rem; background: var(--surface2); border-radius: 6px; margin-top: .4rem; }
  .chain:first-child { margin-top: 0; }
  .chain-node { background: var(--surface); border: 1px solid var(--accent-dim); border-radius: 5px; padding: .25rem .55rem; font-size: .75rem; font-weight: 500; color: var(--accent); }
  .chain-arrow { color: var(--text-dim); font-size: .85rem; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: .65rem; margin-bottom: 1.5rem; }
  .stat { text-align: center; padding: .65rem .5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
  .stat b { display: block; font-size: 1.4rem; color: var(--accent); }
  .stat span { font-size: .6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: .06em; }
  .stat.coverage b { color: ${coveragePct >= 70 ? "var(--green)" : coveragePct >= 40 ? "var(--yellow)" : "var(--red)"}; }

  .search-bar { margin-bottom: 1rem; position: relative; }
  .search-bar input {
    width: 100%; padding: .6rem .9rem; padding-right: 4rem; font-size: .82rem;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text); outline: none; transition: border-color .15s; font-family: inherit;
  }
  .search-bar input::placeholder { color: var(--text-dim); }
  .search-bar input:focus { border-color: var(--accent-dim); }
  .search-hint { position: absolute; right: .75rem; top: 50%; transform: translateY(-50%); pointer-events: none; }

  .repo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; margin-bottom: 1.25rem; }
  @media (max-width: 1000px) { .repo-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 600px) { .repo-grid { grid-template-columns: 1fr; } }

  .repo-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    overflow: hidden; transition: border-color .15s;
  }
  .repo-card[open] { grid-column: 1 / -1; border-color: var(--accent-dim); }
  .repo-card > summary {
    cursor: pointer; list-style: none; padding: .85rem 1rem;
    display: flex; flex-direction: column; gap: .3rem;
  }
  .repo-card > summary::-webkit-details-marker { display: none; }
  .repo-card > summary:hover { background: var(--surface2); }
  .repo-header { display: flex; align-items: center; justify-content: space-between; }
  .repo-card .repo-name {
    font-size: .88rem; font-weight: 600; color: var(--text);
    display: flex; align-items: center; gap: .4rem;
  }
  .repo-card .repo-preview {
    font-size: .7rem; color: var(--text-dim); line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .repo-card .badges { display: flex; gap: .3rem; margin-top: .2rem; flex-wrap: wrap; }
  .badge {
    font-size: .58rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
    padding: .12rem .4rem; border-radius: 3px; border: 1px solid;
  }
  .badge.cmds { color: var(--green); border-color: #4ade8033; background: #4ade8010; }
  .badge.rules { color: var(--purple); border-color: #a78bfa33; background: #a78bfa10; }
  .badge.agent { color: var(--blue); border-color: #60a5fa33; background: #60a5fa10; }
  .badge.skills { color: var(--yellow); border-color: #fbbf2433; background: #fbbf2410; }
  .badge.source { font-size: .5rem; padding: .08rem .3rem; margin-left: .4rem; text-transform: none; letter-spacing: .02em; flex-shrink: 0; }
  .badge.source.superpowers { color: var(--purple); border-color: #a78bfa33; background: #a78bfa10; }
  .badge.source.skillssh { color: var(--blue); border-color: #60a5fa33; background: #60a5fa10; }
  .badge.source.custom { color: var(--text-dim); border-color: var(--border); background: var(--surface2); }
  .skill-name { color: var(--yellow) !important; }
  .skill-category { margin-top: .75rem; }
  .skill-category:first-child { margin-top: 0; }
  .skill-category-label { font-size: .6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); padding: .3rem 0; margin-bottom: .25rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: .4rem; }
  .skill-category-label .cat-n { font-size: .55rem; color: var(--accent-dim); }

  .health-bar { height: 4px; background: var(--surface2); border-radius: 2px; margin: .4rem 0 .5rem; position: relative; overflow: hidden; }
  .health-fill { height: 100%; border-radius: 2px; transition: width .3s; }
  .health-label { position: absolute; right: 0; top: -14px; font-size: .55rem; color: var(--text-dim); }
  .badge.stack { color: var(--accent); border-color: var(--accent-dim); background: rgba(196,149,106,.08); text-transform: none; }
  .drift { font-size: .58rem; margin-left: .4rem; font-weight: 600; }
  .drift-low { color: var(--text-dim); }
  .drift-medium { color: var(--yellow); }
  .drift-high { color: var(--red); }
  .quick-wins { display: flex; flex-wrap: wrap; gap: .3rem; margin-bottom: .5rem; }
  .quick-win { font-size: .6rem; padding: .15rem .4rem; border-radius: 3px; background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.2); color: var(--yellow); }
  .consolidation-hint { padding: .45rem .6rem; background: var(--surface2); border-radius: 6px; margin-top: .4rem; display: flex; align-items: baseline; gap: .5rem; }
  .consolidation-hint:first-child { margin-top: 0; }
  .consolidation-stack { font-size: .7rem; font-weight: 600; color: var(--accent); white-space: nowrap; }
  .consolidation-text { font-size: .7rem; color: var(--text-dim); }

  .unconfigured-item .stack-tag { font-size: .5rem; color: var(--accent-dim); margin-left: .3rem; }

  .freshness-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; }
  .freshness-dot.fresh { background: var(--green); }
  .freshness-dot.aging { background: var(--yellow); }
  .freshness-dot.stale { background: var(--red); }

  .repo-body { padding: 0 1rem 1rem; }
  .repo-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; padding-bottom: .4rem; border-bottom: 1px solid var(--border); }
  .repo-path { font-size: .68rem; color: var(--text-dim); font-family: 'SF Mono', monospace; }
  .freshness { font-size: .65rem; font-weight: 500; }
  .freshness.fresh { color: var(--green); }
  .freshness.aging { color: var(--yellow); }
  .freshness.stale { color: var(--red); }
  .repo-desc { color: var(--text-dim); font-size: .75rem; line-height: 1.45; margin-bottom: .75rem; padding-bottom: .6rem; border-bottom: 1px solid var(--border); }

  .unconfigured-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: .4rem; }
  @media (max-width: 900px) { .unconfigured-grid { grid-template-columns: repeat(2, 1fr); } }
  .unconfigured-item { font-size: .72rem; padding: .3rem .5rem; border-radius: 4px; background: var(--surface2); color: var(--text-dim); }
  .unconfigured-item .upath { font-size: .6rem; color: #555; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .suggestion-hints { display: flex; flex-wrap: wrap; gap: .2rem; margin-top: .25rem; }
  .suggestion-hint { font-size: .5rem; padding: .08rem .3rem; border-radius: 2px; background: rgba(96,165,250,.08); border: 1px solid rgba(96,165,250,.15); color: var(--blue); }

  .ts { text-align: center; color: var(--text-dim); font-size: .65rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); }
</style>
</head>
<body>
<h1>claude code dashboard</h1>
<p class="sub">generated ${timestamp} · run <code>claude-code-dashboard</code> to refresh · click to expand</p>

<div class="stats">
  <div class="stat coverage"><b>${coveragePct}%</b><span>Coverage (${configuredCount}/${totalRepos})</span></div>
  <div class="stat" style="${avgHealth >= 70 ? "border-color:#4ade8033" : avgHealth >= 40 ? "border-color:#fbbf2433" : "border-color:#f8717133"}"><b style="color:${healthScoreColor(avgHealth)}">${avgHealth}</b><span>Avg Health</span></div>
  <div class="stat"><b>${globalCmds.length}</b><span>Global Commands</span></div>
  <div class="stat"><b>${globalSkills.length}</b><span>Skills</span></div>
  <div class="stat"><b>${totalRepoCmds}</b><span>Repo Commands</span></div>
  ${driftCount > 0 ? `<div class="stat" style="border-color:#f8717133"><b style="color:var(--red)">${driftCount}</b><span>Drifting Repos</span></div>` : ""}
</div>

<div class="top-grid">
<div class="card">
  <h2>Global Commands <span class="n">${globalCmds.length}</span></h2>
  ${globalCmds.map((c) => renderCmd(c)).join("\n  ")}
</div>
<div class="card">
  <h2>Global Rules <span class="n">${globalRules.length}</span></h2>
  ${globalRules.map((r) => renderRule(r)).join("\n  ")}
</div>
${
  globalSkills.length
    ? (() => {
        const groups = groupSkillsByCategory(globalSkills);
        const categoryHtml = Object.entries(groups)
          .map(
            ([cat, skills]) =>
              `<div class="skill-category"><div class="skill-category-label">${esc(cat)} <span class="cat-n">${skills.length}</span></div>${skills.map((s) => renderSkill(s)).join("\n    ")}</div>`,
          )
          .join("\n  ");
        return `<div class="card full">
  <h2>Skills <span class="n">${globalSkills.length}</span></h2>
  ${categoryHtml}
</div>`;
      })()
    : ""
}
${
  chains.length
    ? `<div class="card full">
  <h2>Dependency Chains</h2>
  ${chains.map((c) => `<div class="chain">${c.nodes.map((n, i) => `<span class="chain-node">${esc(n.trim())}</span>${i < c.nodes.length - 1 ? `<span class="chain-arrow">${c.arrow}</span>` : ""}`).join("")}</div>`).join("\n  ")}
</div>`
    : ""
}
</div>

${
  consolidationGroups.length
    ? `<div class="card full" style="margin-bottom:1.25rem">
  <h2>Consolidation Opportunities <span class="n">${consolidationGroups.length}</span></h2>
  ${consolidationGroups.map((g) => `<div class="consolidation-hint"><span class="consolidation-stack">${esc(g.stack)}</span> <span class="consolidation-text">${esc(g.suggestion)}</span></div>`).join("\n  ")}
</div>`
    : ""
}

<div class="search-bar">
  <input type="text" id="search" placeholder="search repos..." autocomplete="off">
  <span class="search-hint"><kbd>/</kbd></span>
</div>

<div class="repo-grid" id="repo-grid">
${configured.map((r) => renderRepoCard(r)).join("\n")}
</div>

${
  unconfigured.length
    ? `<details class="card" style="margin-bottom:1.25rem">
  <summary style="cursor:pointer;list-style:none"><h2 style="margin:0">Unconfigured Repos <span class="n">${unconfiguredCount}</span></h2></summary>
  <div style="margin-top:.75rem">
    <div class="unconfigured-grid">
      ${unconfigured
        .map((r) => {
          const stackTag =
            r.techStack && r.techStack.length
              ? `<span class="stack-tag">${esc(r.techStack.join(", "))}</span>`
              : "";
          const suggestionsHtml =
            r.suggestions && r.suggestions.length
              ? `<div class="suggestion-hints">${r.suggestions.map((s) => `<span class="suggestion-hint">${esc(s)}</span>`).join("")}</div>`
              : "";
          return `<div class="unconfigured-item">${esc(r.name)}${stackTag}<span class="upath">${esc(r.shortPath)}</span>${suggestionsHtml}</div>`;
        })
        .join("\n      ")}
    </div>
  </div>
</details>`
    : ""
}

<div class="ts">found ${totalRepos} repos · ${configuredCount} configured · ${unconfiguredCount} unconfigured · scanned ${scanScope} · ${timestamp}</div>

<script>
const input = document.getElementById('search');
const hint = document.querySelector('.search-hint');

input.addEventListener('input', function(e) {
  const q = e.target.value.toLowerCase();
  hint.style.display = q ? 'none' : '';
  document.querySelectorAll('.repo-card').forEach(function(card) {
    const name = card.dataset.name.toLowerCase();
    const path = (card.dataset.path || '').toLowerCase();
    const text = card.textContent.toLowerCase();
    card.style.display = (q === '' || name.includes(q) || path.includes(q) || text.includes(q)) ? '' : 'none';
  });
});

document.addEventListener('keydown', function(e) {
  if (e.key === '/' && document.activeElement !== input) {
    e.preventDefault();
    input.focus();
  }
  if (e.key === 'Escape' && document.activeElement === input) {
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.blur();
  }
});
</script>
</body>
</html>`;

// ── Write HTML Output ───────────────────────────────────────────────────────

const outputPath = cliArgs.output;
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);
console.log(outputPath);

if (cliArgs.open) {
  // Cross-platform open
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  execFile(cmd, [outputPath]);
}
