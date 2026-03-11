/**
 * Generate realistic raw inputs for --demo flag.
 * Returns the same shape that collectRawInputs() returns in production,
 * so the caller can pass it through buildDashboardData() for pipeline parity.
 */

function daysAgo(n) {
  return Math.floor(Date.now() / 1000) - n * 86400;
}

const DEMO_REPOS = [
  // ── Configured repos ────────────────────────────────────────────────────
  {
    name: "acme-web",
    path: "~/work/acme-web",
    shortPath: "~/work/acme-web",
    commands: [
      { name: "dev", desc: "Start dev server with hot reload", filepath: "" },
      { name: "test", desc: "Run vitest suite with coverage", filepath: "" },
      { name: "deploy", desc: "Deploy to staging via Vercel", filepath: "" },
      { name: "lint", desc: "Run ESLint + Prettier check", filepath: "" },
    ],
    rules: [
      { name: "architecture", desc: "App router conventions and component patterns", filepath: "" },
      {
        name: "testing",
        desc: "Test behavior not implementation, use MSW for mocks",
        filepath: "",
      },
      { name: "styling", desc: "Tailwind utility-first, no inline styles", filepath: "" },
    ],
    agentsFile: "~/work/acme-web/CLAUDE.md",
    desc: [
      "Customer-facing web application built with Next.js 15 and React Server Components.",
      "Uses Supabase for auth and database, deployed on Vercel.",
    ],
    sections: [
      {
        name: "Architecture",
        preview: [
          "App router with RSC",
          "Shared components in /ui",
          "Feature modules in /features",
        ],
      },
      {
        name: "Testing",
        preview: ["Vitest for unit tests", "Playwright for E2E", "MSW for API mocking"],
      },
      {
        name: "Deployment",
        preview: ["Preview deploys on PRs", "Staging auto-deploy from main"],
      },
    ],
    freshness: daysAgo(3),
    gitRevCount: 0,
    techStack: ["next", "react"],
  },
  {
    name: "payments-api",
    path: "~/work/payments-api",
    shortPath: "~/work/payments-api",
    commands: [
      { name: "test", desc: "Run pytest with coverage", filepath: "" },
      { name: "migrate", desc: "Run alembic migrations", filepath: "" },
      { name: "serve", desc: "Start FastAPI dev server", filepath: "" },
    ],
    rules: [
      { name: "security", desc: "Input validation on all endpoints, no raw SQL", filepath: "" },
      {
        name: "error-handling",
        desc: "Structured errors with codes, never expose internals",
        filepath: "",
      },
    ],
    agentsFile: "~/work/payments-api/CLAUDE.md",
    desc: ["Payment processing API handling Stripe integration and subscription management."],
    sections: [
      {
        name: "Security",
        preview: ["Validate all inputs with Pydantic", "Rate limiting on sensitive endpoints"],
      },
      {
        name: "Database",
        preview: ["PostgreSQL via SQLAlchemy", "Alembic for migrations"],
      },
    ],
    freshness: daysAgo(12),
    gitRevCount: 4,
    techStack: ["python"],
  },
  {
    name: "mobile-app",
    path: "~/work/mobile-app",
    shortPath: "~/work/mobile-app",
    commands: [
      { name: "ios", desc: "Run on iOS simulator", filepath: "" },
      { name: "android", desc: "Run on Android emulator", filepath: "" },
      { name: "test", desc: "Run Jest test suite", filepath: "" },
    ],
    rules: [
      { name: "navigation", desc: "React Navigation v7 patterns and deep linking", filepath: "" },
    ],
    agentsFile: "~/work/mobile-app/CLAUDE.md",
    desc: ["Cross-platform mobile app built with Expo and React Native."],
    sections: [
      {
        name: "Navigation",
        preview: ["File-based routing via expo-router", "Deep link config in app.json"],
      },
    ],
    freshness: daysAgo(45),
    gitRevCount: 18,
    techStack: ["expo", "react"],
  },
  {
    name: "infra-tools",
    path: "~/work/infra-tools",
    shortPath: "~/work/infra-tools",
    commands: [
      { name: "build", desc: "Build all Go binaries", filepath: "" },
      { name: "test", desc: "Run go test ./...", filepath: "" },
    ],
    rules: [],
    agentsFile: "~/work/infra-tools/CLAUDE.md",
    desc: ["Internal CLI tools for infrastructure automation."],
    sections: [{ name: "Build", preview: ["Go 1.22", "Multi-binary workspace layout"] }],
    freshness: daysAgo(90),
    gitRevCount: 34,
    techStack: ["go"],
  },
  {
    name: "marketing-site",
    path: "~/work/marketing-site",
    shortPath: "~/work/marketing-site",
    commands: [
      { name: "dev", desc: "Start Next.js dev server", filepath: "" },
      { name: "build", desc: "Build static export", filepath: "" },
    ],
    rules: [
      { name: "content", desc: "All copy comes from CMS, never hardcode text", filepath: "" },
    ],
    agentsFile: "~/work/marketing-site/CLAUDE.md",
    desc: ["Public marketing website with blog and documentation."],
    sections: [
      { name: "Content", preview: ["MDX for blog posts", "Contentlayer for type-safe content"] },
    ],
    freshness: daysAgo(7),
    gitRevCount: 2,
    techStack: ["next"],
  },
  {
    name: "shared-ui",
    path: "~/work/shared-ui",
    shortPath: "~/work/shared-ui",
    commands: [
      { name: "storybook", desc: "Start Storybook dev server", filepath: "" },
      { name: "build", desc: "Build and publish to internal registry", filepath: "" },
    ],
    rules: [
      { name: "components", desc: "All components must have stories and a11y tests", filepath: "" },
    ],
    agentsFile: "~/work/shared-ui/CLAUDE.md",
    desc: ["Shared component library used across web projects."],
    sections: [
      {
        name: "Components",
        preview: ["Radix primitives", "Tailwind variants", "Storybook for documentation"],
      },
    ],
    freshness: daysAgo(14),
    gitRevCount: 0,
    techStack: ["react"],
  },

  // ── Unconfigured repos ──────────────────────────────────────────────────
  {
    name: "data-scripts",
    path: "~/work/data-scripts",
    shortPath: "~/work/data-scripts",
    techStack: ["python"],
    agentsFile: null,
    commands: [],
    rules: [],
    desc: [],
    sections: [],
    freshness: 0,
    gitRevCount: null,
  },
  {
    name: "legacy-admin",
    path: "~/work/legacy-admin",
    shortPath: "~/work/legacy-admin",
    techStack: ["react"],
    agentsFile: null,
    commands: [],
    rules: [],
    desc: [],
    sections: [],
    freshness: 0,
    gitRevCount: null,
  },
  {
    name: "ops-runbooks",
    path: "~/work/ops-runbooks",
    shortPath: "~/work/ops-runbooks",
    techStack: [],
    agentsFile: null,
    commands: [],
    rules: [],
    desc: [],
    sections: [],
    freshness: 0,
    gitRevCount: null,
  },
];

const DEMO_GLOBAL_CMDS = [
  { name: "commit", desc: "Stage changes and create a conventional commit", filepath: "" },
  { name: "review-pr", desc: "Fetch PR diff and perform code review", filepath: "" },
  { name: "dashboard", desc: "Generate and open the config dashboard", filepath: "" },
  { name: "test-all", desc: "Run full test suite with coverage report", filepath: "" },
];

const DEMO_GLOBAL_RULES = [
  { name: "git-workflow", desc: "Branch naming, commit conventions, PR process", filepath: "" },
  {
    name: "code-standards",
    desc: "Architecture principles, error handling, quality gates",
    filepath: "",
  },
  {
    name: "communication",
    desc: "Slack message formatting, draft-before-send policy",
    filepath: "",
  },
];

const DEMO_GLOBAL_SKILLS = [
  {
    name: "e2e-test",
    desc: "Run Playwright E2E tests against a branch",
    filepath: "",
    source: { type: "custom" },
    category: "code-quality",
  },
  {
    name: "react-doctor",
    desc: "Catch common React bugs and performance issues",
    filepath: "",
    source: { type: "skills.sh", repo: "community/react-tools" },
    category: "debugging",
  },
  {
    name: "systematic-debugging",
    desc: "Structured root cause analysis with diagnostic plans",
    filepath: "",
    source: { type: "superpowers", repo: "obra/superpowers-skills" },
    category: "debugging",
  },
  {
    name: "writing-plans",
    desc: "Create implementation plans from specs before coding",
    filepath: "",
    source: { type: "superpowers", repo: "obra/superpowers-skills" },
    category: "workflow",
  },
  {
    name: "code-review",
    desc: "Review PR diffs for correctness, style, and security",
    filepath: "",
    source: { type: "superpowers", repo: "obra/superpowers-skills" },
    category: "code-quality",
  },
  {
    name: "find-session",
    desc: "Search past Claude Code sessions by keyword or date",
    filepath: "",
    source: { type: "custom" },
    category: "research",
  },
  {
    name: "slack-digest",
    desc: "Extract action items and decisions from Slack threads",
    filepath: "",
    source: { type: "custom" },
    category: "integrations",
  },
  {
    name: "deploy-staging",
    desc: "Deploy current branch to staging environment",
    filepath: "",
    source: { type: "custom" },
    category: "workflow",
  },
];

// Simple seeded PRNG for deterministic demo output (mulberry32)
function seededRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateDemoHeatmap() {
  const rng = seededRng(42);
  const days = [];
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    // Weighted deterministic: more activity on weekdays
    const isWeekday = d.getDay() > 0 && d.getDay() < 6;
    const base = isWeekday ? 8 : 2;
    const messageCount = Math.floor(rng() * base * 3);
    if (messageCount > 0) days.push({ date, messageCount });
  }
  return days;
}

function generateDemoHourCounts() {
  const rng = seededRng(99);
  const counts = {};
  // Peak at 10am and 2pm
  for (let h = 0; h < 24; h++) {
    const peak = Math.exp(-((h - 10) ** 2) / 18) + Math.exp(-((h - 14) ** 2) / 12);
    counts[String(h)] = Math.round(peak * 120 + rng() * 20);
  }
  return counts;
}

// ── MCP raw data ─────────────────────────────────────────────────────────────

function buildDemoMcpData() {
  // User-level MCP servers (global)
  const userMcpServers = [
    { name: "playwright", type: "stdio", scope: "user", source: "~/.claude/mcp_config.json" },
    { name: "sentry", type: "http", scope: "user", source: "~/.claude/mcp_config.json" },
  ];

  // Project-level MCP servers
  const projectMcpByRepo = {
    "~/work/acme-web": [
      { name: "playwright", type: "stdio", scope: "project", source: "~/work/acme-web" },
      { name: "github", type: "stdio", scope: "project", source: "~/work/acme-web" },
      { name: "figma", type: "stdio", scope: "project", source: "~/work/acme-web" },
    ],
    "~/work/payments-api": [
      { name: "github", type: "stdio", scope: "project", source: "~/work/payments-api" },
      { name: "postgres", type: "stdio", scope: "project", source: "~/work/payments-api" },
    ],
  };

  // Disabled MCP servers
  const disabledMcpByRepo = {};

  // Historical MCP servers (former — no longer in any config)
  const historicalMcpMap = new Map([
    [
      "redis",
      {
        name: "redis",
        projects: new Set(["~/work/cache-service"]),
        lastSeen: null,
      },
    ],
    [
      "datadog",
      {
        name: "datadog",
        projects: new Set(),
        lastSeen: null,
      },
    ],
  ]);

  return { userMcpServers, projectMcpByRepo, disabledMcpByRepo, historicalMcpMap };
}

// ── Session meta raw data ────────────────────────────────────────────────────

function buildDemoSessionMeta() {
  // Generate enough session entries that aggregateSessionMeta produces
  // realistic analytics similar to the old hardcoded usageAnalytics.
  const sessions = [];
  const toolSets = [
    { Read: 12, Edit: 8, Bash: 6, Grep: 4, Write: 3, Glob: 2 },
    { Read: 8, Edit: 6, Bash: 4, Grep: 3, Write: 2, Agent: 1 },
    { Read: 6, Edit: 5, Bash: 3, Grep: 2, Write: 1, WebSearch: 1 },
    { Read: 10, Edit: 7, Bash: 5, Grep: 3, Glob: 2, Agent: 1 },
    { Read: 5, Edit: 4, Bash: 3, Grep: 2, Write: 2 },
  ];
  const langSets = [
    { TypeScript: 25, JavaScript: 8, Markdown: 2 },
    { Python: 15, Markdown: 1 },
    { TypeScript: 18, JavaScript: 6 },
    { Go: 8 },
    { TypeScript: 12, Python: 5, JavaScript: 3 },
  ];
  const errorSets = [
    { lint_error: 1 },
    { type_error: 1 },
    { test_failure: 1 },
    {},
    { lint_error: 1, type_error: 1 },
  ];

  const rng = seededRng(247);
  for (let i = 0; i < 247; i++) {
    const dayOffset = Math.floor(rng() * 60);
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    const hour = 8 + Math.floor(rng() * 10);
    date.setHours(hour, Math.floor(rng() * 60), 0, 0);

    const variant = i % toolSets.length;
    const userMsgs = 3 + Math.floor(rng() * 15);
    const assistantMsgs = userMsgs + Math.floor(rng() * 5);
    const duration = 5 + Math.floor(rng() * 40);

    sessions.push({
      start_time: date.toISOString(),
      duration_minutes: duration,
      user_message_count: userMsgs,
      assistant_message_count: assistantMsgs,
      tool_counts: { ...toolSets[variant] },
      languages: { ...langSets[variant] },
      tool_error_categories: { ...errorSets[variant] },
    });
  }

  return sessions;
}

// ── Insights report HTML ─────────────────────────────────────────────────────

const DEMO_INSIGHTS_HTML = `<!DOCTYPE html>
<html>
<body>
<p class="subtitle">1,386 messages across 117 sessions (365 total) | 2026-02-23 to 2026-03-10</p>
<div class="stat-value">1,386</div><div class="stat-label">Messages</div>
<div class="stat-value">+33,424/-2,563</div><div class="stat-label">Lines</div>
<div class="stat-value">632</div><div class="stat-label">Files</div>
<div class="stat-value">14</div><div class="stat-label">Days</div>
<div class="stat-value">99</div><div class="stat-label">Msgs/Day</div>
<div class="glance-section"><strong>What's working:</strong> Full end-to-end shipping workflow — implementation through PR creation to production deployment in single sessions.<a class="see-more" href="#">more</a></div>
<div class="glance-section"><strong>What's hindering you:</strong> Claude frequently jumps into fixes without checking actual state first, costing correction cycles.<a class="see-more" href="#">more</a></div>
<div class="glance-section"><strong>Quick wins to try:</strong> Create custom slash commands for repeated workflows like PR reviews and Slack message drafting.<a class="see-more" href="#">more</a></div>
<div class="friction-title">Wrong Target / Misidentification</div>
<div class="friction-desc">Claude acts on the wrong file or setting before you catch the mistake.</div>
<div class="friction-title">Premature Solutions</div>
<div class="friction-desc">Jumps into fixes without first checking actual state of the codebase.</div>
</body>
</html>`;

// ── Main export ──────────────────────────────────────────────────────────────

export function generateDemoRawInputs() {
  const { userMcpServers, projectMcpByRepo, disabledMcpByRepo, historicalMcpMap } =
    buildDemoMcpData();

  return {
    repos: [...DEMO_REPOS],
    globalCmds: DEMO_GLOBAL_CMDS,
    globalRules: DEMO_GLOBAL_RULES,
    globalSkills: DEMO_GLOBAL_SKILLS,
    userMcpServers,
    projectMcpByRepo,
    disabledMcpByRepo,
    historicalMcpMap,
    sessionMetaFiles: buildDemoSessionMeta(),
    ccusageData: {
      totals: { totalCost: 47.82, totalTokens: 28_450_000 },
      daily: [],
    },
    statsCache: {
      dailyActivity: generateDemoHeatmap(),
      hourCounts: generateDemoHourCounts(),
      modelUsage: {
        "claude-sonnet-4-6": { inputTokens: 18_200_000, outputTokens: 6_800_000 },
        "claude-haiku-4-5": { inputTokens: 2_400_000, outputTokens: 1_050_000 },
      },
    },
    insightsReportHtml: DEMO_INSIGHTS_HTML,
    chains: [
      { nodes: ["shared-ui", "acme-web", "marketing-site"], arrow: "&rarr;" },
      { nodes: ["payments-api", "acme-web"], arrow: "&rarr;" },
    ],
    scanScope: "~/work (depth 5)",
  };
}
