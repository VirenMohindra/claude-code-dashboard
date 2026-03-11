import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { PRUNE, CONF, HOME } from "./constants.mjs";

export function findGitRepos(roots, maxDepth) {
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

export function getScanRoots() {
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
