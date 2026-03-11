# Claude Code Dashboard — Roadmap

## v0.1.0 — Foundation (complete)

- [x] Security: `execFileSync`, `&quot;` escaping
- [x] Portability: `os.homedir()`, cross-platform shell
- [x] Robustness: `mkdirSync`, `Number.isFinite()` guard
- [x] Packaging: `package.json`, CLI flags, README, LICENSE, tests
- [x] CI/CD: GitHub Actions (lint, test matrix, dry run)
- [x] Skills support: scan `~/.claude/skills/` for `SKILL.md`

## v0.2.0 — Intelligence Layer (complete)

### Skill Sourcing & Shareability

- [x] Detect skill source: git remote (e.g. `obra/superpowers-skills`), symlink to `.agents/skills/` (skills.sh), or local/custom
- [x] Show source badge per skill ("superpowers", "skills.sh", "custom")
- [x] Link to source repo/URL where possible (GitHub link for git-sourced, skills.sh link for installed)
- [x] Generate shareable skill catalog page (`--catalog` flag) with install instructions

### Skill Grouping & Categorization

- [x] Auto-categorize skills by keywords in SKILL.md (workflow, code-quality, debugging, research, integrations, project-specific)
- [x] Group skills by category in the dashboard instead of flat alphabetical list
- [x] Visual category indicators (color per category + count badges)

### Data Export

- [x] `--json` flag: dump full data model (repos, commands, rules, skills, chains, stats) as JSON
- [x] Enables downstream tooling: VS Code extensions, web dashboards, CI integrations, team reports

## v0.3.0 — Recommendations Engine (complete)

### Per-Repo Recommendations

- [x] Detect tech stack per repo (package.json framework, Cargo.toml, go.mod, requirements.txt, etc.)
- [x] Compare unconfigured repos against best-configured repos with same stack
- [x] Generate "suggested config" per repo: "this is a Next.js repo — based on superapp/mockly, consider adding: architecture rules, test commands"
- [x] Show tech stack in unconfigured repos section (not just names)

### Config Health Score

- [x] Score each repo's config completeness (0-100): has CLAUDE.md? modular rules? commands? description? freshness?
- [x] Show score as a small bar in each repo card
- [x] Surface "quick wins": repos 1 step away from full config (e.g. "has CLAUDE.md but no commands")

### Drift Detection

- [x] Compare config freshness against repo activity (commits since last config update)
- [x] Flag repos where config is stale relative to code churn: "superapp config is 1mo old but 46 commits have landed"
- [x] Show drift indicator on repo cards (separate from freshness dot)

## v0.4.0 — Config Templates & Onboarding (complete)

### Template System

- [x] `claude-code-dashboard init --template react` scaffolds CLAUDE.md based on best existing configs
- [x] Detect common patterns: monolithic CLAUDE.md, modular rules, command-heavy
- [x] Use best-configured repos as exemplars for template selection
- [x] Templates for: react, next, expo, node-backend, go, python, swift, generic

### Cross-Repo Pattern Detection

- [x] Detect duplicated config across repos (5 React repos with similar CLAUDE.md → extract shared template)
- [x] Suggest consolidating into global rules vs repo-specific rules
- [x] Show "config similarity" between repos

## v0.5.0 — Control Center (complete)

### Design Improvements

- [x] Light/dark mode toggle with system preference detection + localStorage persistence
- [x] Group repos by parent directory or tech stack (toggleable dropdown)
- [x] Collapsible skill categories with counts (first open by default)
- [x] Full description on expand (truncated preview hidden when card is open)
- [x] Repo-to-skill mapping: matched skills shown in expanded repo cards

### Team Features

- [ ] Org-wide dashboard: scan multiple users' configs (deferred — needs multi-user architecture)
- [x] Export as shareable HTML with anonymized paths (`--anonymize` flag)
- [x] Diff view: what changed since last generation (`--diff` flag with snapshot persistence)
- [ ] Screenshot/demo GIF for README (manual task)

### CLI Enhancements

- [x] `--watch` mode: regenerate on file changes (debounced, multi-root)
- [x] `--quiet` mode: suppress output, just write file
- [x] Config linting: `lint` subcommand detects TODO markers, missing CLAUDE.md, empty configs
- [x] Bash/Zsh completion script (`--completions` flag)

### New in v0.5.0 (beyond original roadmap)

- [x] MCP server discovery: scans `~/.claude/mcp_config.json` + per-repo `.mcp.json` files
- [x] MCP promotion hints: flags servers installed in 2+ projects but not globally
- [x] MCP disabled server detection from `~/.claude.json`
- [x] Usage analytics: top tools, languages from `~/.claude/usage-data/session-meta/`
- [x] Activity heatmap: GitHub-style daily activity grid from `stats-cache.json`
- [x] Peak hours chart + model usage breakdown
- [x] Quick reference card: slash commands, tools, keyboard shortcuts
