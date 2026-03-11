/**
 * Generate realistic fake data for --demo flag.
 * Produces a complete data object ready for generateDashboardHtml().
 */

function daysAgo(n) {
  return Math.floor(Date.now() / 1000) - n * 86400;
}

const DEMO_CONFIGURED = [
  {
    key: "acme-web",
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
    freshnessText: "3 days ago",
    freshnessClass: "fresh",
    techStack: ["next", "react"],
    healthScore: 95,
    healthReasons: ["Has CLAUDE.md", "Has commands", "Has rules", "Recently updated"],
    hasAgentsFile: true,
    configPattern: "modular",
    drift: { level: "synced", commitsSince: 0 },
    similarRepos: [{ name: "marketing-site", similarity: 72 }],
    matchedSkills: [{ name: "e2e-test" }, { name: "react-doctor" }],
    mcpServers: [
      { name: "playwright", type: "stdio", scope: "project", source: "~/work/acme-web" },
    ],
  },
  {
    key: "payments-api",
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
    freshnessText: "12 days ago",
    freshnessClass: "fresh",
    techStack: ["python"],
    healthScore: 80,
    healthReasons: ["Has CLAUDE.md", "Has commands", "Has rules"],
    hasAgentsFile: true,
    configPattern: "modular",
    drift: { level: "low", commitsSince: 4 },
    similarRepos: [],
    matchedSkills: [{ name: "systematic-debugging" }],
    mcpServers: [],
  },
  {
    key: "mobile-app",
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
    desc: ["Cross-platform mobile app built with Expo and React Native."],
    sections: [
      {
        name: "Navigation",
        preview: ["File-based routing via expo-router", "Deep link config in app.json"],
      },
    ],
    freshness: daysAgo(45),
    freshnessText: "1 month ago",
    freshnessClass: "aging",
    techStack: ["expo", "react"],
    healthScore: 60,
    healthReasons: ["Has CLAUDE.md", "Has commands"],
    hasAgentsFile: true,
    configPattern: "monolithic",
    drift: { level: "medium", commitsSince: 18 },
    similarRepos: [{ name: "acme-web", similarity: 45 }],
    matchedSkills: [{ name: "react-doctor" }],
    mcpServers: [],
  },
  {
    key: "infra-tools",
    name: "infra-tools",
    path: "~/work/infra-tools",
    shortPath: "~/work/infra-tools",
    commands: [
      { name: "build", desc: "Build all Go binaries", filepath: "" },
      { name: "test", desc: "Run go test ./...", filepath: "" },
    ],
    rules: [],
    desc: ["Internal CLI tools for infrastructure automation."],
    sections: [{ name: "Build", preview: ["Go 1.22", "Multi-binary workspace layout"] }],
    freshness: daysAgo(90),
    freshnessText: "3 months ago",
    freshnessClass: "stale",
    techStack: ["go"],
    healthScore: 40,
    healthReasons: ["Has CLAUDE.md", "Has commands"],
    hasAgentsFile: true,
    configPattern: "minimal",
    drift: { level: "high", commitsSince: 34 },
    similarRepos: [],
    matchedSkills: [],
    mcpServers: [],
  },
  {
    key: "marketing-site",
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
    desc: ["Public marketing website with blog and documentation."],
    sections: [
      { name: "Content", preview: ["MDX for blog posts", "Contentlayer for type-safe content"] },
    ],
    freshness: daysAgo(7),
    freshnessText: "1 week ago",
    freshnessClass: "fresh",
    techStack: ["next"],
    healthScore: 70,
    healthReasons: ["Has CLAUDE.md", "Has commands", "Has rules"],
    hasAgentsFile: true,
    configPattern: "modular",
    drift: { level: "low", commitsSince: 2 },
    similarRepos: [{ name: "acme-web", similarity: 68 }],
    matchedSkills: [{ name: "e2e-test" }],
    mcpServers: [],
  },
  {
    key: "shared-ui",
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
    desc: ["Shared component library used across web projects."],
    sections: [
      {
        name: "Components",
        preview: ["Radix primitives", "Tailwind variants", "Storybook for documentation"],
      },
    ],
    freshness: daysAgo(14),
    freshnessText: "2 weeks ago",
    freshnessClass: "fresh",
    techStack: ["react"],
    healthScore: 75,
    healthReasons: ["Has CLAUDE.md", "Has commands", "Has rules"],
    hasAgentsFile: true,
    configPattern: "modular",
    drift: { level: "synced", commitsSince: 0 },
    similarRepos: [{ name: "acme-web", similarity: 55 }],
    matchedSkills: [],
    mcpServers: [],
  },
];

const DEMO_UNCONFIGURED = [
  {
    key: "data-scripts",
    name: "data-scripts",
    path: "~/work/data-scripts",
    shortPath: "~/work/data-scripts",
    techStack: ["python"],
    suggestions: ["Add CLAUDE.md with project overview", "Add commands for common tasks"],
    exemplarName: "payments-api",
    mcpServers: [],
  },
  {
    key: "legacy-admin",
    name: "legacy-admin",
    path: "~/work/legacy-admin",
    shortPath: "~/work/legacy-admin",
    techStack: ["react"],
    suggestions: ["Add CLAUDE.md", "Add architecture rules"],
    exemplarName: "acme-web",
    mcpServers: [],
  },
  {
    key: "ops-runbooks",
    name: "ops-runbooks",
    path: "~/work/ops-runbooks",
    shortPath: "~/work/ops-runbooks",
    techStack: [],
    suggestions: [],
    exemplarName: "",
    mcpServers: [],
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

function generateDemoHeatmap() {
  const days = [];
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    // Weighted random: more activity on weekdays
    const isWeekday = d.getDay() > 0 && d.getDay() < 6;
    const base = isWeekday ? 8 : 2;
    const messageCount = Math.floor(Math.random() * base * 3);
    if (messageCount > 0) days.push({ date, messageCount });
  }
  return days;
}

function generateDemoHourCounts() {
  const counts = {};
  // Peak at 10am and 2pm
  for (let h = 0; h < 24; h++) {
    const peak = Math.exp(-((h - 10) ** 2) / 18) + Math.exp(-((h - 14) ** 2) / 12);
    counts[String(h)] = Math.round(peak * 120 + Math.random() * 20);
  }
  return counts;
}

export function generateDemoData() {
  const now = new Date();
  const timestamp =
    now
      .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      .toLowerCase() +
    " at " +
    now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();

  const configured = DEMO_CONFIGURED;
  const unconfigured = DEMO_UNCONFIGURED;
  const totalRepos = configured.length + unconfigured.length;

  return {
    configured,
    unconfigured,
    globalCmds: DEMO_GLOBAL_CMDS,
    globalRules: DEMO_GLOBAL_RULES,
    globalSkills: DEMO_GLOBAL_SKILLS,
    chains: [
      { nodes: ["shared-ui", "acme-web", "marketing-site"], arrow: "&rarr;" },
      { nodes: ["payments-api", "acme-web"], arrow: "&rarr;" },
    ],
    mcpSummary: [
      { name: "playwright", type: "stdio", projects: [], userLevel: true, disabledIn: 0 },
      {
        name: "github",
        type: "stdio",
        projects: ["~/work/acme-web", "~/work/payments-api"],
        userLevel: false,
        disabledIn: 0,
      },
      {
        name: "postgres",
        type: "stdio",
        projects: ["~/work/payments-api"],
        userLevel: false,
        disabledIn: 0,
      },
      { name: "sentry", type: "http", projects: [], userLevel: true, disabledIn: 0 },
      {
        name: "figma",
        type: "stdio",
        projects: ["~/work/acme-web"],
        userLevel: false,
        disabledIn: 0,
        recentlyActive: true,
      },
    ],
    mcpPromotions: [{ name: "github", projects: ["~/work/acme-web", "~/work/payments-api"] }],
    formerMcpServers: [
      { name: "redis", projects: ["~/work/cache-service"], lastSeen: null },
      { name: "datadog", projects: [], lastSeen: null },
    ],
    consolidationGroups: [
      {
        stack: "next",
        repos: ["acme-web", "marketing-site"],
        avgSimilarity: 68,
        suggestion: "2 next repos with 68% avg similarity — consider shared global rules",
      },
      {
        stack: "react",
        repos: ["acme-web", "shared-ui", "mobile-app"],
        avgSimilarity: 45,
        suggestion: "3 react repos with 45% avg similarity — consider shared global rules",
      },
    ],
    usageAnalytics: {
      totalSessions: 247,
      topTools: [
        { name: "Read", count: 1842 },
        { name: "Edit", count: 1356 },
        { name: "Bash", count: 987 },
        { name: "Grep", count: 654 },
        { name: "Write", count: 432 },
        { name: "Glob", count: 321 },
        { name: "Agent", count: 198 },
        { name: "WebSearch", count: 87 },
      ],
      topLanguages: [
        { name: "TypeScript", count: 4521 },
        { name: "Python", count: 2103 },
        { name: "JavaScript", count: 1456 },
        { name: "Go", count: 432 },
        { name: "Markdown", count: 321 },
      ],
      errorCategories: [
        { name: "lint_error", count: 45 },
        { name: "type_error", count: 32 },
        { name: "test_failure", count: 28 },
      ],
      heavySessions: 12,
    },
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
    timestamp,
    coveragePct: Math.round((configured.length / totalRepos) * 100),
    totalRepos,
    configuredCount: configured.length,
    unconfiguredCount: unconfigured.length,
    totalRepoCmds: configured.reduce((sum, r) => sum + r.commands.length, 0),
    avgHealth: Math.round(
      configured.reduce((sum, r) => sum + r.healthScore, 0) / configured.length,
    ),
    driftCount: configured.filter((r) => r.drift.level === "medium" || r.drift.level === "high")
      .length,
    mcpCount: 4,
    scanScope: "~/work (depth 5)",
  };
}
