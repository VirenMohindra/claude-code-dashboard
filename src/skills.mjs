import { existsSync, readdirSync, readFileSync, lstatSync, readlinkSync } from "fs";
import { join } from "path";
import { HOME, SKILL_CATEGORIES, CATEGORY_ORDER } from "./constants.mjs";
import { gitCmd } from "./helpers.mjs";
import { getDescFromContent } from "./markdown.mjs";

/**
 * Detect where a skill was sourced from:
 * - "superpowers" — tracked in the obra/superpowers-skills git repo
 * - "skills.sh" — installed via skills.sh, symlinked from ~/.agents/skills/
 * - "custom" — user-created, not tracked by any known source
 */
export function detectSkillSource(skillName, skillsDir) {
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
export function categorizeSkill(name, content) {
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
export function scanSkillsDir(dir) {
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

export function groupSkillsByCategory(skills) {
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
