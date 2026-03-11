import { describe, it } from "node:test";
import assert from "node:assert/strict";

// We test the pure functions by importing the module's logic.
// Since the main script runs side effects on import, we extract testable
// functions into this test by re-implementing the pure helpers here and
// verifying they match the expected behavior.

// ── HTML Escaping ────────────────────────────────────────────────────────────

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

describe("esc()", () => {
  it("escapes ampersands", () => {
    assert.equal(esc("a & b"), "a &amp; b");
  });

  it("escapes angle brackets", () => {
    assert.equal(esc("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes double quotes", () => {
    assert.equal(esc('data-name="test"'), "data-name=&quot;test&quot;");
  });

  it("handles all special chars together", () => {
    assert.equal(esc('<a href="x&y">'), "&lt;a href=&quot;x&amp;y&quot;&gt;");
  });

  it("returns empty string for empty input", () => {
    assert.equal(esc(""), "");
  });

  it("passes through safe strings unchanged", () => {
    assert.equal(esc("hello world 123"), "hello world 123");
  });
});

// ── Freshness ────────────────────────────────────────────────────────────────

const ONE_DAY = 86_400;
const TWO_DAYS = 172_800;
const THIRTY_DAYS = 2_592_000;
const NINETY_DAYS = 7_776_000;
const ONE_YEAR = 31_536_000;

function relativeTime(ts) {
  if (!ts) return "unknown";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < ONE_DAY) return "today";
  if (diff < TWO_DAYS) return "yesterday";
  if (diff < THIRTY_DAYS) return `${Math.floor(diff / ONE_DAY)}d ago`;
  if (diff < ONE_YEAR) return `${Math.floor(diff / THIRTY_DAYS)}mo ago`;
  return `${Math.floor(diff / ONE_YEAR)}y ago`;
}

function freshnessClass(ts) {
  if (!ts) return "stale";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < THIRTY_DAYS) return "fresh";
  if (diff < NINETY_DAYS) return "aging";
  return "stale";
}

describe("relativeTime()", () => {
  const now = Math.floor(Date.now() / 1000);

  it("returns 'unknown' for 0", () => {
    assert.equal(relativeTime(0), "unknown");
  });

  it("returns 'today' for recent timestamp", () => {
    assert.equal(relativeTime(now - 3600), "today");
  });

  it("returns 'yesterday' for ~1 day ago", () => {
    assert.equal(relativeTime(now - ONE_DAY - 100), "yesterday");
  });

  it("returns days for < 30 days", () => {
    const result = relativeTime(now - ONE_DAY * 10);
    assert.match(result, /^\d+d ago$/);
  });

  it("returns months for < 1 year", () => {
    const result = relativeTime(now - THIRTY_DAYS * 3);
    assert.match(result, /^\d+mo ago$/);
  });

  it("returns years for > 1 year", () => {
    const result = relativeTime(now - ONE_YEAR * 2);
    assert.match(result, /^\d+y ago$/);
  });
});

describe("freshnessClass()", () => {
  const now = Math.floor(Date.now() / 1000);

  it("returns 'stale' for 0", () => {
    assert.equal(freshnessClass(0), "stale");
  });

  it("returns 'fresh' for recent", () => {
    assert.equal(freshnessClass(now - ONE_DAY), "fresh");
  });

  it("returns 'aging' for 30-90 days", () => {
    assert.equal(freshnessClass(now - THIRTY_DAYS - ONE_DAY), "aging");
  });

  it("returns 'stale' for > 90 days", () => {
    assert.equal(freshnessClass(now - NINETY_DAYS - ONE_DAY), "stale");
  });
});

// ── Markdown Parsing ─────────────────────────────────────────────────────────

// Simulate getDesc logic
function getDesc(content) {
  const lines = content.split("\n");

  if (lines[0] === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") break;
      const m = lines[i].match(/^description:\s*(.+)/);
      if (m) return m[1].trim();
    }
  }

  if (lines[0]?.startsWith("# ")) return lines[0].slice(2);

  for (const l of lines.slice(0, 5)) {
    const t = l.trim();
    if (t && t !== "---" && !t.startsWith("```")) {
      return t.length > 60 ? t.slice(0, 57) + "..." : t;
    }
  }
  return "";
}

describe("getDesc()", () => {
  it("extracts YAML frontmatter description", () => {
    const md = "---\ndescription: My cool tool\n---\n# Title";
    assert.equal(getDesc(md), "My cool tool");
  });

  it("extracts # heading", () => {
    assert.equal(getDesc("# My Project\nSome text"), "My Project");
  });

  it("falls back to first non-empty line", () => {
    assert.equal(getDesc("\n\nSome intro text"), "Some intro text");
  });

  it("truncates long first lines", () => {
    const long = "A".repeat(80);
    const result = getDesc(long);
    assert.equal(result.length, 60);
    assert.ok(result.endsWith("..."));
  });

  it("returns empty for empty content", () => {
    assert.equal(getDesc(""), "");
  });
});

// ── Config Parsing ───────────────────────────────────────────────────────────

function parseChains(content) {
  const chains = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^chain:\s*(.+)/i);
    if (!m) continue;
    const raw = m[1];
    if (raw.includes("<-")) {
      chains.push({ nodes: raw.split(/\s*<-\s*/), arrow: "&larr;" });
    } else {
      chains.push({ nodes: raw.split(/\s*->\s*/), arrow: "&rarr;" });
    }
  }
  return chains;
}

describe("parseChains()", () => {
  it("parses forward chain", () => {
    const result = parseChains("chain: A -> B -> C");
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].nodes, ["A", "B", "C"]);
    assert.equal(result[0].arrow, "&rarr;");
  });

  it("parses backward chain", () => {
    const result = parseChains("chain: X <- Y");
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].nodes, ["X", "Y"]);
    assert.equal(result[0].arrow, "&larr;");
  });

  it("ignores comments and empty lines", () => {
    const result = parseChains("# comment\n\nchain: A -> B");
    assert.equal(result.length, 1);
  });

  it("returns empty for no chains", () => {
    assert.deepEqual(parseChains("# just comments\n~/work"), []);
  });

  it("parses multiple chains", () => {
    const result = parseChains("chain: A -> B\nchain: C <- D");
    assert.equal(result.length, 2);
  });
});

// ── Freshness Parsing ────────────────────────────────────────────────────────

describe("freshness number parsing", () => {
  it("parses valid timestamp", () => {
    const ts = "1710000000";
    const parsed = Number(ts);
    assert.ok(Number.isFinite(parsed));
    assert.equal(parsed, 1710000000);
  });

  it("returns 0 for empty string", () => {
    const ts = "";
    const parsed = Number(ts);
    // Number("") is 0 which is falsy, so the || 0 fallback works
    const result = Number.isFinite(parsed) ? parsed : 0;
    assert.equal(result, 0);
  });

  it("returns 0 for garbage input", () => {
    const ts = "not-a-number";
    const parsed = Number(ts);
    const result = Number.isFinite(parsed) ? parsed : 0;
    assert.equal(result, 0);
  });

  it("returns 0 for NaN", () => {
    const parsed = Number(NaN);
    const result = Number.isFinite(parsed) ? parsed : 0;
    assert.equal(result, 0);
  });
});

// ── Skill Categorization ──────────────────────────────────────────────────────

// NOTE: These must match the SKILL_CATEGORIES in generate-dashboard.mjs exactly.
// If the production categories change, update this copy to match.
const SKILL_CATEGORIES = {
  workflow: ["plan", "workflow", "branch", "commit", "pr-", "review", "ship", "deploy", "execute"],
  "code-quality": ["lint", "test-", "quality", "format", "refactor", "clean", "verify", "tdd"],
  debugging: ["debug", "diagnose", "troubleshoot", "ci-fix", "stack-trace", "breakpoint"],
  research: [
    "research",
    "search",
    "analyze",
    "explore",
    "investigate",
    "compare",
    "competitive",
    "audit",
    "find",
  ],
  integrations: ["slack", "github", "figma", "linear", "jira", "notion", "snowflake", "api", "mcp"],
  "project-specific": ["storybook", "react-native"],
};

function categorizeSkill(name, content) {
  const nameLower = name.toLowerCase();
  const contentLower = content.toLowerCase();
  let bestCategory = "workflow";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(SKILL_CATEGORIES)) {
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

describe("categorizeSkill()", () => {
  it("categorizes debugging skills", () => {
    assert.equal(
      categorizeSkill("systematic-debugging", "Use when encountering any bug"),
      "debugging",
    );
  });

  it("categorizes ci-fix as debugging", () => {
    assert.equal(
      categorizeSkill("ci-fix-loop", "Enforce the 3-attempt rule for CI fix"),
      "debugging",
    );
  });

  it("categorizes research skills", () => {
    assert.equal(
      categorizeSkill("competitive-deep-dive", "Run a structured competitive analysis"),
      "research",
    );
  });

  it("categorizes integration skills", () => {
    assert.equal(categorizeSkill("slack-digest", "Read a Slack channel or thread"), "integrations");
  });

  it("categorizes project-specific skills", () => {
    assert.equal(
      categorizeSkill(
        "writing-react-native-storybook-stories",
        "Create React Native Storybook stories",
      ),
      "project-specific",
    );
  });

  it("categorizes workflow skills", () => {
    assert.equal(categorizeSkill("pr-workflow", "End-to-end PR creation workflow"), "workflow");
  });

  it("categorizes code-quality skills", () => {
    assert.equal(
      categorizeSkill("test-driven-development", "Use when implementing, write test first tdd"),
      "code-quality",
    );
  });

  it("defaults to workflow for ambiguous content", () => {
    assert.equal(categorizeSkill("unknown-skill", "some generic content"), "workflow");
  });

  it("categorizes figma integration", () => {
    assert.equal(
      categorizeSkill("figma-component", "Convert a Figma design to a React component"),
      "integrations",
    );
  });

  it("categorizes session/find skills as research", () => {
    assert.equal(
      categorizeSkill("find-session", "Find and explore past Claude Code sessions"),
      "research",
    );
  });
});

// ── CLI Argument Parsing ────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    output: "default.html",
    open: false,
    json: false,
    catalog: false,
    command: null,
    template: null,
    dryRun: false,
  };
  let i = 2;
  if (argv[2] === "init") {
    args.command = "init";
    i = 3;
  }
  while (i < argv.length) {
    switch (argv[i]) {
      case "--help":
      case "-h":
        args.help = true;
        return args;
      case "--version":
      case "-v":
        args.version = true;
        return args;
      case "--output":
      case "-o":
        args.output = argv[++i];
        break;
      case "--open":
        args.open = true;
        break;
      case "--json":
        args.json = true;
        break;
      case "--catalog":
        args.catalog = true;
        break;
      case "--template":
      case "-t":
        args.template = argv[++i];
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        args.error = argv[i];
        return args;
    }
    i++;
  }
  return args;
}

describe("parseArgs()", () => {
  it("parses --json flag", () => {
    const args = parseArgs(["node", "script", "--json"]);
    assert.equal(args.json, true);
  });

  it("parses --json with --output", () => {
    const args = parseArgs(["node", "script", "--json", "--output", "out.json"]);
    assert.equal(args.json, true);
    assert.equal(args.output, "out.json");
  });

  it("defaults json to false", () => {
    const args = parseArgs(["node", "script"]);
    assert.equal(args.json, false);
  });

  it("parses --open flag", () => {
    const args = parseArgs(["node", "script", "--open"]);
    assert.equal(args.open, true);
  });

  it("parses --catalog flag", () => {
    const args = parseArgs(["node", "script", "--catalog"]);
    assert.equal(args.catalog, true);
  });

  it("defaults catalog to false", () => {
    const args = parseArgs(["node", "script"]);
    assert.equal(args.catalog, false);
  });

  it("handles unknown flags", () => {
    const args = parseArgs(["node", "script", "--bogus"]);
    assert.equal(args.error, "--bogus");
  });

  it("parses init subcommand", () => {
    const args = parseArgs(["node", "script", "init"]);
    assert.equal(args.command, "init");
  });

  it("parses init with --template", () => {
    const args = parseArgs(["node", "script", "init", "--template", "next"]);
    assert.equal(args.command, "init");
    assert.equal(args.template, "next");
  });

  it("returns undefined template when --template has no value", () => {
    const args = parseArgs(["node", "script", "init", "--template"]);
    assert.equal(args.command, "init");
    assert.equal(args.template, undefined);
  });

  it("defaults command to null", () => {
    const args = parseArgs(["node", "script"]);
    assert.equal(args.command, null);
  });

  it("parses init with --dry-run", () => {
    const args = parseArgs(["node", "script", "init", "--dry-run"]);
    assert.equal(args.command, "init");
    assert.equal(args.dryRun, true);
  });
});

// ── Skill Source Badge Rendering ────────────────────────────────────────────

describe("skill source badge rendering", () => {
  function sourceBadgeHtml(source) {
    if (!source) return "";
    switch (source.type) {
      case "superpowers":
        return `<span class="badge source superpowers">superpowers</span>`;
      case "skills.sh": {
        const label = source.repo ? `skills.sh · ${source.repo}` : "skills.sh";
        return `<span class="badge source skillssh">${label}</span>`;
      }
      default:
        return `<span class="badge source custom">custom</span>`;
    }
  }

  it("renders superpowers badge", () => {
    const html = sourceBadgeHtml({ type: "superpowers", repo: "obra/superpowers-skills" });
    assert.ok(html.includes("superpowers"));
    assert.ok(html.includes("badge"));
  });

  it("renders skills.sh badge with repo", () => {
    const html = sourceBadgeHtml({ type: "skills.sh", repo: "storybookjs/react-native" });
    assert.ok(html.includes("skills.sh · storybookjs/react-native"));
  });

  it("renders custom badge", () => {
    const html = sourceBadgeHtml({ type: "custom" });
    assert.ok(html.includes("custom"));
  });

  it("returns empty for null source", () => {
    assert.equal(sourceBadgeHtml(null), "");
  });
});

// ── Config Health Score ─────────────────────────────────────────────────────

function computeHealthScore(repo) {
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

describe("computeHealthScore()", () => {
  it("scores a fully configured repo at 100", () => {
    const result = computeHealthScore({
      hasAgentsFile: true,
      desc: ["some description"],
      commandCount: 3,
      ruleCount: 3,
      sectionCount: 10,
      freshnessClass: "fresh",
    });
    assert.equal(result.score, 100);
    assert.equal(result.reasons.length, 0);
  });

  it("scores an empty repo at 0 with all reasons", () => {
    const result = computeHealthScore({
      hasAgentsFile: false,
      desc: [],
      commandCount: 0,
      ruleCount: 0,
      sectionCount: 0,
      freshnessClass: "stale",
    });
    assert.equal(result.score, 0);
    assert.equal(result.reasons.length, 6);
  });

  it("gives partial credit for commands", () => {
    const one = computeHealthScore({
      hasAgentsFile: false,
      desc: [],
      commandCount: 1,
      ruleCount: 0,
      sectionCount: 0,
      freshnessClass: "stale",
    });
    const two = computeHealthScore({
      hasAgentsFile: false,
      desc: [],
      commandCount: 2,
      ruleCount: 0,
      sectionCount: 0,
      freshnessClass: "stale",
    });
    assert.ok(two.score > one.score);
  });

  it("caps commands at 20 points", () => {
    const result = computeHealthScore({
      hasAgentsFile: false,
      desc: [],
      commandCount: 10,
      ruleCount: 0,
      sectionCount: 0,
      freshnessClass: "stale",
    });
    assert.equal(result.score, 20);
  });

  it("gives 5 points for aging freshness", () => {
    const aging = computeHealthScore({
      hasAgentsFile: false,
      desc: [],
      commandCount: 0,
      ruleCount: 0,
      sectionCount: 0,
      freshnessClass: "aging",
    });
    assert.equal(aging.score, 5);
    assert.ok(aging.reasons.some((r) => r.includes("aging")));
  });

  it("returns quick-win reasons", () => {
    const result = computeHealthScore({
      hasAgentsFile: true,
      desc: ["desc"],
      commandCount: 2,
      ruleCount: 0,
      sectionCount: 5,
      freshnessClass: "fresh",
    });
    assert.ok(result.reasons.includes("add rules"));
    assert.equal(result.reasons.length, 1);
  });
});

// ── Tech Stack Detection ────────────────────────────────────────────────────

// NOTE: This mirrors the production STACK_FILES map in generate-dashboard.mjs.
// The production detectTechStack(repoDir) reads the filesystem; this version
// accepts a Set of filenames and optional deps object for unit testing the
// classification logic without I/O.
const STACK_FILES = {
  "next.config.js": "next",
  "next.config.mjs": "next",
  "next.config.ts": "next",
  "Cargo.toml": "rust",
  "go.mod": "go",
  "requirements.txt": "python",
  "pyproject.toml": "python",
  "setup.py": "python",
  "Package.swift": "swift",
  Gemfile: "ruby",
  "pom.xml": "java",
  "build.gradle": "java",
  "build.gradle.kts": "java",
};

function detectTechStack(fileNames, deps = {}) {
  const entries = new Set(fileNames);
  const stacks = new Set();

  for (const [file, stack] of Object.entries(STACK_FILES)) {
    if (entries.has(file)) stacks.add(stack);
  }

  if (entries.has("package.json")) {
    if (!stacks.has("next") && !stacks.has("expo")) {
      if (deps["expo"]) stacks.add("expo");
      else if (deps["next"]) stacks.add("next");
      else if (deps["react"]) stacks.add("react");
    }
    if (stacks.size === 0) stacks.add("node");
  }

  return [...stacks];
}

describe("detectTechStack()", () => {
  it("detects Next.js from config file", () => {
    const result = detectTechStack(["package.json", "next.config.mjs"]);
    assert.ok(result.includes("next"));
  });

  it("detects Next.js from package.json deps", () => {
    const result = detectTechStack(["package.json"], { next: "14.0.0" });
    assert.ok(result.includes("next"));
  });

  it("detects plain node", () => {
    assert.deepEqual(detectTechStack(["package.json"]), ["node"]);
  });

  it("detects Go", () => {
    assert.deepEqual(detectTechStack(["go.mod"]), ["go"]);
  });

  it("detects Rust", () => {
    assert.deepEqual(detectTechStack(["Cargo.toml"]), ["rust"]);
  });

  it("detects Python from pyproject.toml", () => {
    assert.deepEqual(detectTechStack(["pyproject.toml"]), ["python"]);
  });

  it("detects Swift", () => {
    assert.deepEqual(detectTechStack(["Package.swift"]), ["swift"]);
  });

  it("detects multiple stacks", () => {
    const result = detectTechStack(["Cargo.toml", "go.mod"]);
    assert.ok(result.includes("rust"));
    assert.ok(result.includes("go"));
  });

  it("does not add node when another stack is detected from package.json", () => {
    // go.mod + package.json → go only (not also node)
    const result = detectTechStack(["package.json", "go.mod"]);
    assert.ok(result.includes("go"));
    assert.ok(!result.includes("node"));
  });

  it("returns empty for unknown project", () => {
    assert.deepEqual(detectTechStack(["README.md"]), []);
  });

  it("detects Expo from deps", () => {
    const result = detectTechStack(["package.json"], { expo: "50.0.0" });
    assert.ok(result.includes("expo"));
  });

  it("detects React from deps", () => {
    const result = detectTechStack(["package.json"], { react: "18.0.0" });
    assert.ok(result.includes("react"));
  });

  it("does not false-positive app.json as Expo", () => {
    // app.json alone should not trigger Expo detection
    const result = detectTechStack(["app.json", "package.json"]);
    assert.ok(!result.includes("expo"));
    assert.ok(result.includes("node"));
  });
});

// ── Drift Detection ─────────────────────────────────────────────────────────

// NOTE: The production computeDrift(repoDir, configTimestamp) calls git internally.
// This tests the threshold logic only, using pre-computed commitsSince values.
// The git integration path (rev-list --count, empty string guard, off-by-one)
// is verified via the generation dry run in CI.
function computeDrift(commitsSince) {
  if (commitsSince === 0) return { level: "synced", commitsSince: 0 };
  if (commitsSince <= 5) return { level: "low", commitsSince };
  if (commitsSince <= 20) return { level: "medium", commitsSince };
  return { level: "high", commitsSince };
}

describe("computeDrift()", () => {
  it("returns synced when no commits since config", () => {
    assert.equal(computeDrift(0).level, "synced");
  });

  it("returns low for 1-5 commits", () => {
    assert.equal(computeDrift(3).level, "low");
  });

  it("returns medium for 6-20 commits", () => {
    assert.equal(computeDrift(12).level, "medium");
  });

  it("returns high for 20+ commits", () => {
    assert.equal(computeDrift(45).level, "high");
  });

  it("includes commit count", () => {
    assert.equal(computeDrift(12).commitsSince, 12);
  });
});

// ── Cross-Repo Suggestions ──────────────────────────────────────────────────

// NOTE: These must match the production functions in generate-dashboard.mjs.
// The only divergence is that production reads from the filesystem (repo objects
// built during scanning), while tests pass pre-built objects directly.
function findExemplar(stack, configuredRepos) {
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

function generateSuggestions(exemplar) {
  if (!exemplar) return [];
  const suggestions = [];
  if (exemplar.hasAgentsFile) suggestions.push("add CLAUDE.md");
  if (exemplar.commands?.length > 0)
    suggestions.push(`add commands (${exemplar.name} has ${exemplar.commands.length})`);
  if (exemplar.rules?.length > 0)
    suggestions.push(`add rules (${exemplar.name} has ${exemplar.rules.length})`);
  return suggestions;
}

describe("findExemplar()", () => {
  const repos = [
    { name: "app-a", techStack: ["next"], healthScore: 90 },
    { name: "app-b", techStack: ["next"], healthScore: 60 },
    { name: "app-c", techStack: ["python"], healthScore: 80 },
  ];

  it("finds highest-health repo matching stack", () => {
    const result = findExemplar(["next"], repos);
    assert.equal(result.name, "app-a");
  });

  it("returns null for no stack match", () => {
    assert.equal(findExemplar(["rust"], repos), null);
  });

  it("returns null for empty stack", () => {
    assert.equal(findExemplar([], repos), null);
  });

  it("returns null for null stack", () => {
    assert.equal(findExemplar(null, repos), null);
  });

  it("matches on partial stack overlap", () => {
    const result = findExemplar(["next", "react"], repos);
    assert.equal(result.name, "app-a");
  });

  it("prefers higher overlap over higher health", () => {
    const reposWithOverlap = [
      { name: "broad", techStack: ["next", "react", "node"], healthScore: 70 },
      { name: "narrow", techStack: ["react"], healthScore: 95 },
    ];
    const result = findExemplar(["next", "react", "node"], reposWithOverlap);
    assert.equal(result.name, "broad");
  });
});

describe("generateSuggestions()", () => {
  it("suggests based on exemplar config", () => {
    const result = generateSuggestions({
      name: "salsa",
      hasAgentsFile: true,
      commands: [{ name: "test" }, { name: "lint" }],
      rules: [{ name: "style" }, { name: "arch" }, { name: "security" }],
    });
    assert.ok(result.includes("add CLAUDE.md"));
    assert.ok(result.some((s) => s.includes("commands") && s.includes("2")));
    assert.ok(result.some((s) => s.includes("rules") && s.includes("3")));
  });

  it("returns empty for null exemplar", () => {
    assert.deepEqual(generateSuggestions(null), []);
  });

  it("only suggests what exemplar has", () => {
    const result = generateSuggestions({
      name: "minimal",
      hasAgentsFile: true,
      commands: [],
      rules: [],
    });
    assert.equal(result.length, 1);
    assert.equal(result[0], "add CLAUDE.md");
  });

  it("returns empty when exemplar has nothing", () => {
    const result = generateSuggestions({
      name: "bare",
      hasAgentsFile: false,
      commands: [],
      rules: [],
    });
    assert.deepEqual(result, []);
  });
});

// ── Config Pattern Detection ────────────────────────────────────────────────

function detectConfigPattern(repo) {
  if (repo.rules.length >= 3) return "modular";
  if (repo.sections.length >= 3) return "monolithic";
  if (repo.commands.length >= 2 && repo.sections.length === 0) return "command-heavy";
  return "minimal";
}

describe("detectConfigPattern()", () => {
  it("detects modular pattern", () => {
    assert.equal(detectConfigPattern({ rules: [1, 2, 3], sections: [], commands: [] }), "modular");
  });

  it("detects monolithic pattern", () => {
    assert.equal(
      detectConfigPattern({ rules: [], sections: [1, 2, 3], commands: [] }),
      "monolithic",
    );
  });

  it("detects command-heavy pattern", () => {
    assert.equal(
      detectConfigPattern({ rules: [], sections: [], commands: [1, 2] }),
      "command-heavy",
    );
  });

  it("detects minimal pattern", () => {
    assert.equal(detectConfigPattern({ rules: [], sections: [], commands: [] }), "minimal");
  });

  it("prefers modular over monolithic when both", () => {
    assert.equal(
      detectConfigPattern({ rules: [1, 2, 3], sections: [1, 2, 3], commands: [] }),
      "modular",
    );
  });
});

// ── Config Similarity ───────────────────────────────────────────────────────

function computeConfigSimilarity(repoA, repoB) {
  if (!repoA || !repoB) return 0;
  let matches = 0;
  let total = 0;

  const sectionsA = new Set((repoA.sections || []).map((s) => s.name || s));
  const sectionsB = new Set((repoB.sections || []).map((s) => s.name || s));
  if (sectionsA.size > 0 || sectionsB.size > 0) {
    const intersection = [...sectionsA].filter((s) => sectionsB.has(s)).length;
    const union = new Set([...sectionsA, ...sectionsB]).size;
    matches += intersection;
    total += union;
  }

  const stackA = new Set(repoA.techStack || []);
  const stackB = new Set(repoB.techStack || []);
  if (stackA.size > 0 || stackB.size > 0) {
    const intersection = [...stackA].filter((s) => stackB.has(s)).length;
    const union = new Set([...stackA, ...stackB]).size;
    matches += intersection;
    total += union;
  }

  if (repoA.configPattern && repoA.configPattern === repoB.configPattern) {
    matches += 1;
    total += 1;
  } else {
    total += 1;
  }

  return total > 0 ? Math.round((matches / total) * 100) : 0;
}

describe("computeConfigSimilarity()", () => {
  it("returns 100 for identical repos", () => {
    const repo = {
      sections: ["Architecture", "Commands"],
      techStack: ["next"],
      configPattern: "monolithic",
    };
    assert.equal(computeConfigSimilarity(repo, repo), 100);
  });

  it("returns 0 for completely different repos", () => {
    const a = { sections: ["Architecture"], techStack: ["next"], configPattern: "monolithic" };
    const b = { sections: ["Setup"], techStack: ["python"], configPattern: "modular" };
    assert.equal(computeConfigSimilarity(a, b), 0);
  });

  it("returns partial score for some overlap", () => {
    const a = {
      sections: ["Architecture", "Commands"],
      techStack: ["next"],
      configPattern: "monolithic",
    };
    const b = {
      sections: ["Architecture", "Testing"],
      techStack: ["next"],
      configPattern: "monolithic",
    };
    const score = computeConfigSimilarity(a, b);
    assert.ok(score > 0 && score < 100);
  });

  it("returns 0 for null inputs", () => {
    assert.equal(computeConfigSimilarity(null, {}), 0);
    assert.equal(computeConfigSimilarity({}, null), 0);
  });

  it("handles empty sections and stacks", () => {
    const a = { sections: [], techStack: [], configPattern: "minimal" };
    const b = { sections: [], techStack: [], configPattern: "minimal" };
    assert.equal(computeConfigSimilarity(a, b), 100);
  });
});
