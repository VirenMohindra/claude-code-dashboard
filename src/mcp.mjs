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

/**
 * Scan file-history snapshots for MCP server usage, enriched with project paths
 * and timestamps from session-meta. Returns a map of server name → metadata.
 *
 * Each entry: { name, projects: Set<string>, lastSeen: Date|null }
 */
export function scanHistoricalMcpServers(claudeDir) {
  const fileHistoryDir = join(claudeDir, "file-history");
  if (!existsSync(fileHistoryDir)) return new Map();

  // Build session → { projectPath, startTime } lookup from session-meta
  const sessionMeta = new Map();
  const metaDir = join(claudeDir, "usage-data", "session-meta");
  if (existsSync(metaDir)) {
    try {
      for (const file of readdirSync(metaDir)) {
        if (!file.endsWith(".json")) continue;
        try {
          const meta = JSON.parse(readFileSync(join(metaDir, file), "utf8"));
          const sessionId = file.replace(/\.json$/, "");
          sessionMeta.set(sessionId, {
            projectPath: meta.project_path || null,
            startTime: meta.start_time ? new Date(meta.start_time) : null,
          });
        } catch {
          /* skip malformed meta */
        }
      }
    } catch {
      /* skip unreadable meta dir */
    }
  }

  const servers = new Map(); // name → { name, projects: Set, lastSeen: Date|null }

  try {
    const sessionDirs = readdirSync(fileHistoryDir);
    for (const sessionDir of sessionDirs) {
      const sessionPath = join(fileHistoryDir, sessionDir);
      try {
        if (!statSync(sessionPath).isDirectory()) continue;
      } catch {
        continue;
      }

      const meta = sessionMeta.get(sessionDir);
      const projectPath = meta?.projectPath || null;
      const startTime = meta?.startTime || null;

      try {
        // Only read the latest version of each file hash (highest @vN)
        const files = readdirSync(sessionPath);
        const latestByHash = new Map();
        for (const f of files) {
          const atIdx = f.indexOf("@v");
          if (atIdx < 0) continue;
          const hash = f.slice(0, atIdx);
          const ver = parseInt(f.slice(atIdx + 2), 10) || 0;
          const prev = latestByHash.get(hash);
          if (!prev || ver > prev.ver) {
            latestByHash.set(hash, { file: f, ver });
          }
        }

        for (const { file } of latestByHash.values()) {
          const snapPath = join(sessionPath, file);
          try {
            const content = readFileSync(snapPath, "utf8");
            if (!content.includes("mcpServers")) continue;
            const data = JSON.parse(content);
            for (const name of Object.keys(data.mcpServers || {})) {
              if (!servers.has(name)) {
                servers.set(name, { name, projects: new Set(), lastSeen: null });
              }
              const entry = servers.get(name);
              if (projectPath) entry.projects.add(projectPath);
              if (startTime && (!entry.lastSeen || startTime > entry.lastSeen)) {
                entry.lastSeen = startTime;
              }
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
  return servers;
}

/**
 * Classify historical MCP servers as "recent" (seen in last recencyDays) or "former".
 * Recent servers are merged into the current server list if not already present.
 */
export function classifyHistoricalServers(historicalMap, currentNames, recencyDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - recencyDays);

  const recent = [];
  const former = [];

  for (const [name, entry] of historicalMap) {
    if (currentNames.has(name)) continue; // already in current config
    const info = {
      name,
      projects: [...entry.projects].sort(),
      lastSeen: entry.lastSeen,
    };
    if (entry.lastSeen && entry.lastSeen >= cutoff) {
      recent.push(info);
    } else {
      former.push(info);
    }
  }

  recent.sort((a, b) => a.name.localeCompare(b.name));
  former.sort((a, b) => a.name.localeCompare(b.name));
  return { recent, former };
}
