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
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { join, basename, dirname } from "path";

import {
  VERSION,
  HOME,
  CLAUDE_DIR,
  DEFAULT_OUTPUT,
  CONF,
  MAX_DEPTH,
  REPO_URL,
} from "./src/constants.mjs";
import { parseArgs, generateCompletions } from "./src/cli.mjs";
import { shortPath, gitCmd } from "./src/helpers.mjs";
import { anonymizeAll } from "./src/anonymize.mjs";
import { generateDemoData } from "./src/demo.mjs";
import { findGitRepos, getScanRoots } from "./src/discovery.mjs";
import { extractProjectDesc, extractSections, scanMdDir } from "./src/markdown.mjs";
import { scanSkillsDir, groupSkillsByCategory } from "./src/skills.mjs";
import {
  detectTechStack,
  lintConfig,
  computeDashboardDiff,
} from "./src/analysis.mjs";
import { getFreshness } from "./src/freshness.mjs";
import {
  parseUserMcpConfig,
  parseProjectMcpConfig,
  scanHistoricalMcpServers,
} from "./src/mcp.mjs";
import { handleInit } from "./src/templates.mjs";
import { generateCatalogHtml } from "./src/render.mjs";
import { generateDashboardHtml } from "./src/assembler.mjs";
import { buildDashboardData } from "./src/pipeline.mjs";
import { startWatch } from "./src/watch.mjs";

// ── CLI ──────────────────────────────────────────────────────────────────────

const cliArgs = parseArgs(process.argv);

if (cliArgs.completions) generateCompletions();
if (cliArgs.command === "init") handleInit(cliArgs);

// ── Demo Mode ────────────────────────────────────────────────────────────────

if (cliArgs.demo) {
  const demoData = generateDemoData();
  const html = generateDashboardHtml(demoData);

  const outputPath = cliArgs.output;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html);

  if (!cliArgs.quiet) {
    const sp = shortPath(outputPath);
    console.log(`\n  claude-code-dashboard v${VERSION} (demo mode)\n`);
    console.log(`  ✓ ${sp}`);
    if (cliArgs.open) console.log(`  ✓ opening in browser`);
    console.log(`\n  ${REPO_URL}`);
    console.log();
  }

  if (cliArgs.open) {
    const cmd =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    execFile(cmd, [outputPath]);
  }
  process.exit(0);
}

// ── Collect Raw Inputs ────────────────────────────────────────────────────────

function collectRawInputs() {
  const scanRoots = getScanRoots();
  const allRepoPaths = findGitRepos(scanRoots, MAX_DEPTH);

  // Global config
  const globalCmds = scanMdDir(join(CLAUDE_DIR, "commands"));
  const globalRules = scanMdDir(join(CLAUDE_DIR, "rules"));
  const globalSkills = scanSkillsDir(join(CLAUDE_DIR, "skills"));

  // Repo discovery and scanning
  const repos = [];
  for (const repoDir of allRepoPaths) {
    const name = basename(repoDir);
    const commands = scanMdDir(join(repoDir, ".claude", "commands"));
    const rules = scanMdDir(join(repoDir, ".claude", "rules"));

    // AGENTS.md / CLAUDE.md
    let agentsFile = null;
    if (existsSync(join(repoDir, "AGENTS.md"))) agentsFile = join(repoDir, "AGENTS.md");
    else if (existsSync(join(repoDir, "CLAUDE.md"))) agentsFile = join(repoDir, "CLAUDE.md");

    const desc = agentsFile ? extractProjectDesc(agentsFile) : [];
    const sections = agentsFile ? extractSections(agentsFile) : [];

    const stackInfo = detectTechStack(repoDir);
    const hasConfig = commands.length > 0 || rules.length > 0 || agentsFile;
    const freshness = hasConfig ? getFreshness(repoDir) : 0;

    // Compute gitRevCount for configured repos (used by pipeline for drift)
    let gitRevCount = null;
    if (hasConfig && freshness) {
      const countStr = gitCmd(repoDir, "rev-list", "--count", `--since=${freshness}`, "HEAD");
      if (countStr) {
        const parsed = Number(countStr);
        if (Number.isFinite(parsed)) {
          gitRevCount = Math.max(0, parsed - 1);
        }
      }
    }

    repos.push({
      name,
      path: repoDir,
      shortPath: shortPath(repoDir),
      commands,
      rules,
      agentsFile: agentsFile ? agentsFile : null,
      desc,
      sections,
      techStack: stackInfo.stacks,
      freshness,
      gitRevCount,
    });
  }

  // Dependency chains from config
  const chains = [];
  if (existsSync(CONF)) {
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
  }

  // MCP Server Discovery
  const claudeJsonPath = join(HOME, ".claude.json");
  const userMcpServers = [];

  const userMcpPath = join(CLAUDE_DIR, "mcp_config.json");
  if (existsSync(userMcpPath)) {
    try {
      const content = readFileSync(userMcpPath, "utf8");
      userMcpServers.push(...parseUserMcpConfig(content));
    } catch {
      // skip if unreadable
    }
  }

  // ~/.claude.json is the primary location where `claude mcp add` writes
  let claudeJsonParsed = null;
  if (existsSync(claudeJsonPath)) {
    try {
      const content = readFileSync(claudeJsonPath, "utf8");
      claudeJsonParsed = JSON.parse(content);
      const existing = new Set(userMcpServers.filter((s) => s.scope === "user").map((s) => s.name));
      for (const s of parseUserMcpConfig(content)) {
        if (!existing.has(s.name)) userMcpServers.push(s);
      }
    } catch {
      // skip if unreadable
    }
  }

  // Project MCP servers
  const projectMcpByRepo = {};
  for (const repoDir of allRepoPaths) {
    const mcpPath = join(repoDir, ".mcp.json");
    if (existsSync(mcpPath)) {
      try {
        const content = readFileSync(mcpPath, "utf8");
        const servers = parseProjectMcpConfig(content, shortPath(repoDir));
        projectMcpByRepo[repoDir] = servers;
      } catch {
        // skip if unreadable
      }
    }
  }

  // Disabled MCP servers
  const disabledMcpByRepo = {};
  if (claudeJsonParsed) {
    try {
      for (const [path, entry] of Object.entries(claudeJsonParsed)) {
        if (
          typeof entry === "object" &&
          entry !== null &&
          Array.isArray(entry.disabledMcpServers) &&
          entry.disabledMcpServers.length > 0
        ) {
          disabledMcpByRepo[path] = entry.disabledMcpServers;
        }
      }
    } catch {
      // skip if parse fails
    }
  }

  // Historical MCP servers
  const historicalMcpMap = scanHistoricalMcpServers(CLAUDE_DIR);

  // Usage data — session meta files
  const SESSION_META_LIMIT = 1000;
  const sessionMetaDir = join(CLAUDE_DIR, "usage-data", "session-meta");
  const sessionMetaFiles = [];
  if (existsSync(sessionMetaDir)) {
    try {
      const files = readdirSync(sessionMetaDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .slice(-SESSION_META_LIMIT);
      for (const f of files) {
        try {
          const content = readFileSync(join(sessionMetaDir, f), "utf8");
          sessionMetaFiles.push(JSON.parse(content));
        } catch {
          // skip unparseable files
        }
      }
    } catch {
      // skip if directory unreadable
    }
  }

  // ccusage integration
  let ccusageData = null;
  const ccusageCachePath = join(CLAUDE_DIR, "ccusage-cache.json");
  const CCUSAGE_TTL_MS = 60 * 60 * 1000;

  try {
    const cached = JSON.parse(readFileSync(ccusageCachePath, "utf8"));
    if (cached._ts && Date.now() - cached._ts < CCUSAGE_TTL_MS && cached.totals && cached.daily) {
      ccusageData = cached;
    }
  } catch {
    /* no cache or stale */
  }

  if (!ccusageData) {
    try {
      const raw = execFileSync("npx", ["ccusage", "--json"], {
        encoding: "utf8",
        timeout: 30_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const parsed = JSON.parse(raw);
      if (parsed.totals && parsed.daily) {
        ccusageData = parsed;
        try {
          writeFileSync(ccusageCachePath, JSON.stringify({ ...parsed, _ts: Date.now() }));
        } catch {
          /* non-critical */
        }
      }
    } catch {
      // ccusage not installed or timed out
    }
  }

  // Claude Code Insights report — read raw HTML, pipeline parses it
  let insightsReportHtml = null;
  const reportPath = join(CLAUDE_DIR, "usage-data", "report.html");
  if (existsSync(reportPath)) {
    try {
      insightsReportHtml = readFileSync(reportPath, "utf8");
    } catch {
      // skip if unreadable
    }
  }

  // Stats cache
  const statsCachePath = join(CLAUDE_DIR, "stats-cache.json");
  let statsCache = {};
  if (existsSync(statsCachePath)) {
    try {
      statsCache = JSON.parse(readFileSync(statsCachePath, "utf8"));
    } catch {
      // skip if parse fails
    }
  }

  // Scan scope
  const scanScope = existsSync(CONF) ? `config: ${shortPath(CONF)}` : "~/ (depth 5)";

  return {
    repos,
    globalCmds,
    globalRules,
    globalSkills,
    userMcpServers,
    projectMcpByRepo,
    disabledMcpByRepo,
    historicalMcpMap,
    sessionMetaFiles,
    ccusageData,
    statsCache,
    insightsReportHtml,
    chains,
    scanScope,
    _reportPath: reportPath,
  };
}

// ── Build Dashboard Data ─────────────────────────────────────────────────────

const rawInputs = collectRawInputs();
const data = buildDashboardData(rawInputs);

// Set the insightsReport filePath (pipeline returns null, we have the real path)
if (data.insightsReport) {
  data.insightsReport.filePath = rawInputs._reportPath;
}

// ── Lint Subcommand ──────────────────────────────────────────────────────────

if (cliArgs.command === "lint") {
  let totalIssues = 0;
  for (const repo of data.configured) {
    const issues = lintConfig(repo);
    if (issues.length === 0) continue;
    if (!cliArgs.quiet) console.log(`\n${repo.name} (${repo.shortPath}):`);
    for (const issue of issues) {
      if (!cliArgs.quiet)
        console.log(`  ${issue.level === "warn" ? "WARN" : "INFO"}: ${issue.message}`);
      totalIssues++;
    }
  }
  if (!cliArgs.quiet) {
    if (totalIssues === 0) console.log("No config issues found.");
    else console.log(`\n${totalIssues} issue(s) found.`);
  }
  process.exit(totalIssues > 0 ? 1 : 0);
}

// ── Dashboard Diff ───────────────────────────────────────────────────────────

const SNAPSHOT_PATH = join(CLAUDE_DIR, "dashboard-snapshot.json");
if (cliArgs.diff) {
  const currentSnapshot = {
    configuredRepos: data.configured.map((r) => ({ name: r.name, healthScore: r.healthScore || 0 })),
  };
  if (existsSync(SNAPSHOT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
      const diff = computeDashboardDiff(prev, currentSnapshot);
      if (!cliArgs.quiet) {
        console.log("Dashboard diff since last generation:");
        if (diff.added.length) console.log(`  Added: ${diff.added.join(", ")}`);
        if (diff.removed.length) console.log(`  Removed: ${diff.removed.join(", ")}`);
        for (const c of diff.changed) console.log(`  ${c.name}: ${c.field} ${c.from} -> ${c.to}`);
        if (!diff.added.length && !diff.removed.length && !diff.changed.length)
          console.log("  No changes.");
      }
    } catch {
      if (!cliArgs.quiet) console.log("Previous snapshot unreadable, saving new baseline.");
    }
  } else {
    if (!cliArgs.quiet) console.log("No previous snapshot found, saving baseline.");
  }
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(currentSnapshot, null, 2));
}

// ── Anonymize ────────────────────────────────────────────────────────────────

if (cliArgs.anonymize) {
  anonymizeAll({
    configured: data.configured,
    unconfigured: data.unconfigured,
    globalCmds: data.globalCmds,
    globalRules: data.globalRules,
    globalSkills: data.globalSkills,
    chains: data.chains,
    mcpSummary: data.mcpSummary,
    mcpPromotions: data.mcpPromotions,
    formerMcpServers: data.formerMcpServers,
    consolidationGroups: data.consolidationGroups,
  });
}

// ── JSON Output ──────────────────────────────────────────────────────────────

if (cliArgs.json) {
  const now = new Date();
  const jsonData = {
    version: VERSION,
    generatedAt: now.toISOString(),
    scanScope: data.scanScope,
    stats: {
      totalRepos: data.totalRepos,
      configuredRepos: data.configuredCount,
      unconfiguredRepos: data.unconfiguredCount,
      coveragePct: data.coveragePct,
      globalCommands: data.globalCmds.length,
      globalRules: data.globalRules.length,
      skills: data.globalSkills.length,
      repoCommands: data.totalRepoCmds,
      avgHealthScore: data.avgHealth,
      driftingRepos: data.driftCount,
      mcpServers: data.mcpCount,
      ...(data.ccusageData
        ? {
            totalCost: data.ccusageData.totals.totalCost,
            totalTokens: data.ccusageData.totals.totalTokens,
          }
        : {}),
      errorCategories: data.usageAnalytics.errorCategories,
    },
    globalCommands: data.globalCmds.map((c) => ({ name: c.name, description: c.desc })),
    globalRules: data.globalRules.map((r) => ({ name: r.name, description: r.desc })),
    skills: data.globalSkills.map((s) => ({
      name: s.name,
      description: s.desc,
      source: s.source,
      category: s.category,
    })),
    chains: data.chains.map((c) => ({
      nodes: c.nodes.map((n) => n.trim()),
      direction: c.arrow === "&rarr;" ? "forward" : "backward",
    })),
    configuredRepos: data.configured.map((r) => ({
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
      matchedSkills: r.matchedSkills || [],
      similarRepos: r.similarRepos || [],
      mcpServers: r.mcpServers || [],
    })),
    consolidationGroups: data.consolidationGroups,
    unconfiguredRepos: data.unconfigured.map((r) => ({
      name: r.name,
      path: r.shortPath,
      techStack: r.techStack || [],
      suggestions: r.suggestions || [],
      exemplar: r.exemplarName || "",
      mcpServers: r.mcpServers || [],
    })),
    mcpServers: data.mcpSummary,
    mcpPromotions: data.mcpPromotions,
    formerMcpServers: data.formerMcpServers,
  };

  const jsonOutput = JSON.stringify(jsonData, null, 2);

  if (cliArgs.output !== DEFAULT_OUTPUT) {
    mkdirSync(dirname(cliArgs.output), { recursive: true });
    writeFileSync(cliArgs.output, jsonOutput);
    if (!cliArgs.quiet) console.log(cliArgs.output);
  } else {
    process.stdout.write(jsonOutput + "\n");
  }
  process.exit(0);
}

// ── Catalog Output ───────────────────────────────────────────────────────────

if (cliArgs.catalog) {
  const groups = groupSkillsByCategory(data.globalSkills);
  const catalogHtml = generateCatalogHtml(groups, data.globalSkills.length, data.timestamp);
  const outputPath =
    cliArgs.output !== DEFAULT_OUTPUT ? cliArgs.output : join(CLAUDE_DIR, "skill-catalog.html");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, catalogHtml);
  if (!cliArgs.quiet) console.log(outputPath);
  if (cliArgs.open) {
    const cmd =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    execFile(cmd, [outputPath]);
  }
  process.exit(0);
}

// ── Generate HTML Dashboard ──────────────────────────────────────────────────

const html = generateDashboardHtml(data);

// ── Write HTML Output ────────────────────────────────────────────────────────

const outputPath = cliArgs.output;
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);

if (!cliArgs.quiet) {
  const sp = shortPath(outputPath);
  console.log(`\n  claude-code-dashboard v${VERSION}\n`);
  console.log(
    `  ${data.configuredCount} configured · ${data.unconfiguredCount} unconfigured · ${data.totalRepos} repos`,
  );
  console.log(
    `  ${data.globalCmds.length} global commands · ${data.globalSkills.length} skills · ${data.mcpCount} MCP servers`,
  );
  console.log(`\n  ✓ ${sp}`);
  if (cliArgs.open) console.log(`  ✓ opening in browser`);
  console.log(`\n  ${REPO_URL}`);
  console.log();
}

if (cliArgs.open) {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  execFile(cmd, [outputPath]);
}

// ── Watch Mode ───────────────────────────────────────────────────────────────

if (cliArgs.watch) {
  startWatch(outputPath, getScanRoots(), cliArgs);
}
