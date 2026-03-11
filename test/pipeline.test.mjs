import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDashboardData } from "../src/pipeline.mjs";

/* ── Helpers ─────────────────────────────────────────────────────────── */

function makeMinimalRaw(overrides = {}) {
  return {
    repos: [],
    globalCmds: [],
    globalRules: [],
    globalSkills: [],
    userMcpServers: [],
    projectMcpByRepo: {},
    disabledMcpByRepo: {},
    historicalMcpMap: new Map(),
    sessionMetaFiles: [],
    ccusageData: null,
    statsCache: {},
    insightsReportHtml: null,
    chains: [],
    scanScope: "test",
    ...overrides,
  };
}

function makeFullRaw() {
  const now = Math.floor(Date.now() / 1000);
  return makeMinimalRaw({
    repos: [
      {
        name: "webapp",
        path: "/Users/test/projects/webapp",
        shortPath: "~/projects/webapp",
        commands: [
          { name: "deploy", desc: "Deploy to production", filepath: ".claude/commands/deploy.md" },
          { name: "test", desc: "Run tests", filepath: ".claude/commands/test.md" },
        ],
        rules: [
          { name: "style", desc: "Code style", filepath: ".claude/rules/style.md" },
        ],
        agentsFile: "/Users/test/projects/webapp/CLAUDE.md",
        desc: ["A React web application"],
        sections: [
          { name: "Architecture", preview: "SPA with REST API" },
          { name: "Testing", preview: "Jest + RTL" },
        ],
        techStack: ["react", "node"],
        freshness: now - 86400, // 1 day ago
        gitRevCount: 3, // low drift
      },
      {
        name: "api-server",
        path: "/Users/test/projects/api-server",
        shortPath: "~/projects/api-server",
        commands: [
          { name: "migrate", desc: "Run migrations", filepath: ".claude/commands/migrate.md" },
        ],
        rules: [],
        agentsFile: "/Users/test/projects/api-server/AGENTS.md",
        desc: ["Node.js REST API"],
        sections: [
          { name: "Architecture", preview: "Express + Postgres" },
        ],
        techStack: ["node"],
        freshness: now - 86400 * 100, // 100 days ago (stale)
        gitRevCount: 25, // high drift
      },
      {
        name: "mobile-app",
        path: "/Users/test/projects/mobile-app",
        shortPath: "~/projects/mobile-app",
        commands: [],
        rules: [],
        agentsFile: null,
        desc: [],
        sections: [],
        techStack: ["react"],
        freshness: 0,
        gitRevCount: null,
      },
      {
        name: "dashboard",
        path: "/Users/test/projects/dashboard",
        shortPath: "~/projects/dashboard",
        commands: [{ name: "build", desc: "Build dashboard", filepath: ".claude/commands/build.md" }],
        rules: [{ name: "style", desc: "Code style", filepath: ".claude/rules/style.md" }],
        agentsFile: "/Users/test/projects/dashboard/CLAUDE.md",
        desc: ["Dashboard UI"],
        sections: [{ name: "Architecture", preview: "React dashboard" }],
        techStack: ["react", "node"],
        freshness: now - 86400 * 5, // 5 days ago
        gitRevCount: 0, // synced
      },
      {
        name: "admin-panel",
        path: "/Users/test/projects/admin-panel",
        shortPath: "~/projects/admin-panel",
        commands: [{ name: "dev", desc: "Start dev", filepath: ".claude/commands/dev.md" }],
        rules: [{ name: "style", desc: "Code style", filepath: ".claude/rules/style.md" }],
        agentsFile: "/Users/test/projects/admin-panel/CLAUDE.md",
        desc: ["Admin interface"],
        sections: [{ name: "Architecture", preview: "React admin" }],
        techStack: ["react"],
        freshness: now - 86400 * 10,
        gitRevCount: 12, // medium drift
      },
    ],
    globalCmds: [{ name: "help", desc: "Show help", filepath: "~/.claude/commands/help.md" }],
    globalRules: [{ name: "tone", desc: "Professional tone", filepath: "~/.claude/rules/tone.md" }],
    globalSkills: [
      { name: "react-testing", desc: "React test patterns", filepath: "~/.claude/skills/react-testing/SKILL.md", source: "custom", category: "code-quality" },
      { name: "node-debug", desc: "Node debugging", filepath: "~/.claude/skills/node-debug/SKILL.md", source: "custom", category: "debugging" },
    ],
    userMcpServers: [
      { name: "filesystem", type: "stdio", scope: "user", source: "~/.claude/mcp_config.json" },
    ],
    projectMcpByRepo: {
      "/Users/test/projects/webapp": [
        { name: "database", type: "stdio", scope: "project", source: "~/projects/webapp" },
      ],
      "/Users/test/projects/api-server": [
        { name: "database", type: "stdio", scope: "project", source: "~/projects/api-server" },
      ],
      "/Users/test/projects/dashboard": [
        { name: "filesystem", type: "stdio", scope: "project", source: "~/projects/dashboard" },
      ],
    },
    disabledMcpByRepo: {
      "/Users/test/projects/mobile-app": ["old-server"],
    },
    historicalMcpMap: new Map([
      ["legacy-tool", { name: "legacy-tool", projects: new Set(["/Users/test/projects/old"]), lastSeen: new Date("2025-01-01") }],
    ]),
    sessionMetaFiles: [
      {
        start_time: "2026-03-10T10:00:00Z",
        duration_minutes: 45,
        user_message_count: 20,
        assistant_message_count: 25,
        tool_counts: { Read: 15, Write: 8 },
        languages: { javascript: 10, typescript: 5 },
      },
    ],
    ccusageData: {
      totals: { totalCost: 12.50, totalTokens: 500000 },
      daily: [
        { date: "2026-03-08", totalTokens: 100000 },
      ],
    },
    statsCache: {
      dailyActivity: [
        { date: "2026-03-09", messageCount: 30 },
      ],
    },
    insightsReportHtml: `
      <p class="subtitle">1,386 messages across 117 sessions (365 total) | 2026-02-23 to 2026-03-10</p>
      <div class="stat-value">1,386</div><div class="stat-label">Messages</div>
      <div class="stat-value">117</div><div class="stat-label">Sessions</div>
      <div class="stat-value">+33,424/-2,563</div><div class="stat-label">Lines</div>
      <div class="glance-section"><strong>What's working:</strong> Full end-to-end development<a class="see-more" href="#">more</a></div>
      <div class="glance-section"><strong>What needs work:</strong> Test coverage<a class="see-more" href="#">more</a></div>
      <div class="friction-title">Long context windows</div>
      <div class="friction-desc">Sessions frequently exceed context limits</div>
    `,
    chains: [{ nodes: ["api-server", "webapp"], arrow: "&rarr;" }],
    scanScope: "~/projects",
  });
}

/* ── Tests ────────────────────────────────────────────────────────────── */

describe("buildDashboardData()", () => {
  it("returns valid dashboard data from minimal raw inputs", () => {
    const raw = makeMinimalRaw();
    const data = buildDashboardData(raw);
    assert.ok(data.configured);
    assert.ok(data.unconfigured);
    assert.ok(data.insights);
    assert.equal(data.totalRepos, 0);
    assert.equal(data.coveragePct, 0);
  });

  // ── 1. Repo Classification ──────────────────────────────────────────

  describe("repo classification", () => {
    it("classifies repos with commands as configured", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "a", path: "/a", shortPath: "~/a", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured.length, 1);
      assert.equal(data.unconfigured.length, 0);
      assert.equal(data.configured[0].name, "a");
    });

    it("classifies repos with rules as configured", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "b", path: "/b", shortPath: "~/b", commands: [], rules: [{ name: "r", desc: "r" }], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured.length, 1);
      assert.equal(data.unconfigured.length, 0);
    });

    it("classifies repos with agentsFile as configured", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "c", path: "/c", shortPath: "~/c", commands: [], rules: [], agentsFile: "/c/CLAUDE.md", desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured.length, 1);
    });

    it("classifies repos without commands, rules, or agentsFile as unconfigured", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "bare", path: "/bare", shortPath: "~/bare", commands: [], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured.length, 0);
      assert.equal(data.unconfigured.length, 1);
      assert.equal(data.unconfigured[0].name, "bare");
    });

    it("separates multiple repos correctly", () => {
      const data = buildDashboardData(makeFullRaw());
      // webapp, api-server, dashboard, admin-panel = configured; mobile-app = unconfigured
      assert.equal(data.configured.length, 4);
      assert.equal(data.unconfigured.length, 1);
      assert.equal(data.unconfigured[0].name, "mobile-app");
    });
  });

  // ── 2. Freshness ────────────────────────────────────────────────────

  describe("freshness computation", () => {
    it("computes freshnessText and freshnessClass for configured repos", () => {
      const now = Math.floor(Date.now() / 1000);
      const raw = makeMinimalRaw({
        repos: [
          { name: "recent", path: "/recent", shortPath: "~/recent", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: now - 3600, gitRevCount: 0 },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured[0].freshnessText, "today");
      assert.equal(data.configured[0].freshnessClass, "fresh");
    });

    it("marks stale repos correctly", () => {
      const now = Math.floor(Date.now() / 1000);
      const raw = makeMinimalRaw({
        repos: [
          { name: "old", path: "/old", shortPath: "~/old", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: now - 86400 * 100, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured[0].freshnessClass, "stale");
      assert.ok(data.configured[0].freshnessText.endsWith("ago") || data.configured[0].freshnessText.endsWith("mo ago"));
    });

    it("returns 'unknown' for freshness 0", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "nots", path: "/nots", shortPath: "~/nots", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured[0].freshnessText, "unknown");
      assert.equal(data.configured[0].freshnessClass, "stale");
    });
  });

  // ── 3. Health Scores ────────────────────────────────────────────────

  describe("health scores", () => {
    it("assigns higher health scores to richer repos", () => {
      const data = buildDashboardData(makeFullRaw());
      const webapp = data.configured.find((r) => r.name === "webapp");
      const apiServer = data.configured.find((r) => r.name === "api-server");
      assert.ok(webapp.healthScore > 0, "webapp should have a health score");
      assert.ok(apiServer.healthScore > 0, "api-server should have a health score");
      // webapp has more commands, rules, desc, sections than api-server
      assert.ok(webapp.healthScore > apiServer.healthScore, "webapp should score higher than api-server");
    });

    it("includes health reasons for missing config elements", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "sparse", path: "/sparse", shortPath: "~/sparse", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      const repo = data.configured[0];
      assert.ok(repo.healthReasons.length > 0, "should have reasons for improvement");
      assert.ok(repo.healthReasons.some((r) => r.includes("CLAUDE.md")), "should suggest adding CLAUDE.md");
    });

    it("caps health score at 100", () => {
      const now = Math.floor(Date.now() / 1000);
      const raw = makeMinimalRaw({
        repos: [
          {
            name: "perfect", path: "/perfect", shortPath: "~/perfect",
            commands: [{ name: "a", desc: "a" }, { name: "b", desc: "b" }],
            rules: [{ name: "r1", desc: "r1" }, { name: "r2", desc: "r2" }],
            agentsFile: "/perfect/CLAUDE.md",
            desc: ["Full description"],
            sections: [{ name: "Arch", preview: "" }, { name: "Test", preview: "" }, { name: "Deploy", preview: "" }, { name: "CI", preview: "" }, { name: "Docs", preview: "" }],
            techStack: ["node"],
            freshness: now - 3600, // fresh
            gitRevCount: 0,
          },
        ],
      });
      const data = buildDashboardData(raw);
      assert.ok(data.configured[0].healthScore <= 100);
    });
  });

  // ── 4. Drift Classification ─────────────────────────────────────────

  describe("drift classification", () => {
    it("classifies null gitRevCount as unknown", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "a", path: "/a", shortPath: "~/a", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured[0].drift.level, "unknown");
    });

    it("classifies undefined gitRevCount as unknown", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "a", path: "/a", shortPath: "~/a", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0 },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured[0].drift.level, "unknown");
    });

    it("classifies gitRevCount 0 as synced", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "a", path: "/a", shortPath: "~/a", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: 0 },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured[0].drift.level, "synced");
      assert.equal(data.configured[0].drift.commitsSince, 0);
    });

    it("classifies gitRevCount 1-5 as low", () => {
      for (const count of [1, 3, 5]) {
        const raw = makeMinimalRaw({
          repos: [
            { name: "a", path: "/a", shortPath: "~/a", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: count },
          ],
        });
        const data = buildDashboardData(raw);
        assert.equal(data.configured[0].drift.level, "low", `gitRevCount ${count} should be low`);
        assert.equal(data.configured[0].drift.commitsSince, count);
      }
    });

    it("classifies gitRevCount 6-20 as medium", () => {
      for (const count of [6, 12, 20]) {
        const raw = makeMinimalRaw({
          repos: [
            { name: "a", path: "/a", shortPath: "~/a", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: count },
          ],
        });
        const data = buildDashboardData(raw);
        assert.equal(data.configured[0].drift.level, "medium", `gitRevCount ${count} should be medium`);
      }
    });

    it("classifies gitRevCount 21+ as high", () => {
      for (const count of [21, 25, 100]) {
        const raw = makeMinimalRaw({
          repos: [
            { name: "a", path: "/a", shortPath: "~/a", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: count },
          ],
        });
        const data = buildDashboardData(raw);
        assert.equal(data.configured[0].drift.level, "high", `gitRevCount ${count} should be high`);
      }
    });

    it("classifies negative gitRevCount as unknown", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "a", path: "/a", shortPath: "~/a", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: -1 },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured[0].drift.level, "unknown");
    });
  });

  // ── 5. Sorting by Richness ──────────────────────────────────────────

  describe("configured repos sort by richness", () => {
    it("sorts repos with more commands/rules/sections first", () => {
      const data = buildDashboardData(makeFullRaw());
      const names = data.configured.map((r) => r.name);
      // webapp: 2 cmds*3 + 1 rule*2 + 2 sections + 1 desc = 6+2+2+1 = 11
      // dashboard: 1 cmd*3 + 1 rule*2 + 1 section + 1 desc = 3+2+1+1 = 7
      // admin-panel: 1 cmd*3 + 1 rule*2 + 1 section + 1 desc = 3+2+1+1 = 7
      // api-server: 1 cmd*3 + 0 rules + 1 section + 1 desc = 3+0+1+1 = 5
      assert.equal(names[0], "webapp", "webapp (richest) should be first");
      assert.equal(names[names.length - 1], "api-server", "api-server (leanest) should be last");
    });

    it("sorts unconfigured repos alphabetically", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "zeta", path: "/z", shortPath: "~/z", commands: [], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0 },
          { name: "alpha", path: "/a", shortPath: "~/a", commands: [], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0 },
          { name: "beta", path: "/b", shortPath: "~/b", commands: [], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0 },
        ],
      });
      const data = buildDashboardData(raw);
      const names = data.unconfigured.map((r) => r.name);
      assert.deepEqual(names, ["alpha", "beta", "zeta"]);
    });
  });

  // ── 6. Suggestions for Unconfigured Repos ───────────────────────────

  describe("suggestions for unconfigured repos", () => {
    it("generates suggestions based on a matching exemplar", () => {
      const data = buildDashboardData(makeFullRaw());
      const mobileApp = data.unconfigured.find((r) => r.name === "mobile-app");
      assert.ok(mobileApp, "mobile-app should be unconfigured");
      assert.ok(mobileApp.suggestions.length > 0, "should have suggestions");
      assert.ok(mobileApp.exemplarName.length > 0, "should reference an exemplar");
    });

    it("sets empty suggestions when no tech stack overlap exists", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "configured", path: "/c", shortPath: "~/c", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: ["rust"], freshness: 0, gitRevCount: null },
          { name: "unconfigured", path: "/u", shortPath: "~/u", commands: [], rules: [], agentsFile: null, desc: [], sections: [], techStack: ["python"], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      const unconf = data.unconfigured[0];
      assert.deepEqual(unconf.suggestions, []);
      assert.equal(unconf.exemplarName, "");
    });

    it("suggests adding CLAUDE.md when exemplar has one", () => {
      const data = buildDashboardData(makeFullRaw());
      const mobileApp = data.unconfigured.find((r) => r.name === "mobile-app");
      assert.ok(mobileApp.suggestions.some((s) => s.includes("CLAUDE.md")));
    });
  });

  // ── 7. Similar Repos ────────────────────────────────────────────────

  describe("similar repos computation", () => {
    it("attaches similarRepos array to configured repos", () => {
      const data = buildDashboardData(makeFullRaw());
      for (const repo of data.configured) {
        assert.ok(Array.isArray(repo.similarRepos), `${repo.name} should have similarRepos`);
      }
    });

    it("limits similarRepos to at most 2 entries", () => {
      const data = buildDashboardData(makeFullRaw());
      for (const repo of data.configured) {
        assert.ok(repo.similarRepos.length <= 2, `${repo.name} should have at most 2 similar repos`);
      }
    });

    it("includes similarity percentage in similar repo entries", () => {
      const data = buildDashboardData(makeFullRaw());
      const webapp = data.configured.find((r) => r.name === "webapp");
      if (webapp.similarRepos.length > 0) {
        assert.ok(typeof webapp.similarRepos[0].similarity === "number");
        assert.ok(typeof webapp.similarRepos[0].name === "string");
      }
    });

    it("sorts similar repos by descending similarity", () => {
      const data = buildDashboardData(makeFullRaw());
      for (const repo of data.configured) {
        for (let i = 1; i < repo.similarRepos.length; i++) {
          assert.ok(
            repo.similarRepos[i - 1].similarity >= repo.similarRepos[i].similarity,
            `${repo.name} similarRepos should be sorted desc`,
          );
        }
      }
    });
  });

  // ── 8. Matched Skills ───────────────────────────────────────────────

  describe("skill matching", () => {
    it("attaches matchedSkills array to configured repos", () => {
      const data = buildDashboardData(makeFullRaw());
      for (const repo of data.configured) {
        assert.ok(Array.isArray(repo.matchedSkills), `${repo.name} should have matchedSkills`);
      }
    });

    it("matches react-testing skill to repos with react tech stack", () => {
      const data = buildDashboardData(makeFullRaw());
      const webapp = data.configured.find((r) => r.name === "webapp");
      const matched = webapp.matchedSkills.map((s) => s.name);
      assert.ok(matched.includes("react-testing"), "webapp (react stack) should match react-testing skill");
    });

    it("matches node-debug skill to repos with node tech stack", () => {
      const data = buildDashboardData(makeFullRaw());
      const apiServer = data.configured.find((r) => r.name === "api-server");
      const matched = apiServer.matchedSkills.map((s) => s.name);
      assert.ok(matched.includes("node-debug"), "api-server (node stack) should match node-debug skill");
    });

    it("returns empty matchedSkills when no global skills provided", () => {
      const raw = makeFullRaw();
      raw.globalSkills = [];
      const data = buildDashboardData(raw);
      for (const repo of data.configured) {
        assert.equal(repo.matchedSkills.length, 0);
      }
    });
  });

  // ── 9. Consolidation Opportunities ──────────────────────────────────

  describe("consolidation groups", () => {
    it("detects consolidation opportunity for 3+ repos sharing a tech stack", () => {
      const data = buildDashboardData(makeFullRaw());
      // webapp, dashboard, admin-panel all have "react"
      const reactGroup = data.consolidationGroups.find((g) => g.stack === "react");
      assert.ok(reactGroup, "should detect react consolidation group");
      assert.ok(reactGroup.repos.length >= 3, "should include 3+ react repos");
    });

    it("includes suggestion text in consolidation groups", () => {
      const data = buildDashboardData(makeFullRaw());
      for (const group of data.consolidationGroups) {
        assert.ok(group.suggestion.includes("repos with"), "suggestion should describe the group");
        assert.ok(group.suggestion.includes("avg similarity"), "suggestion should mention similarity");
      }
    });

    it("includes average similarity percentage", () => {
      const data = buildDashboardData(makeFullRaw());
      for (const group of data.consolidationGroups) {
        assert.ok(typeof group.avgSimilarity === "number");
        assert.ok(group.avgSimilarity >= 30, "groups below 30% similarity are filtered out");
      }
    });

    it("returns no consolidation groups when fewer than 3 repos share a stack", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "a", path: "/a", shortPath: "~/a", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: ["ruby"], freshness: 0, gitRevCount: null },
          { name: "b", path: "/b", shortPath: "~/b", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: ["ruby"], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      const rubyGroup = data.consolidationGroups.find((g) => g.stack === "ruby");
      assert.equal(rubyGroup, undefined, "2 ruby repos should not form a consolidation group");
    });
  });

  // ── 10. MCP Aggregation and Promotions ──────────────────────────────

  describe("MCP aggregation", () => {
    it("merges user and project MCP servers into mcpSummary", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.ok(data.mcpSummary.length > 0, "should have MCP servers");
      const names = data.mcpSummary.map((s) => s.name);
      assert.ok(names.includes("filesystem"), "should include user-level filesystem");
      assert.ok(names.includes("database"), "should include project-level database");
    });

    it("sorts user-level MCP servers before project-level", () => {
      const data = buildDashboardData(makeFullRaw());
      const firstUserIdx = data.mcpSummary.findIndex((s) => s.userLevel);
      const firstProjectIdx = data.mcpSummary.findIndex((s) => !s.userLevel);
      if (firstUserIdx >= 0 && firstProjectIdx >= 0) {
        assert.ok(firstUserIdx < firstProjectIdx, "user-level servers should come first");
      }
    });

    it("detects promotion candidates (project servers used in 2+ repos)", () => {
      const data = buildDashboardData(makeFullRaw());
      // "database" is in webapp and api-server project configs
      const dbPromotion = data.mcpPromotions.find((p) => p.name === "database");
      assert.ok(dbPromotion, "database should be a promotion candidate");
      assert.equal(dbPromotion.projects.length, 2);
    });

    it("does not promote servers already at user level", () => {
      const data = buildDashboardData(makeFullRaw());
      // "filesystem" is at user level AND in dashboard project config
      const fsPromotion = data.mcpPromotions.find((p) => p.name === "filesystem");
      assert.equal(fsPromotion, undefined, "filesystem is already user-level, should not be promoted");
    });

    it("attaches mcpServers to matching repos", () => {
      const data = buildDashboardData(makeFullRaw());
      const webapp = data.configured.find((r) => r.name === "webapp");
      assert.ok(webapp.mcpServers, "webapp should have mcpServers attached");
      assert.equal(webapp.mcpServers.length, 1);
      assert.equal(webapp.mcpServers[0].name, "database");
    });

    it("classifies historical MCP servers as former", () => {
      const data = buildDashboardData(makeFullRaw());
      // legacy-tool has lastSeen 2025-01-01, well beyond 30 days ago
      const legacy = data.formerMcpServers.find((s) => s.name === "legacy-tool");
      assert.ok(legacy, "legacy-tool should appear in formerMcpServers");
    });

    it("computes mcpCount correctly", () => {
      const data = buildDashboardData(makeFullRaw());
      // filesystem (user) + database (project, appears twice but deduped in mcpByName) + filesystem again (project, merges with user entry)
      assert.equal(data.mcpCount, data.mcpSummary.length);
      assert.ok(data.mcpCount >= 2, "should have at least filesystem and database");
    });
  });

  // ── 11. Insights Report Parsing ─────────────────────────────────────

  describe("insights report parsing", () => {
    it("parses subtitle with reformatted dates", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.ok(data.insightsReport, "should have parsed insights report");
      assert.ok(data.insightsReport.subtitle, "should have subtitle");
      // ISO dates should be reformatted to readable dates
      assert.ok(!data.insightsReport.subtitle.includes("2026-02-23"), "ISO dates should be reformatted");
      assert.ok(data.insightsReport.subtitle.includes("Feb"), "should contain month abbreviation");
    });

    it("extracts glance sections", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.equal(data.insightsReport.glance.length, 2);
      assert.equal(data.insightsReport.glance[0].label, "What's working");
      assert.ok(data.insightsReport.glance[0].text.includes("Full end-to-end"));
      assert.equal(data.insightsReport.glance[1].label, "What needs work");
    });

    it("extracts stats with isDiff detection", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.equal(data.insightsReport.stats.length, 3);

      const messages = data.insightsReport.stats.find((s) => s.label === "Messages");
      assert.ok(messages);
      assert.equal(messages.value, "1,386");
      assert.equal(messages.isDiff, false);

      const lines = data.insightsReport.stats.find((s) => s.label === "Lines");
      assert.ok(lines);
      assert.equal(lines.value, "+33,424/-2,563");
      assert.equal(lines.isDiff, true, "Lines stat with +/-  format should be detected as isDiff");
    });

    it("extracts friction points", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.equal(data.insightsReport.friction.length, 1);
      assert.equal(data.insightsReport.friction[0].title, "Long context windows");
      assert.equal(data.insightsReport.friction[0].desc, "Sessions frequently exceed context limits");
    });

    it("returns null insightsReport when no HTML provided", () => {
      const raw = makeMinimalRaw();
      const data = buildDashboardData(raw);
      assert.equal(data.insightsReport, null);
    });

    it("returns null insightsReport for invalid HTML", () => {
      const raw = makeMinimalRaw({ insightsReportHtml: "<div>no matching sections</div>" });
      const data = buildDashboardData(raw);
      assert.equal(data.insightsReport, null);
    });
  });

  // ── 12. Insight Generation ──────────────────────────────────────────

  describe("insight generation", () => {
    it("generates drift alert for high-drift repos", () => {
      const data = buildDashboardData(makeFullRaw());
      const driftInsight = data.insights.find((i) => i.title.includes("config drift"));
      assert.ok(driftInsight, "should generate drift alert");
      assert.equal(driftInsight.type, "warning");
      assert.ok(driftInsight.detail.includes("api-server"), "should mention api-server (high drift)");
    });

    it("generates MCP promotion insight", () => {
      const data = buildDashboardData(makeFullRaw());
      const promoInsight = data.insights.find((i) => i.type === "promote");
      assert.ok(promoInsight, "should generate MCP promotion insight");
      assert.ok(promoInsight.detail.includes("database"));
    });

    it("generates redundant MCP insight when user-level server is also in project config", () => {
      const data = buildDashboardData(makeFullRaw());
      const redundant = data.insights.find((i) => i.type === "tip" && i.title.includes("global but also"));
      assert.ok(redundant, "should generate redundant MCP insight");
      assert.ok(redundant.detail.includes("filesystem"), "should mention filesystem");
    });

    it("generates health quick wins for repos below 80 health", () => {
      const data = buildDashboardData(makeFullRaw());
      const quickWin = data.insights.find((i) => i.title.includes("Quick wins"));
      assert.ok(quickWin, "should generate quick win insight");
      assert.equal(quickWin.type, "tip");
    });

    it("does not generate insights report nudge when report exists", () => {
      const data = buildDashboardData(makeFullRaw());
      const nudge = data.insights.find((i) => i.title.includes("Generate your Claude Code Insights"));
      assert.equal(nudge, undefined, "should not nudge when insights report is present");
    });

    it("generates insights report nudge when no report provided", () => {
      const raw = makeFullRaw();
      raw.insightsReportHtml = null;
      const data = buildDashboardData(raw);
      const nudge = data.insights.find((i) => i.title.includes("Generate your Claude Code Insights"));
      assert.ok(nudge, "should nudge to generate insights report");
    });

    it("generates coverage insight when unconfigured % is >= 40%", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "conf", path: "/c", shortPath: "~/c", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
          { name: "u1", path: "/u1", shortPath: "~/u1", commands: [], rules: [], agentsFile: null, desc: [], sections: [], techStack: ["node"], freshness: 0 },
          { name: "u2", path: "/u2", shortPath: "~/u2", commands: [], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0 },
          { name: "u3", path: "/u3", shortPath: "~/u3", commands: [], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0 },
        ],
      });
      const data = buildDashboardData(raw);
      // 3 out of 4 unconfigured = 75%
      const coverage = data.insights.find((i) => i.title.includes("unconfigured"));
      assert.ok(coverage, "should generate coverage insight at 75% unconfigured");
      assert.equal(coverage.type, "info");
    });

    it("does not generate coverage insight when unconfigured % is < 40%", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "c1", path: "/c1", shortPath: "~/c1", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
          { name: "c2", path: "/c2", shortPath: "~/c2", commands: [{ name: "y", desc: "y" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
          { name: "c3", path: "/c3", shortPath: "~/c3", commands: [{ name: "z", desc: "z" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
          { name: "u1", path: "/u1", shortPath: "~/u1", commands: [], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0 },
        ],
      });
      const data = buildDashboardData(raw);
      // 1 out of 4 unconfigured = 25%
      const coverage = data.insights.find((i) => i.title.includes("unconfigured"));
      assert.equal(coverage, undefined, "should not generate coverage insight at 25%");
    });

    it("generates skill sharing insight when a skill matches 3+ repos", () => {
      const data = buildDashboardData(makeFullRaw());
      // react-testing matches webapp, dashboard, admin-panel (all have react in techStack)
      const skillInsight = data.insights.find((i) => i.title.includes("skill"));
      assert.ok(skillInsight, "should generate skill sharing insight");
      assert.equal(skillInsight.type, "info");
      assert.ok(skillInsight.detail.includes("react-testing") || skillInsight.detail.includes("repos"));
    });
  });

  // ── 13. Summary Stats ───────────────────────────────────────────────

  describe("summary statistics", () => {
    it("computes totalRepos count", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.equal(data.totalRepos, 5);
    });

    it("computes configured and unconfigured counts", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.equal(data.configuredCount, 4);
      assert.equal(data.unconfiguredCount, 1);
    });

    it("computes coverage percentage", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.equal(data.coveragePct, 80); // 4 of 5
    });

    it("computes 0% coverage with no repos", () => {
      const data = buildDashboardData(makeMinimalRaw());
      assert.equal(data.coveragePct, 0);
    });

    it("computes average health across configured repos", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.ok(typeof data.avgHealth === "number");
      assert.ok(data.avgHealth > 0);
      assert.ok(data.avgHealth <= 100);
    });

    it("computes driftCount for medium and high drift repos", () => {
      const data = buildDashboardData(makeFullRaw());
      // api-server (high) + admin-panel (medium) = 2
      assert.equal(data.driftCount, 2);
    });

    it("computes totalRepoCmds across configured repos", () => {
      const data = buildDashboardData(makeFullRaw());
      // webapp: 2 + api-server: 1 + dashboard: 1 + admin-panel: 1 = 5
      assert.equal(data.totalRepoCmds, 5);
    });
  });

  // ── 14. Collision-Safe Display Keys ─────────────────────────────────

  describe("collision-safe display keys", () => {
    it("uses repo name as key when unique", () => {
      const data = buildDashboardData(makeFullRaw());
      const webapp = data.configured.find((r) => r.name === "webapp");
      assert.equal(webapp.key, "webapp");
    });

    it("appends __2 suffix for duplicate names", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "myrepo", path: "/a/myrepo", shortPath: "~/a/myrepo", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
          { name: "myrepo", path: "/b/myrepo", shortPath: "~/b/myrepo", commands: [{ name: "y", desc: "y" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      const keys = data.configured.map((r) => r.key);
      assert.ok(keys.includes("myrepo"), "first occurrence should be plain name");
      assert.ok(keys.includes("myrepo__2"), "second occurrence should have __2 suffix");
    });

    it("appends __3 suffix for third duplicate name", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "dup", path: "/x/dup", shortPath: "~/x/dup", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
          { name: "dup", path: "/y/dup", shortPath: "~/y/dup", commands: [{ name: "y", desc: "y" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
          { name: "dup", path: "/z/dup", shortPath: "~/z/dup", commands: [{ name: "z", desc: "z" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
        ],
      });
      const data = buildDashboardData(raw);
      const keys = data.configured.map((r) => r.key);
      assert.ok(keys.includes("dup"), "first occurrence should be plain name");
      assert.ok(keys.includes("dup__2"), "second should have __2");
      assert.ok(keys.includes("dup__3"), "third should have __3");
    });

    it("handles collision across configured and unconfigured repos", () => {
      const raw = makeMinimalRaw({
        repos: [
          { name: "shared", path: "/a/shared", shortPath: "~/a/shared", commands: [{ name: "x", desc: "x" }], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0, gitRevCount: null },
          { name: "shared", path: "/b/shared", shortPath: "~/b/shared", commands: [], rules: [], agentsFile: null, desc: [], sections: [], techStack: [], freshness: 0 },
        ],
      });
      const data = buildDashboardData(raw);
      assert.equal(data.configured[0].key, "shared");
      assert.equal(data.unconfigured[0].key, "shared__2");
    });
  });

  // ── Passthrough and Shape ───────────────────────────────────────────

  describe("return shape and passthrough fields", () => {
    it("passes through globalCmds, globalRules, globalSkills, chains, scanScope", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.equal(data.globalCmds.length, 1);
      assert.equal(data.globalRules.length, 1);
      assert.equal(data.globalSkills.length, 2);
      assert.equal(data.chains.length, 1);
      assert.equal(data.scanScope, "~/projects");
    });

    it("includes a timestamp string", () => {
      const data = buildDashboardData(makeMinimalRaw());
      assert.ok(typeof data.timestamp === "string");
      assert.ok(data.timestamp.includes("at"), "timestamp should include 'at' separator");
    });

    it("includes usageAnalytics from session meta", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.equal(data.usageAnalytics.totalSessions, 1);
      assert.equal(data.usageAnalytics.totalDuration, 45);
      assert.ok(data.usageAnalytics.topTools.length > 0);
    });

    it("passes through ccusageData", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.ok(data.ccusageData);
      assert.equal(data.ccusageData.totals.totalCost, 12.50);
    });

    it("supplements statsCache dailyActivity from session meta and ccusage", () => {
      const data = buildDashboardData(makeFullRaw());
      assert.ok(data.statsCache.dailyActivity.length > 0);
      const dates = data.statsCache.dailyActivity.map((d) => d.date);
      // Should have existing 2026-03-09, session-meta 2026-03-10, ccusage 2026-03-08
      assert.ok(dates.includes("2026-03-09"), "should keep existing activity");
      assert.ok(dates.includes("2026-03-10"), "should add session-meta activity");
      assert.ok(dates.includes("2026-03-08"), "should add ccusage activity");
    });

    it("sorts supplemented dailyActivity by date", () => {
      const data = buildDashboardData(makeFullRaw());
      const dates = data.statsCache.dailyActivity.map((d) => d.date);
      const sorted = [...dates].sort();
      assert.deepEqual(dates, sorted, "dailyActivity should be sorted by date");
    });

    it("does not mutate raw.statsCache", () => {
      const raw = makeFullRaw();
      const originalLength = raw.statsCache.dailyActivity.length;
      buildDashboardData(raw);
      assert.equal(raw.statsCache.dailyActivity.length, originalLength, "raw.statsCache should not be mutated");
    });
  });
});
