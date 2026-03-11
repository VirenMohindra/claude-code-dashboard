import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

export function parseUserMcpConfig(content) {
  try {
    const data = JSON.parse(content);
    const servers = [];
    const mcpServers = data.mcpServers || {};
    for (const [name, cfg] of Object.entries(mcpServers)) {
      const type = cfg.type || (cfg.command ? "stdio" : cfg.url ? "http" : "unknown");
      servers.push({ name, type, scope: "user", source: "~/.claude/mcp_config.json" });
    }
    return servers;
  } catch {
    return [];
  }
}

export function parseProjectMcpConfig(content, repoPath) {
  try {
    const data = JSON.parse(content);
    const servers = [];
    const mcpServers = data.mcpServers || {};
    for (const [name, cfg] of Object.entries(mcpServers)) {
      const type = cfg.type || (cfg.command ? "stdio" : cfg.url ? "http" : "unknown");
      servers.push({ name, type, scope: "project", source: repoPath });
    }
    return servers;
  } catch {
    return [];
  }
}

export function findPromotionCandidates(servers) {
  const userLevel = new Set(servers.filter((s) => s.scope === "user").map((s) => s.name));
  const projectServers = servers.filter((s) => s.scope === "project");
  const byName = {};
  for (const s of projectServers) {
    if (userLevel.has(s.name)) continue;
    if (!byName[s.name]) byName[s.name] = new Set();
    byName[s.name].add(s.source);
  }
  return Object.entries(byName)
    .filter(([, projects]) => projects.size >= 2)
    .map(([name, projects]) => ({ name, projects: [...projects].sort() }))
    .sort((a, b) => b.projects.length - a.projects.length || a.name.localeCompare(b.name));
}

export function scanHistoricalMcpServers(claudeDir) {
  const historical = new Set();
  const fileHistoryDir = join(claudeDir, "file-history");
  if (!existsSync(fileHistoryDir)) return [];
  const MAX_SESSION_DIRS = 200;
  const MAX_FILES_TOTAL = 1000;
  let filesRead = 0;
  try {
    const sessionDirs = readdirSync(fileHistoryDir).sort().slice(-MAX_SESSION_DIRS);
    for (const sessionDir of sessionDirs) {
      if (filesRead >= MAX_FILES_TOTAL) break;
      const sessionPath = join(fileHistoryDir, sessionDir);
      if (!statSync(sessionPath).isDirectory()) continue;
      try {
        for (const snapFile of readdirSync(sessionPath)) {
          if (filesRead >= MAX_FILES_TOTAL) break;
          filesRead++;
          const snapPath = join(sessionPath, snapFile);
          try {
            const content = readFileSync(snapPath, "utf8");
            if (!content.includes("mcpServers")) continue;
            const data = JSON.parse(content);
            for (const name of Object.keys(data.mcpServers || {})) {
              historical.add(name);
            }
          } catch {
            /* skip malformed */
          }
        }
      } catch {
        /* skip unreadable session dir */
      }
    }
  } catch {
    /* skip unreadable file-history dir */
  }
  return [...historical];
}
