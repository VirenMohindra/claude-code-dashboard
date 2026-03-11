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

import { VERSION, HOME, CLAUDE_DIR, DEFAULT_OUTPUT, CONF, MAX_DEPTH, REPO_URL } from "./src/constants.mjs";
import { parseArgs, generateCompletions } from "./src/cli.mjs";
import { shortPath } from "./src/helpers.mjs";
import { anonymizeAll } from "./src/anonymize.mjs";
import { generateDemoData } from "./src/demo.mjs";
import { findGitRepos, getScanRoots } from "./src/discovery.mjs";
import { extractProjectDesc, extractSections, scanMdDir } from "./src/markdown.mjs";
import { scanSkillsDir, groupSkillsByCategory } from "./src/skills.mjs";
import {
  computeHealthScore,
  detectTechStack,
  computeDrift,
  findExemplar,
  generateSuggestions,
  detectConfigPattern,
  computeConfigSimilarity,
  matchSkillsToRepo,
  lintConfig,
  computeDashboardDiff,
} from "./src/analysis.mjs";
import { getFreshness, relativeTime, freshnessClass } from "./src/freshness.mjs";
import {
  parseUserMcpConfig,
  parseProjectMcpConfig,
  findPromotionCandidates,
  scanHistoricalMcpServers,
  classifyHistoricalServers,
} from "./src/mcp.mjs";
import { aggregateSessionMeta } from "./src/usage.mjs";
import { handleInit } from "./src/templates.mjs";
import { generateCatalogHtml } from "./src/render.mjs";
import { generateDashboardHtml } from "./src/html-template.mjs";
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

// Compute suggestions for unconfigured repos
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
    .filter((r) => r.similarity >= 25)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 2);
  repo.similarRepos = similar;
  repo.matchedSkills = matchSkillsToRepo(repo, globalSkills);
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

// MCP Server Discovery
const allMcpServers = [];

const userMcpPath = join(CLAUDE_DIR, "mcp_config.json");
if (existsSync(userMcpPath)) {
  try {
    const content = readFileSync(userMcpPath, "utf8");
    allMcpServers.push(...parseUserMcpConfig(content));
  } catch {
    // skip if unreadable
  }
}

for (const repoDir of allRepoPaths) {
  const mcpPath = join(repoDir, ".mcp.json");
  if (existsSync(mcpPath)) {
    try {
      const content = readFileSync(mcpPath, "utf8");
      const servers = parseProjectMcpConfig(content, shortPath(repoDir));
      allMcpServers.push(...servers);
      const repo =
        configured.find((r) => r.path === repoDir) || unconfigured.find((r) => r.path === repoDir);
      if (repo) repo.mcpServers = servers;
    } catch {
      // skip if unreadable
    }
  }
}

// Disabled MCP servers
const disabledMcpByRepo = {};
const claudeJsonPath = join(HOME, ".claude.json");
if (existsSync(claudeJsonPath)) {
  try {
    const claudeJsonContent = readFileSync(claudeJsonPath, "utf8");
    const claudeJson = JSON.parse(claudeJsonContent);
    for (const [path, entry] of Object.entries(claudeJson)) {
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

const mcpPromotions = findPromotionCandidates(allMcpServers);

const disabledByServer = {};
for (const [, names] of Object.entries(disabledMcpByRepo)) {
  for (const name of names) {
    disabledByServer[name] = (disabledByServer[name] || 0) + 1;
  }
}

const mcpByName = {};
for (const s of allMcpServers) {
  if (!mcpByName[s.name])
    mcpByName[s.name] = {
      name: s.name,
      type: s.type,
      projects: [],
      userLevel: false,
      disabledIn: 0,
    };
  if (s.scope === "user") mcpByName[s.name].userLevel = true;
  if (s.scope === "project") mcpByName[s.name].projects.push(s.source);
}
for (const entry of Object.values(mcpByName)) {
  entry.disabledIn = disabledByServer[entry.name] || 0;
}

const historicalMcpMap = scanHistoricalMcpServers(CLAUDE_DIR);
const currentMcpNames = new Set(allMcpServers.map((s) => s.name));
const { recent: recentMcpServers, former: formerMcpServers } = classifyHistoricalServers(
  historicalMcpMap,
  currentMcpNames,
);

// Shorten project paths in former servers
for (const server of formerMcpServers) {
  server.projects = server.projects.map((p) => shortPath(p));
}

// Merge recently-seen servers into allMcpServers so they show up as current
for (const server of recentMcpServers) {
  if (!mcpByName[server.name]) {
    mcpByName[server.name] = {
      name: server.name,
      type: "unknown",
      projects: server.projects.map((p) => shortPath(p)),
      userLevel: false,
      disabledIn: disabledByServer[server.name] || 0,
      recentlyActive: true,
    };
  }
}
const mcpSummary = Object.values(mcpByName).sort((a, b) => {
  if (a.userLevel !== b.userLevel) return a.userLevel ? -1 : 1;
  return a.name.localeCompare(b.name);
});
const mcpCount = mcpSummary.length;

// ── Usage Analytics ──────────────────────────────────────────────────────────

const SESSION_META_LIMIT = 500;
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
const usageAnalytics = aggregateSessionMeta(sessionMetaFiles);

// ccusage integration
let ccusageData = null;
const ccusageCachePath = join(CLAUDE_DIR, "ccusage-cache.json");
const CCUSAGE_TTL_MS = 60 * 60 * 1000;

if (!cliArgs.quiet) {
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

// Supplement dailyActivity with session-meta data
if (sessionMetaFiles.length > 0) {
  const existingDates = new Set((statsCache.dailyActivity || []).map((d) => d.date));
  const sessionDayCounts = {};
  for (const s of sessionMetaFiles) {
    const date = (s.start_time || "").slice(0, 10);
    if (!date || existingDates.has(date)) continue;
    sessionDayCounts[date] =
      (sessionDayCounts[date] || 0) +
      (s.user_message_count || 0) +
      (s.assistant_message_count || 0);
  }
  const supplemental = Object.entries(sessionDayCounts).map(([date, messageCount]) => ({
    date,
    messageCount,
  }));
  if (supplemental.length > 0) {
    statsCache.dailyActivity = [...(statsCache.dailyActivity || []), ...supplemental].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }
}

// ── Computed Stats ───────────────────────────────────────────────────────────

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

// ── Lint Subcommand ──────────────────────────────────────────────────────────

if (cliArgs.command === "lint") {
  let totalIssues = 0;
  for (const repo of configured) {
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
    configuredRepos: configured.map((r) => ({ name: r.name, healthScore: r.healthScore || 0 })),
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
    configured,
    unconfigured,
    globalCmds,
    globalRules,
    globalSkills,
    chains,
    mcpSummary,
    mcpPromotions,
    formerMcpServers,
    consolidationGroups,
  });
}

// ── JSON Output ──────────────────────────────────────────────────────────────

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
      mcpServers: mcpCount,
      ...(ccusageData
        ? {
            totalCost: ccusageData.totals.totalCost,
            totalTokens: ccusageData.totals.totalTokens,
          }
        : {}),
      errorCategories: usageAnalytics.errorCategories,
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
      matchedSkills: r.matchedSkills || [],
      similarRepos: r.similarRepos || [],
      mcpServers: r.mcpServers || [],
    })),
    consolidationGroups,
    unconfiguredRepos: unconfigured.map((r) => ({
      name: r.name,
      path: r.shortPath,
      techStack: r.techStack || [],
      suggestions: r.suggestions || [],
      exemplar: r.exemplarName || "",
      mcpServers: r.mcpServers || [],
    })),
    mcpServers: mcpSummary,
    mcpPromotions,
    formerMcpServers,
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
  const groups = groupSkillsByCategory(globalSkills);
  const catalogHtml = generateCatalogHtml(groups, globalSkills.length, timestamp);
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

const html = generateDashboardHtml({
  configured,
  unconfigured,
  globalCmds,
  globalRules,
  globalSkills,
  chains,
  mcpSummary,
  mcpPromotions,
  formerMcpServers,
  consolidationGroups,
  usageAnalytics,
  ccusageData,
  statsCache,
  timestamp,
  coveragePct,
  totalRepos,
  configuredCount,
  unconfiguredCount,
  totalRepoCmds,
  avgHealth,
  driftCount,
  mcpCount,
  scanScope,
});

// ── Write HTML Output ────────────────────────────────────────────────────────

const outputPath = cliArgs.output;
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);

if (!cliArgs.quiet) {
  const sp = shortPath(outputPath);
  console.log(`\n  claude-code-dashboard v${VERSION}\n`);
  console.log(`  ${configuredCount} configured · ${unconfiguredCount} unconfigured · ${totalRepos} repos`);
  console.log(`  ${globalCmds.length} global commands · ${globalSkills.length} skills · ${mcpCount} MCP servers`);
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
  startWatch(outputPath, scanRoots, cliArgs);
}
