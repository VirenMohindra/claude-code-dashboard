import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { STACK_FILES } from "./constants.mjs";
import { gitCmd } from "./helpers.mjs";

export function computeHealthScore(repo) {
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

export function detectTechStack(repoDir) {
  const stacks = new Set();

  try {
    const entries = new Set(readdirSync(repoDir));

    for (const [file, stack] of Object.entries(STACK_FILES)) {
      if (entries.has(file)) stacks.add(stack);
    }

    if (entries.has("package.json")) {
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

  return { stacks: [...stacks] };
}

export function classifyDrift(commitCount) {
  if (commitCount === null || commitCount === undefined || commitCount < 0) {
    return { level: "unknown", commitsSince: 0 };
  }
  const n = Math.max(0, Number(commitCount) || 0);
  if (n === 0) return { level: "synced", commitsSince: 0 };
  if (n <= 5) return { level: "low", commitsSince: n };
  if (n <= 20) return { level: "medium", commitsSince: n };
  return { level: "high", commitsSince: n };
}

/** Count commits since config was last updated. Returns null if unknown. */
export function getGitRevCount(repoDir, configTimestamp) {
  if (!configTimestamp) return null;
  const countStr = gitCmd(repoDir, "rev-list", "--count", `--since=${configTimestamp}`, "HEAD");
  if (!countStr) return null;
  const parsed = Number(countStr);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed - 1); // -1 to exclude the config commit itself
}

export function computeDrift(repoDir, configTimestamp) {
  return classifyDrift(getGitRevCount(repoDir, configTimestamp));
}

export function findExemplar(stack, configuredRepos) {
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

export function generateSuggestions(exemplar) {
  if (!exemplar) return [];
  const suggestions = [];
  if (exemplar.hasAgentsFile) suggestions.push("add CLAUDE.md");
  if (exemplar.commands?.length > 0)
    suggestions.push(`add commands (${exemplar.name} has ${exemplar.commands.length})`);
  if (exemplar.rules?.length > 0)
    suggestions.push(`add rules (${exemplar.name} has ${exemplar.rules.length})`);
  return suggestions;
}

export function detectConfigPattern(repo) {
  if (repo.rules.length >= 3) return "modular";
  if (repo.sections.length >= 3) return "monolithic";
  if (repo.commands.length >= 2 && repo.sections.length === 0) return "command-heavy";
  return "minimal";
}

export function computeConfigSimilarity(repoA, repoB) {
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

export function matchSkillsToRepo(repo, skills) {
  if (!repo || !skills || skills.length === 0) return [];
  const repoTokens = new Set();
  for (const word of repo.name.toLowerCase().split(/[-_./]/)) {
    if (word.length > 1) repoTokens.add(word);
  }
  for (const s of repo.techStack || []) {
    repoTokens.add(s.toLowerCase());
  }
  for (const sec of repo.sections || []) {
    const name = (sec.name || sec || "").toLowerCase();
    for (const word of name.split(/\s+/)) {
      if (word.length > 2) repoTokens.add(word);
    }
  }
  const matched = [];
  for (const skill of skills) {
    const skillTokens = skill.name
      .toLowerCase()
      .split(/[-_./]/)
      .filter((t) => t.length > 1);
    const hits = skillTokens.filter((t) => repoTokens.has(t)).length;
    if (hits > 0) matched.push({ name: skill.name, relevance: hits });
  }
  return matched.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
}

export function lintConfig(repo) {
  const issues = [];
  if (repo.sections) {
    for (const sec of repo.sections) {
      const name = sec.name || sec || "";
      if (/TODO|FIXME|HACK/i.test(name)) {
        issues.push({ level: "warn", message: `Section "${name}" contains TODO/FIXME marker` });
      }
    }
  }
  if (!repo.hasAgentsFile && (repo.commands.length > 0 || repo.rules.length > 0)) {
    issues.push({ level: "info", message: "Has commands/rules but no CLAUDE.md" });
  }
  if (
    repo.hasAgentsFile &&
    repo.commands.length === 0 &&
    repo.rules.length === 0 &&
    (repo.sections || []).length === 0
  ) {
    issues.push({
      level: "warn",
      message: "CLAUDE.md exists but has no commands, rules, or sections",
    });
  }
  return issues;
}

export function computeDashboardDiff(prev, current) {
  const diff = { added: [], removed: [], changed: [] };
  if (!prev || !current) return diff;
  const prevNames = new Set((prev.configuredRepos || []).map((r) => r.name));
  const currNames = new Set((current.configuredRepos || []).map((r) => r.name));
  for (const name of currNames) {
    if (!prevNames.has(name)) diff.added.push(name);
  }
  for (const name of prevNames) {
    if (!currNames.has(name)) diff.removed.push(name);
  }
  const prevMap = Object.fromEntries((prev.configuredRepos || []).map((r) => [r.name, r]));
  const currMap = Object.fromEntries((current.configuredRepos || []).map((r) => [r.name, r]));
  for (const name of currNames) {
    if (
      prevNames.has(name) &&
      (prevMap[name].healthScore || 0) !== (currMap[name].healthScore || 0)
    ) {
      diff.changed.push({
        name,
        field: "healthScore",
        from: prevMap[name].healthScore || 0,
        to: currMap[name].healthScore || 0,
      });
    }
  }
  return diff;
}
