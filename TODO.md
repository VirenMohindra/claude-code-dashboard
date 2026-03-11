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
- [ ] Generate shareable skill catalog page (`--catalog` flag) with install instructions

### Skill Grouping & Categorization

- [x] Auto-categorize skills by keywords in SKILL.md (workflow, code-quality, debugging, research, integrations, project-specific)
- [x] Group skills by category in the dashboard instead of flat alphabetical list
- [x] Visual category indicators (color per category + count badges)

### Data Export

- [x] `--json` flag: dump full data model (repos, commands, rules, skills, chains, stats) as JSON
- [ ] Enables downstream tooling: VS Code extensions, web dashboards, CI integrations, team reports

## v0.3.0 — Recommendations Engine

### Per-Repo Recommendations

- [ ] Detect tech stack per repo (package.json framework, Cargo.toml, go.mod, requirements.txt, etc.)
- [ ] Compare unconfigured repos against best-configured repos with same stack
- [ ] Generate "suggested config" per repo: "this is a Next.js repo — based on superapp/mockly, consider adding: architecture rules, test commands"
- [ ] Show recommendation count in unconfigured repos section (not just names)

### Config Health Score

- [ ] Score each repo's config completeness (0-100): has CLAUDE.md? modular rules? commands? description? freshness?
- [ ] Show score as a small bar or ring in each repo card
- [ ] Surface "quick wins": repos 1 step away from full config (e.g. "has CLAUDE.md but no commands")

### Drift Detection

- [ ] Compare config freshness against repo activity (commits since last config update)
- [ ] Flag repos where config is stale relative to code churn: "sprout-kit-ui config is 45d old but 12 commits have landed"
- [ ] Show drift indicator on repo cards (separate from freshness dot)

## v0.4.0 — Config Templates & Onboarding

### Template System

- [ ] `claude-code-dashboard init --template react` scaffolds CLAUDE.md + .claude/rules/ based on best existing configs
- [ ] Detect common patterns: monolithic CLAUDE.md, modular rules, command-heavy
- [ ] Extract templates from your best-configured repos (mneme, chile, salsa)
- [ ] Templates for: react, next, expo, node-backend, go, python, swift, generic

### Cross-Repo Pattern Detection

- [ ] Detect duplicated config across repos (5 React repos with similar CLAUDE.md → extract shared template)
- [ ] Suggest consolidating into global rules vs repo-specific rules
- [ ] Show "config similarity" between repos

## v0.5.0 — Team & Design Polish

### Design Improvements

- [ ] Light/dark mode toggle
- [ ] Group repos by parent directory or tech stack (toggleable)
- [ ] Collapsible skill categories with counts
- [ ] Full description on hover/expand (no more truncation)
- [ ] Repo-to-skill mapping: "which skills are relevant to this repo?"

### Team Features

- [ ] Org-wide dashboard: scan multiple users' configs (for teams sharing a machine or repo)
- [ ] Export as shareable HTML with anonymized paths
- [ ] Diff view: what changed since last generation (`--diff` flag)
- [ ] Screenshot/demo GIF for README

### CLI Enhancements

- [ ] `--watch` mode: regenerate on file changes
- [ ] `--quiet` mode: suppress output, just write file
- [ ] Config linting: detect contradictions, stale references, missing files
- [ ] Bash/Zsh completion script
