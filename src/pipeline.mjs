/**
 * Pure processing pipeline — transforms raw scan data into the shape
 * that generateDashboardHtml() expects.
 *
 * NO filesystem I/O, NO git commands, NO process.exit.
 * All data comes in via the `raw` parameter.
 */

import { SIMILARITY_THRESHOLD, MCP_STACK_HINTS } from "./constants.mjs";
import { relativeTime, freshnessClass } from "./freshness.mjs";
import {
  computeHealthScore,
  classifyDrift,
  detectConfigPattern,
  findExemplar,
  generateSuggestions,
  computeConfigSimilarity,
  matchSkillsToRepo,
} from "./analysis.mjs";
import { findPromotionCandidates, classifyHistoricalServers } from "./mcp.mjs";
import { aggregateSessionMeta } from "./usage.mjs";

/**
 * Build the complete dashboard data object from raw scan inputs.
 *
 * @param {object} raw - All I/O data collected before this function is called.
 * @returns {object} Data object ready for generateDashboardHtml().
 */
export function buildDashboardData(raw) {
  // ── 1. Repo Classification ──────────────────────────────────────────────

  const configured = [];
  const unconfigured = [];
  const seenNames = new Map();

  for (const repo of raw.repos) {
    // Collision-safe display key
    const count = (seenNames.get(repo.name) || 0) + 1;
    seenNames.set(repo.name, count);
    const key = count > 1 ? `${repo.name}__${count}` : repo.name;

    const entry = {
      key,
      name: repo.name,
      path: repo.path,
      shortPath: repo.shortPath,
      commands: repo.commands || [],
      rules: repo.rules || [],
      desc: repo.desc || [],
      sections: repo.sections || [],
      freshness: repo.freshness || 0,
      freshnessText: "",
      freshnessClass: "stale",
      techStack: repo.techStack || [],
    };

    const hasConfig = entry.commands.length > 0 || entry.rules.length > 0 || repo.agentsFile;

    if (hasConfig) {
      entry.freshnessText = relativeTime(entry.freshness);
      entry.freshnessClass = freshnessClass(entry.freshness);

      // Health score
      const health = computeHealthScore({
        hasAgentsFile: !!repo.agentsFile,
        desc: entry.desc,
        commandCount: entry.commands.length,
        ruleCount: entry.rules.length,
        sectionCount: entry.sections.length,
        freshnessClass: entry.freshnessClass,
      });
      entry.healthScore = health.score;
      entry.healthReasons = health.reasons;
      entry.hasAgentsFile = !!repo.agentsFile;
      entry.configPattern = detectConfigPattern(entry);

      // Drift classification from pre-computed gitRevCount (no git I/O)
      entry.drift = classifyDrift(repo.gitRevCount);

      configured.push(entry);
    } else {
      unconfigured.push(entry);
    }
  }

  // Sort configured by richness (most config first)
  configured.sort((a, b) => {
    const score = (r) =>
      r.commands.length * 3 + r.rules.length * 2 + r.sections.length + (r.desc.length > 0 ? 1 : 0);
    return score(b) - score(a);
  });

  unconfigured.sort((a, b) => a.name.localeCompare(b.name));

  // ── 2. Cross-Repo Analysis ────────────────────────────────────────────

  // Suggestions for unconfigured repos
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

  // Similar repos + matched skills for configured repos
  for (const repo of configured) {
    const similar = configured
      .filter((r) => r !== repo)
      .map((r) => ({
        name: r.name,
        similarity: computeConfigSimilarity(repo, r),
      }))
      .filter((r) => r.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 2);
    repo.similarRepos = similar;
    repo.matchedSkills = matchSkillsToRepo(repo, raw.globalSkills);
  }

  // Consolidation groups
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

  // ── 3. MCP Aggregation ────────────────────────────────────────────────

  const allMcpServers = [...(raw.userMcpServers || [])];

  // Add project MCP servers and attach to matching repos
  for (const [repoPath, servers] of Object.entries(raw.projectMcpByRepo || {})) {
    allMcpServers.push(...servers);
    const repo =
      configured.find((r) => r.path === repoPath) || unconfigured.find((r) => r.path === repoPath);
    if (repo) repo.mcpServers = servers;
  }

  const mcpPromotions = findPromotionCandidates(allMcpServers);

  // Build disabled-by-server counts
  const disabledByServer = {};
  for (const [, names] of Object.entries(raw.disabledMcpByRepo || {})) {
    for (const name of names) {
      disabledByServer[name] = (disabledByServer[name] || 0) + 1;
    }
  }

  // Build mcpByName map
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

  // Historical MCP servers
  const currentMcpNames = new Set(allMcpServers.map((s) => s.name));
  const { recent: recentMcpServers, former: formerMcpServers } = classifyHistoricalServers(
    raw.historicalMcpMap || new Map(),
    currentMcpNames,
  );

  // Historical project paths are already normalized by the caller (collectRawInputs
  // applies shortPath on the I/O side, demo data uses short paths directly).

  // Merge recently-seen servers into mcpByName
  for (const server of recentMcpServers) {
    if (!mcpByName[server.name]) {
      mcpByName[server.name] = {
        name: server.name,
        type: "unknown",
        projects: server.projects,
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

  // ── 3b. MCP Registry — Available & Recommended ────────────────────────

  const registryServers = raw.registryServers || [];
  const registryTotal = registryServers.length;

  // Build a set of installed server identifiers (lowercase names + slugs)
  const installedIds = new Set();
  for (const s of allMcpServers) {
    installedIds.add(s.name.toLowerCase());
    if (s.slug) installedIds.add(s.slug.toLowerCase());
  }

  // Filter out already-installed servers
  const notInstalled = registryServers.filter(
    (s) => !installedIds.has((s.slug || "").toLowerCase()) && !installedIds.has((s.name || "").toLowerCase()),
  );

  // Collect tech stacks from all repos
  const allStacks = new Set();
  for (const repo of [...configured, ...unconfigured]) {
    for (const stack of repo.techStack || []) {
      allStacks.add(stack.toLowerCase());
    }
  }

  // Collect description words from all repos
  const descWords = new Set();
  for (const repo of [...configured, ...unconfigured]) {
    for (const line of repo.desc || []) {
      for (const word of line.toLowerCase().split(/\s+/)) {
        descWords.add(word);
      }
    }
  }

  // Match hints against stacks and descriptions
  const recommendedSlugs = new Map(); // slug -> { reasons: [], matchCount: 0 }
  for (const [key, slugs] of Object.entries(MCP_STACK_HINTS)) {
    const stackMatches = [...configured, ...unconfigured].filter((r) =>
      (r.techStack || []).some((s) => s.toLowerCase() === key),
    );
    const inDesc = descWords.has(key);

    if (stackMatches.length > 0 || inDesc) {
      for (const slug of slugs) {
        if (!recommendedSlugs.has(slug)) {
          recommendedSlugs.set(slug, { reasons: [], matchCount: 0 });
        }
        const entry = recommendedSlugs.get(slug);
        if (stackMatches.length > 0) {
          entry.reasons.push(`${stackMatches.length} ${key} repo${stackMatches.length > 1 ? "s" : ""} detected`);
          entry.matchCount += stackMatches.length;
        }
        if (inDesc) {
          entry.reasons.push("mentioned in repo descriptions");
          entry.matchCount += 1;
        }
      }
    }
  }

  // Build recommended list from not-installed servers that match hints
  const recommendedMcpServers = [];
  const recommendedSlugSet = new Set();
  for (const server of notInstalled) {
    const slug = (server.slug || "").toLowerCase();
    if (recommendedSlugs.has(slug)) {
      const { reasons, matchCount } = recommendedSlugs.get(slug);
      recommendedMcpServers.push({ ...server, reasons, matchCount });
      recommendedSlugSet.add(slug);
    }
  }

  // Sort by relevance (more match signals first)
  recommendedMcpServers.sort((a, b) => b.matchCount - a.matchCount || a.name.localeCompare(b.name));

  // Available = not-installed minus recommended
  const availableMcpServers = notInstalled.filter(
    (s) => !recommendedSlugSet.has((s.slug || "").toLowerCase()),
  );

  // ── 4. Usage Analytics ────────────────────────────────────────────────

  const usageAnalytics = aggregateSessionMeta(raw.sessionMetaFiles || []);

  // ── 5. Insights Report Parsing ────────────────────────────────────────

  let insightsReport = null;
  if (raw.insightsReportHtml) {
    try {
      const reportHtml = raw.insightsReportHtml;

      // Extract subtitle — reformat ISO dates to readable format
      const subtitleMatch = reportHtml.match(/<p class="subtitle">([^<]+)<\/p>/);
      let subtitle = subtitleMatch ? subtitleMatch[1] : null;
      if (subtitle) {
        subtitle = subtitle.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m2, d) => {
          const dt = new Date(`${y}-${m2}-${d}T00:00:00Z`);
          return dt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          });
        });
      }

      // Extract glance sections
      const glanceSections = [];
      const glanceRe =
        /<div class="glance-section"><strong>([^<]+)<\/strong>\s*([\s\S]*?)<a[^>]*class="see-more"/g;
      let m;
      while ((m = glanceRe.exec(reportHtml)) !== null) {
        const text = m[2].replace(/<[^>]+>/g, "").trim();
        glanceSections.push({ label: m[1].replace(/:$/, ""), text });
      }

      // Extract stats
      const statsRe =
        /<div class="stat-value">([^<]+)<\/div><div class="stat-label">([^<]+)<\/div>/g;
      const reportStats = [];
      while ((m = statsRe.exec(reportHtml)) !== null) {
        const value = m[1];
        const label = m[2];
        const isDiff = /^[+-]/.test(value) && value.includes("/");
        reportStats.push({ value, label, isDiff });
      }

      // Extract friction categories
      const frictionRe =
        /<div class="friction-title">([^<]+)<\/div>\s*<div class="friction-desc">([^<]+)<\/div>/g;
      const frictionPoints = [];
      while ((m = frictionRe.exec(reportHtml)) !== null) {
        frictionPoints.push({ title: m[1], desc: m[2] });
      }

      if (glanceSections.length > 0 || reportStats.length > 0) {
        insightsReport = {
          subtitle,
          glance: glanceSections,
          stats: reportStats,
          friction: frictionPoints.slice(0, 3),
          filePath: raw.insightsReportPath || null,
        };
      }
    } catch {
      // skip if parsing fails
    }
  }

  // ── 6. Stats Supplementation ──────────────────────────────────────────

  // Make a copy so we don't mutate raw.statsCache
  const statsCache = structuredClone(raw.statsCache || {});

  // Supplement dailyActivity with session-meta data
  const sessionMetaFiles = raw.sessionMetaFiles || [];
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
      statsCache.dailyActivity = [...(statsCache.dailyActivity || []), ...supplemental].sort(
        (a, b) => a.date.localeCompare(b.date),
      );
    }
  }

  // Supplement dailyActivity with ccusage data
  const ccusageData = raw.ccusageData;
  if (ccusageData && ccusageData.daily) {
    const existingDates = new Set((statsCache.dailyActivity || []).map((d) => d.date));
    const ccusageSupplemental = ccusageData.daily
      .filter((d) => d.date && !existingDates.has(d.date) && d.totalTokens > 0)
      .map((d) => ({
        date: d.date,
        messageCount: Math.max(1, Math.round(d.totalTokens / 10000)),
      }));
    if (ccusageSupplemental.length > 0) {
      statsCache.dailyActivity = [...(statsCache.dailyActivity || []), ...ccusageSupplemental].sort(
        (a, b) => a.date.localeCompare(b.date),
      );
    }
  }

  // ── 7. Summary Stats ──────────────────────────────────────────────────

  const totalRepos = raw.repos.length;
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

  // ── 8. Insight Generation ─────────────────────────────────────────────

  const insights = [];

  // Drift alerts
  const highDriftRepos = configured.filter((r) => r.drift?.level === "high");
  if (highDriftRepos.length > 0) {
    insights.push({
      type: "warning",
      title: `${highDriftRepos.length} repo${highDriftRepos.length > 1 ? "s have" : " has"} high config drift`,
      detail: highDriftRepos
        .map((r) => `${r.name} (${r.drift.commitsSince} commits since config update)`)
        .join(", "),
      action: "Review and update CLAUDE.md in these repos",
    });
  }

  // Coverage
  if (unconfigured.length > 0 && totalRepos > 0) {
    const pct = Math.round((unconfigured.length / totalRepos) * 100);
    if (pct >= 40) {
      const withStack = unconfigured.filter((r) => r.techStack?.length > 0).slice(0, 3);
      insights.push({
        type: "info",
        title: `${unconfigured.length} repos unconfigured (${pct}%)`,
        detail: withStack.length
          ? `Top candidates: ${withStack.map((r) => `${r.name} (${r.techStack.join(", ")})`).join(", ")}`
          : "",
        action: "Run claude-code-dashboard init --template <stack> in these repos",
      });
    }
  }

  // MCP promotions
  if (mcpPromotions.length > 0) {
    insights.push({
      type: "promote",
      title: `${mcpPromotions.length} MCP server${mcpPromotions.length > 1 ? "s" : ""} could be promoted to global`,
      detail: mcpPromotions.map((p) => `${p.name} (in ${p.projects.length} projects)`).join(", "),
      action: "Add to ~/.claude/mcp_config.json for all projects",
    });
  }

  // Redundant project-scope MCP configs
  const redundantMcp = Object.values(mcpByName).filter((s) => s.userLevel && s.projects.length > 0);
  if (redundantMcp.length > 0) {
    insights.push({
      type: "tip",
      title: `${redundantMcp.length} MCP server${redundantMcp.length > 1 ? "s are" : " is"} global but also in project .mcp.json`,
      detail: redundantMcp.map((s) => `${s.name} (${s.projects.join(", ")})`).join("; "),
      action: "Remove from project .mcp.json — global config already covers all projects",
    });
  }

  // MCP recommendations
  if (recommendedMcpServers.length > 0) {
    insights.push({
      type: "tip",
      title: `${recommendedMcpServers.length} MCP server${recommendedMcpServers.length > 1 ? "s" : ""} recommended for your repos`,
      detail: recommendedMcpServers
        .slice(0, 3)
        .map((s) => `${s.name} (${s.reasons.join(", ")})`)
        .join(", "),
      action: "Check the Skills & MCP tab for install commands",
    });
  }

  // Skill sharing opportunities
  const skillMatchCounts = {};
  for (const r of configured) {
    for (const sk of r.matchedSkills || []) {
      const skName = typeof sk === "string" ? sk : sk.name;
      if (!skillMatchCounts[skName]) skillMatchCounts[skName] = [];
      skillMatchCounts[skName].push(r.name);
    }
  }
  const widelyRelevant = Object.entries(skillMatchCounts)
    .filter(([, repos]) => repos.length >= 3)
    .sort((a, b) => b[1].length - a[1].length);
  if (widelyRelevant.length > 0) {
    const top = widelyRelevant.slice(0, 3);
    insights.push({
      type: "info",
      title: `${widelyRelevant.length} skill${widelyRelevant.length > 1 ? "s" : ""} relevant across 3+ repos`,
      detail: top.map(([name, repos]) => `${name} (${repos.length} repos)`).join(", "),
      action: "Consider adding these skills to your global config",
    });
  }

  // Health quick wins
  const quickWinRepos = configured
    .filter((r) => r.healthScore > 0 && r.healthScore < 80 && r.healthReasons?.length > 0)
    .sort((a, b) => b.healthScore - a.healthScore)
    .slice(0, 3);
  if (quickWinRepos.length > 0) {
    insights.push({
      type: "tip",
      title: "Quick wins to improve config health",
      detail: quickWinRepos
        .map((r) => `${r.name} (${r.healthScore}/100): ${r.healthReasons[0]}`)
        .join("; "),
      action: "Small changes for measurable improvement",
    });
  }

  // Insights report nudge
  if (!insightsReport) {
    insights.push({
      type: "info",
      title: "Generate your Claude Code Insights report",
      detail: "Get personalized usage patterns, friction points, and feature suggestions",
      action: "Run /insights in Claude Code",
    });
  }

  // ── 9. Timestamp ──────────────────────────────────────────────────────

  const now = new Date();
  const timestamp =
    now
      .toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      .toLowerCase() +
    " at " +
    now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();

  // ── Return ────────────────────────────────────────────────────────────

  return {
    configured,
    unconfigured,
    globalCmds: raw.globalCmds,
    globalRules: raw.globalRules,
    globalSkills: raw.globalSkills,
    chains: raw.chains,
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
    recommendedMcpServers,
    availableMcpServers,
    registryTotal,
    scanScope: raw.scanScope,
    insights,
    insightsReport,
  };
}
