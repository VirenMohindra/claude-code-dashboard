# Documentation

Detailed reference for [claude-code-dashboard](./README.md).

## What it scans

| Path                                 | What it shows                        |
| ------------------------------------ | ------------------------------------ |
| `CLAUDE.md` / `AGENTS.md`            | Project description, config sections |
| `.claude/commands/*.md`              | Custom slash commands                |
| `.claude/rules/*.md`                 | Custom rules                         |
| `.mcp.json`                          | Project MCP server config            |
| `package.json`                       | Tech stack detection                 |
| `~/.claude/commands/*.md`            | Global commands                      |
| `~/.claude/rules/*.md`               | Global rules                         |
| `~/.claude/skills/*/SKILL.md`        | Skills (with source detection)       |
| `~/.claude/mcp_config.json`          | Global MCP server config             |
| `~/.claude.json`                     | Disabled MCP servers                 |
| `~/.claude/usage-data/session-meta/` | Usage analytics                      |
| `~/.claude/stats-cache.json`         | Activity heatmap data                |

## Tab reference

### Home

Actionable content — what needs your attention right now.

- **Insights** — config drift warnings, unconfigured repo candidates, MCP promotion hints, health quick wins
- **MCP Recommendations** — servers from the Anthropic registry matched to your tech stacks, with one-click install commands
- **Dependency chains** — visualize repo relationships defined in `dashboard.conf`
- **Consolidation opportunities** — repos with similar configs that could share configuration

The "copy as prompt" button generates a structured prompt you can paste directly into Claude Code. Each insight type produces targeted instructions with repo names, install commands, and step-by-step actions.

### Config

Your full Claude Code setup as stable reference.

- **Global commands** — all slash commands from `~/.claude/commands/`
- **Global rules** — all rules from `~/.claude/rules/`
- **Skills** — auto-categorized by type (workflow, debugging, integrations, etc.) with source detection (superpowers, skills.sh, custom)
- **MCP servers** — installed servers with scope badges (global/project/recent), promotion hints, and the full available registry

### Analytics

How you use Claude Code, with data from session metadata and [ccusage](https://github.com/ryoppippi/ccusage).

- **Insights report** — personalized analysis from `/insights` (run it in Claude Code to generate)
- **Top tools & languages** — bar charts from session metadata
- **Activity heatmap** — GitHub-style daily activity grid
- **Peak hours** — when you use Claude Code most
- **Model usage & cost** — token breakdown by model

### Repos

Searchable grid of every configured repo.

- **Health scores** — 0-100 config completeness with color coding and specific improvement suggestions
- **Freshness indicators** — green/yellow/red dots based on how recently config was updated
- **Config pattern detection** — identifies modular, monolithic, command-heavy, or minimal styles
- **Cross-repo similarity** — finds repos with similar configs for potential consolidation
- **Search** — filter by name, path, or content (`/` to focus, `Esc` to clear)
- **Group by** — organize by tech stack or parent directory
- **Unconfigured repos** — collapsible list with tech stack detection and setup suggestions

### Reference

Quick-reference card with built-in Claude Code commands, tools, and keyboard shortcuts.

## Intelligence features

### Health scores

Each repo gets a 0-100 score based on config completeness:

- Has CLAUDE.md or AGENTS.md
- Has custom commands
- Has custom rules
- Config has been updated recently (not stale)
- Uses modular config pattern (commands + rules in `.claude/`)

### Tech stack detection

Auto-detects from project files: Next.js, React, Vue, Angular, Svelte, Python, Go, Rust, Java, Swift, Expo, Electron, and more.

### Drift detection

Compares the last-modified date of config files against recent commit activity. Repos where code has changed significantly since the last config update are flagged as "drifting."

### MCP registry integration

Fetches the Anthropic MCP server registry (cached for 24 hours) and recommends servers based on:

- Tech stacks detected across your repos (e.g., Next.js repos trigger Vercel recommendation)
- Keywords found in repo descriptions (e.g., "stripe" triggers Stripe recommendation)

Already-installed servers are excluded from recommendations.

## CLI reference

```sh
# Core
claude-code-dashboard                        # Generate dashboard
claude-code-dashboard --open                 # Generate and open in browser
claude-code-dashboard --output ~/path.html   # Custom output path
claude-code-dashboard --watch                # Regenerate on config changes
claude-code-dashboard --quiet                # Suppress terminal output

# Export
claude-code-dashboard --json                 # Export data model as JSON
claude-code-dashboard --anonymize            # Strip identifying paths
claude-code-dashboard --diff                 # Show changes since last run

# Features
claude-code-dashboard --catalog              # Generate shareable skill catalog
claude-code-dashboard --demo                 # Generate with sample data
claude-code-dashboard --offline              # Skip MCP registry fetch

# Subcommands
claude-code-dashboard init                   # Scaffold CLAUDE.md for current repo
claude-code-dashboard init --dry-run         # Preview without writing
claude-code-dashboard init --template generic  # Use specific template
claude-code-dashboard lint                   # Lint all repo configs

# Meta
claude-code-dashboard --version              # Print version
claude-code-dashboard --help                 # Print help
claude-code-dashboard --completions >> ~/.zshrc  # Shell completions
```

## Requirements

- Node.js 18+
- Git (for freshness timestamps and drift detection)
