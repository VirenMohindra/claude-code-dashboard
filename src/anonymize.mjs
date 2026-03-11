/**
 * Deep anonymization for --anonymize flag.
 *
 * Builds a stable name map (real name -> generic label) and applies it
 * across every data structure that ends up in the HTML output.
 */

const REPO_LABELS = [
  "web-app",
  "api-service",
  "mobile-app",
  "data-pipeline",
  "admin-panel",
  "shared-lib",
  "cli-tool",
  "docs-site",
  "auth-service",
  "analytics-engine",
  "worker-queue",
  "config-store",
  "gateway",
  "scheduler",
  "notification-svc",
  "search-index",
  "media-service",
  "payment-gateway",
  "user-service",
  "reporting-tool",
  "internal-dashboard",
  "test-harness",
  "deploy-scripts",
  "design-system",
  "content-api",
  "ml-pipeline",
  "event-bus",
  "cache-layer",
  "log-aggregator",
  "infra-tools",
];

const PERSON_RE = /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g;
const GITHUB_HANDLE_RE = /@[a-zA-Z0-9][-a-zA-Z0-9]{0,38}\b/g;

function anonymizePath(p) {
  return p
    .replace(/^\/Users\/[^/]+\//, "~/")
    .replace(/^\/home\/[^/]+\//, "~/")
    .replace(/^C:\\Users\\[^\\]+\\/, "~\\")
    .replace(/^C:\/Users\/[^/]+\//, "~/");
}

function buildNameMap(configured, unconfigured) {
  const map = new Map();
  let idx = 0;
  for (const repo of [...configured, ...unconfigured]) {
    if (!map.has(repo.name)) {
      const label = idx < REPO_LABELS.length ? REPO_LABELS[idx] : `project-${idx + 1}`;
      map.set(repo.name, label);
      idx++;
    }
  }

  // Extract username from home dir paths to anonymize it too
  for (const repo of [...configured, ...unconfigured]) {
    const m = repo.path.match(/^\/(?:Users|home)\/([^/]+)\//);
    if (m && m[1] && !map.has(m[1])) {
      map.set(m[1], "user");
      break;
    }
  }

  return map;
}

function mapName(nameMap, name) {
  return nameMap.get(name) || name;
}

/**
 * Replace person names, GitHub handles, and all known repo names in text.
 * Uses case-insensitive replacement to catch "Salsa", "salsa", "SALSA" etc.
 */
function anonymizeText(text, nameMap) {
  let result = text.replace(PERSON_RE, "[name]").replace(GITHUB_HANDLE_RE, "@[user]");
  if (nameMap) {
    const sorted = [...nameMap.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [real, anon] of sorted) {
      if (real.length < 3) continue;
      const re = new RegExp(escapeRegex(real), "gi");
      result = result.replace(re, anon);
    }
  }
  return result;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function anonymizeMdItems(items) {
  return items.map((item, i) => ({
    ...item,
    name: `item-${String(i + 1).padStart(2, "0")}`,
    desc: "...",
    filepath: "", // prevent render functions from re-reading file content
  }));
}

/**
 * Anonymize all data structures in-place before HTML generation.
 */
export function anonymizeAll({
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
}) {
  const nameMap = buildNameMap(configured, unconfigured);

  // Repos
  for (const repo of [...configured, ...unconfigured]) {
    const anonName = mapName(nameMap, repo.name);
    repo.name = anonName;
    repo.key = anonName;
    repo.path = anonymizePath(repo.path).replace(/[^/]+$/, anonName);
    repo.shortPath = anonymizePath(repo.shortPath).replace(/[^/]+$/, anonName);

    // Description — redact entirely (contains arbitrary project-specific text)
    repo.desc = repo.desc?.length ? ["[project description redacted]"] : [];

    // Sections — keep headings (anonymized), redact preview content
    for (const section of repo.sections || []) {
      section.name = anonymizeText(section.name, nameMap);
      section.preview = ["..."];
    }

    // Commands & rules
    repo.commands = anonymizeMdItems(repo.commands || []);
    repo.rules = anonymizeMdItems(repo.rules || []);

    // Similar repos
    repo.similarRepos = (repo.similarRepos || []).map((r) => ({
      ...r,
      name: mapName(nameMap, r.name),
    }));

    // Exemplar name
    if (repo.exemplarName) {
      repo.exemplarName = mapName(nameMap, repo.exemplarName);
    }

    // Suggestions text — may reference exemplar name
    if (repo.suggestions) {
      repo.suggestions = repo.suggestions.map((s) => anonymizeText(s, nameMap));
    }

    // MCP servers per repo
    for (const mcp of repo.mcpServers || []) {
      if (mcp.source) {
        const repoName = mcp.source.split("/").pop();
        const anonPath = anonymizePath(mcp.source);
        mcp.source = anonPath.replace(/[^/]+$/, mapName(nameMap, repoName));
      }
    }
  }

  // Global commands, rules
  globalCmds.splice(0, globalCmds.length, ...anonymizeMdItems(globalCmds));
  globalRules.splice(0, globalRules.length, ...anonymizeMdItems(globalRules));

  // Global skills — anonymize name, redact description + filepath
  for (let i = 0; i < globalSkills.length; i++) {
    const skill = globalSkills[i];
    skill.name = `skill-${String(i + 1).padStart(2, "0")}`;
    skill.desc = "...";
    skill.filepath = "";
  }

  // Chains — anonymize node names (may have extra text like "name (backend)")
  for (const chain of chains) {
    chain.nodes = chain.nodes.map((n) => anonymizeText(n.trim(), nameMap));
  }

  // MCP summary — anonymize project paths
  for (const mcp of mcpSummary) {
    mcp.projects = (mcp.projects || []).map((p) => {
      const anonPath = anonymizePath(p);
      const repoName = p.split("/").pop();
      return anonPath.replace(/[^/]+$/, mapName(nameMap, repoName));
    });
  }

  // MCP promotions — anonymize project paths
  for (const promo of mcpPromotions) {
    promo.projects = (promo.projects || []).map((p) => {
      const anonPath = anonymizePath(p);
      const repoName = p.split("/").pop();
      return anonPath.replace(/[^/]+$/, mapName(nameMap, repoName));
    });
  }

  // Former MCP servers — anonymize names
  for (let i = 0; i < formerMcpServers.length; i++) {
    formerMcpServers[i] = `former-server-${i + 1}`;
  }

  // Consolidation groups
  for (const group of consolidationGroups) {
    group.repos = (group.repos || []).map((n) => mapName(nameMap, n));
    group.suggestion = `${group.repos.length} ${group.stack} repos with ${group.avgSimilarity}% avg similarity — consider shared global rules`;
  }
}
