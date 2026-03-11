# Pipeline Parity: Demo Uses Same Processing as Production

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `--demo` flow through the same processing pipeline as production so any change to processing logic automatically applies to demo output.

**Architecture:** Extract the 700-line inline processing pipeline from `generate-dashboard.mjs` into a pure function `buildDashboardData(scannedInputs)` in a new `src/pipeline.mjs`. Both production (after filesystem scan) and demo (from mock raw data) call this same function. Demo provides "raw scanned" shape — the same shape the filesystem scan produces — not pre-baked final output.

**Tech Stack:** Node.js ESM, node:test

---

## Current State

```
PROD:  filesystem scan → 700 lines of inline processing → generateDashboardHtml()
DEMO:  generateDemoData() returns pre-baked final object → generateDashboardHtml()
```

Demo bypasses ALL processing: health scoring, drift detection, similarity computation, MCP aggregation, insight generation, date formatting, isDiff detection, consolidation grouping, stats computation.

## Target State

```
PROD:  filesystem scan → collectRawInputs() → buildDashboardData() → generateDashboardHtml()
DEMO:  generateDemoRawInputs()              → buildDashboardData() → generateDashboardHtml()
```

Both paths converge at `buildDashboardData()`. Zero divergence.

## Raw Input Shape

The "scanned inputs" object that both paths produce:

```javascript
{
  // Repos with filesystem-level data (pre-processing)
  repos: [{
    name, path, shortPath,
    commands: [{ name, desc, filepath }],
    rules: [{ name, desc, filepath }],
    agentsFile: string|null,     // path to AGENTS.md/CLAUDE.md (or null)
    desc: string[],              // extracted from agentsFile
    sections: [{ name, preview }], // extracted from agentsFile
    techStack: string[],         // detected from filesystem
    freshness: number,           // unix timestamp from git log
    gitRevCount: number,         // commits since config update (for drift)
  }],

  // Global config
  globalCmds: [{ name, desc, filepath }],
  globalRules: [{ name, desc, filepath }],
  globalSkills: [{ name, desc, filepath, source, category }],

  // MCP raw data
  userMcpServers: [{ name, type, scope, source }],
  projectMcpByRepo: { [repoPath]: [{ name, type, scope, source }] },
  disabledMcpByRepo: { [path]: string[] },
  historicalMcpMap: Map,  // from scanHistoricalMcpServers

  // Usage raw data
  sessionMetaFiles: object[],   // parsed JSON from session-meta/*.json
  ccusageData: object|null,     // from ccusage --json or cache
  statsCache: object,           // from stats-cache.json
  insightsReportHtml: string|null, // raw HTML from report.html

  // Config
  chains: [{ nodes, arrow }],   // from dashboard.conf
  scanScope: string,
}
```

Processing (`buildDashboardData`) then computes: freshness text/class, health scores, drift levels, similarity, matched skills, consolidation groups, MCP aggregation/promotions, usage analytics, insights report parsing, insight generation, summary stats.

---

### Task 1: Create `src/pipeline.mjs` with `buildDashboardData()`

**Files:**

- Create: `src/pipeline.mjs`
- Test: `test/pipeline.test.mjs`

**Step 1: Write a minimal failing test**

```javascript
// test/pipeline.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDashboardData } from "../src/pipeline.mjs";

describe("buildDashboardData()", () => {
  it("returns valid dashboard data from minimal raw inputs", () => {
    const raw = {
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
    };
    const data = buildDashboardData(raw);
    assert.ok(data.configured);
    assert.ok(data.unconfigured);
    assert.ok(data.insights);
    assert.equal(data.totalRepos, 0);
    assert.equal(data.coveragePct, 0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/pipeline.test.mjs`
Expected: FAIL with "Cannot find module" or "buildDashboardData is not a function"

**Step 3: Create `src/pipeline.mjs` — extract processing from `generate-dashboard.mjs`**

Move lines 109-670 from `generate-dashboard.mjs` into a single exported function. The function receives the raw input shape and returns the final data object that `generateDashboardHtml()` expects.

Key transformations to extract:

1. **Repo classification** (lines 109-185): Split repos into configured/unconfigured, compute freshness, health, drift, sort
2. **Cross-repo analysis** (lines 189-242): Suggestions, similarity, skill matching, consolidation
3. **MCP aggregation** (lines 262-382): Merge servers, find promotions, classify historical
4. **Usage analytics** (line 407): `aggregateSessionMeta()`
5. **Insights report parsing** (lines 444-507): Parse HTML, reformat dates, detect isDiff
6. **Stats supplementation** (lines 520-554): Fill heatmap gaps from session-meta + ccusage
7. **Summary stats** (lines 556-570): Coverage, avg health, drift count
8. **Insight generation** (lines 571-670): Generate insights array from processed data
9. **Timestamp** (lines 672-678): Generate formatted timestamp

The function signature:

```javascript
export function buildDashboardData(raw) {
  // ... all processing ...
  return {
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
    usageAnalytics,
    ccusageData,
    statsCache,
    timestamp,
    coveragePct,
    totalRepos,
    configuredCount,
    unconfiguredCount,
    totalRepoCmds,
    avgHealth,
    driftCount,
    mcpCount,
    scanScope,
    insights,
    insightsReport,
  };
}
```

Important notes for the extraction:

- `detectTechStack(repoDir)` currently does filesystem I/O. In the new model, `techStack` is pre-collected in the raw input (production scan does the I/O, demo hardcodes it). So pipeline receives `repo.techStack` already populated.
- `computeDrift(repoDir, freshness)` currently runs `git rev-list`. In the new model, raw input provides `repo.gitRevCount` (the commit count). Extract the level-classification logic from `computeDrift` into a pure function that takes the count.
- `getFreshness(repoDir)` currently runs `git log`. In the new model, raw input provides `repo.freshness` as a timestamp.
- The `parseChains()` function reads `CONF` file — move this to the scan phase. Raw input provides `chains` already parsed.
- For `scanHistoricalMcpServers()` — this does filesystem I/O. Raw input provides the result as `historicalMcpMap`.

**Step 4: Run test to verify it passes**

Run: `node --test test/pipeline.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pipeline.mjs test/pipeline.test.mjs
git commit -m "feat: extract processing pipeline into buildDashboardData()"
```

---

### Task 2: Add comprehensive pipeline tests

**Files:**

- Modify: `test/pipeline.test.mjs`

**Step 1: Add tests for each processing stage**

Test that `buildDashboardData` correctly:

1. Classifies repos as configured vs unconfigured based on having commands/rules/agentsFile
2. Computes freshness text and class from timestamp
3. Computes health scores from repo shape
4. Computes drift level from `gitRevCount`
5. Sorts configured repos by richness
6. Generates suggestions for unconfigured repos
7. Computes similarity between configured repos
8. Matches skills to repos
9. Detects consolidation opportunities
10. Aggregates MCP servers and finds promotions
11. Parses insights report HTML (date reformatting, isDiff detection)
12. Generates insights from processed data
13. Computes summary stats (coverage, avg health, drift count)

Use a "full demo" raw input fixture that exercises all paths — this is the data that `generateDemoRawInputs()` will return in Task 4.

**Step 2: Run tests**

Run: `node --test test/pipeline.test.mjs`
Expected: All PASS

**Step 3: Commit**

```bash
git add test/pipeline.test.mjs
git commit -m "test: comprehensive pipeline processing tests"
```

---

### Task 3: Refactor `generate-dashboard.mjs` to use pipeline

**Files:**

- Modify: `generate-dashboard.mjs`
- Modify: `src/pipeline.mjs` (if needed)

**Step 1: Replace inline processing with `buildDashboardData()` call**

The production path in `generate-dashboard.mjs` becomes:

```javascript
// ── Collect Raw Inputs ──────────────────────────────────────
const rawInputs = collectRawInputs(cliArgs); // all filesystem I/O here

// ── Process ─────────────────────────────────────────────────
const data = buildDashboardData(rawInputs);

// ── Generate HTML ───────────────────────────────────────────
const html = generateDashboardHtml(data);
```

The `collectRawInputs()` function (can be inline or extracted) does:

- `findGitRepos()`, `scanMdDir()`, `scanSkillsDir()`
- For each repo: read AGENTS.md/CLAUDE.md, scan commands/rules, detect tech stack, get freshness, count commits
- Read MCP configs, session meta, stats cache, insights report HTML, ccusage
- Parse chains from dashboard.conf

It returns the raw input shape defined above.

**Critical:** The `lint`, `diff`, `json`, `catalog`, and `anonymize` subcommands also use the processed data. They need to work with the pipeline output too. Check that:

- `lint` subcommand (line 684) uses `configured` from pipeline output
- `diff` subcommand (line 706) uses `configured` from pipeline output
- `json` output (line 750) uses all pipeline outputs
- `anonymize` (line 733) uses pipeline outputs
- `catalog` (line 836) uses `globalSkills` and `timestamp` from pipeline

**Step 2: Run full test suite**

Run: `npm test`
Expected: All 180 tests pass

**Step 3: Run generation with real data**

Run: `node generate-dashboard.mjs --output /tmp/pipeline-test.html`
Expected: Dashboard generates correctly, visually identical to before

**Step 4: Run generation with demo data**

Run: `node generate-dashboard.mjs --demo --output /tmp/pipeline-demo.html`
Expected: Still works (demo path not changed yet — that's Task 4)

**Step 5: Verify other subcommands**

```bash
node generate-dashboard.mjs --json | head -5
node generate-dashboard.mjs lint
node generate-dashboard.mjs --version
```

**Step 6: Commit**

```bash
git add generate-dashboard.mjs src/pipeline.mjs
git commit -m "refactor: production path uses buildDashboardData() pipeline"
```

---

### Task 4: Rewrite demo to provide raw inputs

**Files:**

- Modify: `src/demo.mjs`
- Modify: `generate-dashboard.mjs` (demo branch)

**Step 1: Rewrite `generateDemoData()` → `generateDemoRawInputs()`**

Instead of returning a pre-baked final data object, return the raw input shape. Key changes:

- Repos: Remove `healthScore`, `healthReasons`, `freshnessText`, `freshnessClass`, `configPattern`, `drift`, `similarRepos`, `matchedSkills` — these get computed by the pipeline
- Repos: Add `agentsFile` (truthy string or null), `gitRevCount` (integer)
- Repos: Keep `freshness` (timestamp), `techStack`, `commands`, `rules`, `desc`, `sections`
- Remove: `insights`, `insightsReport`, `mcpSummary`, `mcpPromotions`, `formerMcpServers`, `consolidationGroups`, `usageAnalytics`, `ccusageData`, summary stats
- Add: `userMcpServers`, `projectMcpByRepo`, `disabledMcpByRepo`, `historicalMcpMap`, `sessionMetaFiles`, `insightsReportHtml` (a small fake HTML string), `statsCache`

For `insightsReportHtml`, provide a small HTML snippet matching the structure of `/insights` output:

```javascript
const insightsReportHtml = `
<p class="subtitle">1,386 messages across 117 sessions (365 total) | 2026-02-23 to 2026-03-10</p>
<div class="stat-value">1,386</div><div class="stat-label">Messages</div>
<div class="stat-value">+33,424/-2,563</div><div class="stat-label">Lines</div>
...
<div class="glance-section"><strong>What's working:</strong> Full end-to-end...<a class="see-more"...
`;
```

This way the pipeline's regex parsing, date reformatting, and isDiff detection all run on it — same code path as production.

**Step 2: Update demo branch in `generate-dashboard.mjs`**

```javascript
if (cliArgs.demo) {
  const rawInputs = generateDemoRawInputs();
  const data = buildDashboardData(rawInputs);
  const html = generateDashboardHtml(data);
  // ... write + open ...
}
```

**Step 3: Run demo and verify output**

Run: `node generate-dashboard.mjs --demo --output /tmp/demo-parity.html`
Expected: Dashboard looks the same as before, BUT:

- Dates in insights report are reformatted (by pipeline)
- Diff stat has green/red coloring (isDiff detected by pipeline)
- Insights are generated from actual data (by pipeline)
- Health scores are computed (by pipeline)

**Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/demo.mjs generate-dashboard.mjs
git commit -m "feat: demo uses same processing pipeline as production"
```

---

### Task 5: Handle `computeDrift` I/O decoupling

**Files:**

- Modify: `src/analysis.mjs`

**Step 1: Check current `computeDrift` signature**

Currently: `computeDrift(repoDir, freshness)` — runs `git rev-list --count`.

**Step 2: Add a pure variant**

Add `classifyDrift(commitCount)` that takes a number and returns `{ level, commitsSince }`. This is what the pipeline calls. The existing `computeDrift` can call this internally after getting the count from git.

```javascript
export function classifyDrift(commitCount) {
  const n = Number(commitCount) || 0;
  if (n === 0) return { level: "synced", commitsSince: 0 };
  if (n <= 5) return { level: "low", commitsSince: n };
  if (n <= 20) return { level: "medium", commitsSince: n };
  return { level: "high", commitsSince: n };
}
```

**Step 3: Pipeline uses `classifyDrift(repo.gitRevCount)` instead of `computeDrift(repoDir, ...)`**

**Step 4: Run tests**

Run: `npm test`
Expected: All pass (existing computeDrift tests still pass, new classifyDrift works)

**Step 5: Commit**

```bash
git add src/analysis.mjs src/pipeline.mjs
git commit -m "refactor: decouple drift classification from git I/O"
```

---

### Task 6: Final verification and cleanup

**Files:**

- Modify: `test/assembler.test.mjs` (if needed)
- Delete: stale demo data fixtures (if any)

**Step 1: Run all quality gates**

```bash
npm test
npx eslint .
npx prettier --check .
```

**Step 2: Generate both modes and compare**

```bash
node generate-dashboard.mjs --output /tmp/prod.html
node generate-dashboard.mjs --demo --output /tmp/demo.html
```

Verify both produce valid dashboards. Open in browser and spot-check:

- Insights report: dates are readable, diff stat is colored
- Insights card: generated from actual data, not hardcoded
- Health scores: computed, not hardcoded (values may differ slightly from old demo)
- Repo cards: freshness text, drift indicators all computed

**Step 3: Run other subcommands with demo**

```bash
node generate-dashboard.mjs --demo --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['stats'])"
```

**Step 4: Commit any remaining fixes**

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: pipeline parity cleanup and verification"
```

---

## Risk Notes

- **Demo output will change**: Health scores, drift levels, insights text will differ from the current hardcoded values since they're now computed. This is correct — the point is that they're computed the same way as production.
- **I/O boundary is critical**: `buildDashboardData()` must be pure computation — no `readFileSync`, no `execFileSync`, no `existsSync`. All I/O happens before it's called.
- **Backward compat for `--json`**: The JSON output shape should remain the same since it's derived from the same pipeline output.
- **`computeDrift` refactor**: The existing function can remain for direct use in production scan, but pipeline uses the pure `classifyDrift`.
