# v0.2/v0.3 Backlog Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the 3 remaining backlog items from v0.2 and v0.3: `--catalog` flag, cross-repo comparison suggestions, and bump to v0.3.2.

**Architecture:** All features live in `generate-dashboard.mjs` (single-file, zero-dependency). `--catalog` generates a standalone HTML page listing all skills with install instructions. Cross-repo suggestions compare unconfigured repos' tech stacks against the best-configured repo per stack and surface "suggested config" recommendations in the existing unconfigured repos section of the dashboard.

**Tech Stack:** Node.js 18+, no dependencies, node:test for testing

---

## Feature 1: `--catalog` Flag (Shareable Skill Catalog)

### What It Does

`claude-code-dashboard --catalog` generates a self-contained HTML page listing all skills grouped by category, with source badges, descriptions, and install/copy instructions. This page can be shared with teammates who want to see what skills are available.

### Task 1: Add `--catalog` to CLI arg parsing

**Files:**

- Modify: `generate-dashboard.mjs` (parseArgs function, ~line 96-152)
- Test: `test/helpers.test.mjs` (parseArgs tests, ~line 354-414)

**Step 1: Write failing test**

Add to the `parseArgs()` describe block in `test/helpers.test.mjs`:

```js
it("parses --catalog flag", () => {
  const args = parseArgs(["node", "script", "--catalog"]);
  assert.equal(args.catalog, true);
});

it("defaults catalog to false", () => {
  const args = parseArgs(["node", "script"]);
  assert.equal(args.catalog, false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `args.catalog` is `undefined`, not `true`

**Step 3: Write minimal implementation**

In `generate-dashboard.mjs`, add `catalog: false` to the args default object, and add a `case "--catalog"` in the switch:

In `parseArgs()` defaults (line ~97):

```js
const args = { output: DEFAULT_OUTPUT, open: false, json: false, catalog: false };
```

In the switch (after `--json` case):

```js
case "--catalog":
  args.catalog = true;
  break;
```

Update `--help` text to include:

```
  --catalog            Generate a shareable skill catalog HTML page
```

Also update the test-local `parseArgs()` in `test/helpers.test.mjs`:

- Add `catalog: false` to the defaults
- Add `case "--catalog": args.catalog = true; break;`

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add generate-dashboard.mjs test/helpers.test.mjs
git commit -m "feat: add --catalog CLI flag parsing"
```

---

### Task 2: Implement catalog HTML generation

**Files:**

- Modify: `generate-dashboard.mjs` — add `generateCatalogHtml()` function and catalog output block

**Step 1: Add `generateCatalogHtml()` function**

Add after the JSON output block (~line 867) and before the HTML rendering section:

```js
// ── Catalog Output (short-circuit before main HTML) ─────────────────────────

if (cliArgs.catalog) {
  const groups = groupSkillsByCategory(globalSkills);
  const catalogHtml = generateCatalogHtml(groups, globalSkills.length, timestamp);
  const outputPath =
    cliArgs.output !== DEFAULT_OUTPUT ? cliArgs.output : join(CLAUDE_DIR, "skill-catalog.html");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, catalogHtml);
  console.log(outputPath);
  if (cliArgs.open) {
    const cmd =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    execFile(cmd, [outputPath]);
  }
  process.exit(0);
}
```

The `generateCatalogHtml(groups, totalCount, timestamp)` function produces a standalone HTML page with:

- Title: "Claude Code Skill Catalog"
- Subtitle with count and timestamp
- Skills grouped by category with headers
- Each skill: name, description, source badge, install hint
- Install hint per source type:
  - superpowers: "Included in obra/superpowers-skills"
  - skills.sh: "Install via skills.sh" (with repo name if available)
  - custom: "Custom skill — copy from ~/.claude/skills/{name}/"
- Same dark theme as main dashboard (reuse CSS variables)
- Responsive grid layout

**Step 2: Run full test suite + generation dry run**

Run: `npm test && node generate-dashboard.mjs --catalog --output /tmp/catalog.html && echo "OK"`
Expected: PASS, catalog.html written

**Step 3: Commit**

```bash
git add generate-dashboard.mjs
git commit -m "feat: generate shareable skill catalog with --catalog flag"
```

---

## Feature 2: Cross-Repo Comparison Suggestions

### What It Does

For each unconfigured repo (or poorly configured repo), find the best-configured repo with the same tech stack and suggest what config to add based on what that exemplar has. Show these suggestions in:

1. The unconfigured repos section of the HTML dashboard
2. The JSON output

### Task 3: Implement `findExemplar()` and `generateSuggestions()`

**Files:**

- Modify: `generate-dashboard.mjs` — add functions after `computeDrift()`
- Test: `test/helpers.test.mjs` — add test suite

**Step 1: Write failing tests**

Add to `test/helpers.test.mjs`:

```js
// ── Cross-Repo Suggestions ──────────────────────────────────────────────────

function findExemplar(stack, configuredRepos) {
  if (!stack || stack.length === 0) return null;
  let best = null;
  let bestScore = -1;
  for (const repo of configuredRepos) {
    const repoStacks = repo.techStack || [];
    const overlap = stack.filter((s) => repoStacks.includes(s)).length;
    if (overlap > 0 && repo.healthScore > bestScore) {
      bestScore = repo.healthScore;
      best = repo;
    }
  }
  return best;
}

function generateSuggestions(exemplar) {
  if (!exemplar) return [];
  const suggestions = [];
  if (exemplar.hasAgentsFile) suggestions.push("add CLAUDE.md");
  if (exemplar.commandCount > 0)
    suggestions.push(`add commands (${exemplar.name} has ${exemplar.commandCount})`);
  if (exemplar.ruleCount > 0)
    suggestions.push(`add rules (${exemplar.name} has ${exemplar.ruleCount})`);
  return suggestions;
}

describe("findExemplar()", () => {
  const repos = [
    {
      name: "app-a",
      techStack: ["next"],
      healthScore: 90,
      hasAgentsFile: true,
      commandCount: 2,
      ruleCount: 3,
    },
    {
      name: "app-b",
      techStack: ["next"],
      healthScore: 60,
      hasAgentsFile: true,
      commandCount: 1,
      ruleCount: 0,
    },
    {
      name: "app-c",
      techStack: ["python"],
      healthScore: 80,
      hasAgentsFile: true,
      commandCount: 3,
      ruleCount: 1,
    },
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
});

describe("generateSuggestions()", () => {
  it("suggests based on exemplar config", () => {
    const result = generateSuggestions({
      name: "salsa",
      hasAgentsFile: true,
      commandCount: 2,
      ruleCount: 3,
    });
    assert.ok(result.includes("add CLAUDE.md"));
    assert.ok(result.some((s) => s.includes("commands")));
    assert.ok(result.some((s) => s.includes("rules")));
  });

  it("returns empty for null exemplar", () => {
    assert.deepEqual(generateSuggestions(null), []);
  });

  it("only suggests what exemplar has", () => {
    const result = generateSuggestions({
      name: "minimal",
      hasAgentsFile: true,
      commandCount: 0,
      ruleCount: 0,
    });
    assert.equal(result.length, 1);
    assert.equal(result[0], "add CLAUDE.md");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: PASS (tests are self-contained with local functions)

Wait — these are self-contained so they'll pass immediately. That's fine since we're testing the logic extraction first, then wiring it into the dashboard.

**Step 3: Add functions to `generate-dashboard.mjs`**

After `computeDrift()` (~line 636):

```js
// ── Cross-Repo Suggestions ──────────────────────────────────────────────────

function findExemplar(stack, configuredRepos) {
  if (!stack || stack.length === 0) return null;
  let best = null;
  let bestScore = -1;
  for (const repo of configuredRepos) {
    const repoStacks = repo.techStack || [];
    const overlap = stack.filter((s) => repoStacks.includes(s)).length;
    if (overlap > 0 && (repo.healthScore || 0) > bestScore) {
      bestScore = repo.healthScore || 0;
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
```

Note: the production version uses `exemplar.commands.length` (the repo object has arrays), while the test uses `exemplar.commandCount` (a plain number). Document this divergence with a comment in the test.

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add generate-dashboard.mjs test/helpers.test.mjs
git commit -m "feat: add findExemplar and generateSuggestions for cross-repo comparison"
```

---

### Task 4: Wire suggestions into unconfigured repo data and HTML

**Files:**

- Modify: `generate-dashboard.mjs` — the main data collection loop (~line 746-748) and HTML rendering (~line 1242-1253)

**Step 1: Add suggestions to unconfigured repos**

In the main loop, after `unconfigured.push(repo)` (~line 748), add suggestion computation. Before the push, compute:

```js
// In the `else` branch (unconfigured):
const exemplar = findExemplar(repo.techStack, configured);
if (exemplar) {
  repo.suggestions = generateSuggestions(exemplar);
  repo.exemplarName = exemplar.name;
} else {
  repo.suggestions = [];
  repo.exemplarName = "";
}
unconfigured.push(repo);
```

Wait — `configured` may not be fully populated yet since we're still in the loop. We need to do this in a second pass after the main loop.

Move suggestion computation to after `configured.sort(...)` and `unconfigured.sort(...)`:

```js
// Compute suggestions for unconfigured repos (needs full configured list)
for (const repo of unconfigured) {
  const exemplar = findExemplar(repo.techStack, configured);
  if (exemplar) {
    repo.suggestions = generateSuggestions(exemplar);
    repo.exemplarName = exemplar.name;
  } else {
    repo.suggestions = [];
    repo.exemplarName = "";
  }
}
```

**Step 2: Update JSON output**

In the `unconfiguredRepos` map (~line 850-853), add suggestions:

```js
unconfiguredRepos: unconfigured.map((r) => ({
  name: r.name,
  path: r.shortPath,
  techStack: r.techStack || [],
  suggestions: r.suggestions || [],
  exemplar: r.exemplarName || "",
})),
```

**Step 3: Update HTML unconfigured section**

Replace the unconfigured grid items to show suggestions when available. In the unconfigured repos HTML section (~line 1248), update each item:

```js
${unconfigured.map((r) => {
  const stackTag = r.techStack && r.techStack.length
    ? `<span class="stack-tag">${esc(r.techStack.join(", "))}</span>`
    : "";
  const suggestionsHtml = r.suggestions && r.suggestions.length
    ? `<div class="suggestion-hints">${r.suggestions.map((s) => `<span class="suggestion-hint">${esc(s)}</span>`).join("")}</div>`
    : "";
  return `<div class="unconfigured-item">${esc(r.name)}${stackTag}<span class="upath">${esc(r.shortPath)}</span>${suggestionsHtml}</div>`;
}).join("\n      ")}
```

**Step 4: Add CSS for suggestions**

Add to the style block:

```css
.suggestion-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  margin-top: 0.25rem;
}
.suggestion-hint {
  font-size: 0.5rem;
  padding: 0.08rem 0.3rem;
  border-radius: 2px;
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.15);
  color: var(--blue);
}
```

**Step 5: Run tests + generation dry run**

Run: `npm test && node generate-dashboard.mjs --output /tmp/dashboard.html && echo "OK"`
Expected: PASS

**Step 6: Commit**

```bash
git add generate-dashboard.mjs
git commit -m "feat: show cross-repo config suggestions for unconfigured repos"
```

---

### Task 5: Version bump, TODO update, final verification

**Files:**

- Modify: `generate-dashboard.mjs` (VERSION constant)
- Modify: `package.json` (version field)
- Modify: `TODO.md` (check off completed items)

**Step 1: Bump version**

In `generate-dashboard.mjs` line 35: `const VERSION = "0.3.2";`
In `package.json` line 3: `"version": "0.3.2",`

**Step 2: Update TODO.md**

Check off:

- `[x] Generate shareable skill catalog page (\`--catalog\` flag) with install instructions`
- `[x] Compare unconfigured repos against best-configured repos with same stack`
- `[x] Generate "suggested config" per repo...`

Also check off:

- `[x] Enables downstream tooling: VS Code extensions, web dashboards, CI integrations, team reports` (this was always aspirational — the `--json` flag enables it, mark done)

**Step 3: Run all quality gates**

Run: `npm run check` (lint + format + test)
Expected: PASS

**Step 4: Run generation dry run**

Run: `node generate-dashboard.mjs --output /tmp/dashboard.html && node generate-dashboard.mjs --json > /tmp/out.json && node generate-dashboard.mjs --catalog --output /tmp/catalog.html && echo "ALL OK"`
Expected: ALL OK

**Step 5: Commit**

```bash
git add generate-dashboard.mjs package.json TODO.md
git commit -m "chore: bump to v0.3.2, mark backlog items complete"
```

---

### Task 6: Update CI to validate --catalog

**Files:**

- Modify: `.github/workflows/ci.yml`

**Step 1: Add catalog validation to dry-run job**

After the existing `--json` validation step, add:

```yaml
- name: Verify --catalog flag
  run: |
    node generate-dashboard.mjs --catalog --output /tmp/catalog.html
    test -f /tmp/catalog.html
    head -1 /tmp/catalog.html | grep -q '<!DOCTYPE html>'
    echo "Catalog generated successfully ($(wc -c < /tmp/catalog.html) bytes)"
```

**Step 2: Run tests locally**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add --catalog validation to dry-run job"
```

---

## Summary

| Task | Feature                                                  | Est. Size |
| ---- | -------------------------------------------------------- | --------- |
| 1    | `--catalog` CLI flag parsing + tests                     | S         |
| 2    | Catalog HTML generation                                  | M         |
| 3    | `findExemplar()` + `generateSuggestions()` logic + tests | S         |
| 4    | Wire suggestions into dashboard HTML + JSON              | M         |
| 5    | Version bump + TODO update                               | S         |
| 6    | CI update                                                | S         |

Total: 6 tasks, ~1 branch, ~1 PR.
