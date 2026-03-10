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
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, basename, dirname } from "path";
import { homedir } from "os";

// ── Constants ────────────────────────────────────────────────────────────────

const VERSION = "0.1.0";

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
  const args = { output: DEFAULT_OUTPUT, open: false };
  let i = 2; // skip node + script
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
  --open               Open the dashboard in your default browser after generating
  --version, -v        Show version
  --help, -h           Show this help

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
      case "--open":
        args.open = true;
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

function getDesc(filepath) {
  let lines;
  try {
    lines = readFileSync(filepath, "utf8").split("\n");
  } catch {
    return "";
  }

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

  if (hasConfig) {
    repo.freshness = getFreshness(repoDir);
    repo.freshnessText = relativeTime(repo.freshness);
    repo.freshnessClass = freshnessClass(repo.freshness);
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

function renderBadges(repo) {
  const b = [];
  if (repo.commands.length) b.push(`<span class="badge cmds">${repo.commands.length} cmd</span>`);
  if (repo.rules.length) b.push(`<span class="badge rules">${repo.rules.length} rules</span>`);
  if (repo.sections.length)
    b.push(`<span class="badge agent">${repo.sections.length} sections</span>`);
  return b.join("");
}

function renderRepoCard(repo) {
  const badges = renderBadges(repo);
  const preview = repo.desc[0] ? esc(repo.desc[0].slice(0, 120)) : "";

  let body = "";

  body += `<div class="repo-meta"><span class="repo-path">${esc(repo.shortPath)}</span>`;
  body += `<span class="freshness ${repo.freshnessClass}">${esc(repo.freshnessText)}</span></div>`;

  if (repo.desc.length) {
    body += `<div class="repo-desc">${repo.desc.map((l) => esc(l)).join("<br>")}</div>`;
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

  return `<details class="repo-card" data-name="${esc(repo.name)}" data-path="${esc(repo.shortPath)}">
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

const now = new Date();
const timestamp =
  now
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toLowerCase() +
  " at " +
  now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();

const scanScope = existsSync(CONF) ? `config: ${shortPath(CONF)}` : "~/ (depth 5)";

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
  .unconfigured-item { font-size: .72rem; padding: .3rem .5rem; border-radius: 4px; background: var(--surface2); color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .unconfigured-item .upath { font-size: .6rem; color: #555; display: block; overflow: hidden; text-overflow: ellipsis; }

  .ts { text-align: center; color: var(--text-dim); font-size: .65rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); }
</style>
</head>
<body>
<h1>claude code dashboard</h1>
<p class="sub">generated ${timestamp} · run <code>claude-code-dashboard</code> to refresh · click to expand</p>

<div class="stats">
  <div class="stat coverage"><b>${coveragePct}%</b><span>Coverage (${configuredCount}/${totalRepos})</span></div>
  <div class="stat"><b>${globalCmds.length}</b><span>Global Commands</span></div>
  <div class="stat"><b>${globalRules.length}</b><span>Global Rules</span></div>
  <div class="stat"><b>${totalRepoCmds}</b><span>Repo Commands</span></div>
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
  chains.length
    ? `<div class="card full">
  <h2>Dependency Chains</h2>
  ${chains.map((c) => `<div class="chain">${c.nodes.map((n, i) => `<span class="chain-node">${esc(n.trim())}</span>${i < c.nodes.length - 1 ? `<span class="chain-arrow">${c.arrow}</span>` : ""}`).join("")}</div>`).join("\n  ")}
</div>`
    : ""
}
</div>

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
      ${unconfigured.map((r) => `<div class="unconfigured-item">${esc(r.name)}<span class="upath">${esc(r.shortPath)}</span></div>`).join("\n      ")}
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

// ── Write Output ─────────────────────────────────────────────────────────────

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
