# claude-code-dashboard

A visual dashboard for your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) configuration across all repos.

Scans your home directory for git repos, collects Claude Code configuration (commands, rules, `AGENTS.md`/`CLAUDE.md`), and generates a self-contained HTML dashboard.

## Features

- **Repo discovery** — finds all git repos under `$HOME` (or configured directories)
- **Config coverage** — shows what percentage of your repos have Claude Code configuration
- **Freshness indicators** — green/yellow/red dots showing how recently config was updated
- **Expandable cards** — collapsed 3-column grid, click to expand full details
- **Search** — filter repos by name, path, or content (`/` to focus, `Esc` to clear)
- **Global overview** — all global commands and rules in one place
- **Dependency chains** — visualize repo relationships via config file
- **Zero dependencies** — single Node.js script, no `npm install` required

## Install

```sh
npm install -g claude-code-dashboard
```

Or run directly:

```sh
npx claude-code-dashboard
```

Or clone and run:

```sh
git clone https://github.com/VirenMohindra/claude-code-dashboard.git
node claude-code-dashboard/generate-dashboard.mjs
```

## Usage

```sh
# Generate dashboard (writes to ~/.claude/dashboard.html)
claude-code-dashboard

# Generate and open in browser
claude-code-dashboard --open

# Custom output path
claude-code-dashboard --output ~/Desktop/dashboard.html

# Show help
claude-code-dashboard --help
```

### As a Claude Code slash command

Add this to `~/.claude/commands/dashboard.md`:

```markdown
# Dashboard

Generate and open the Claude Code configuration dashboard.

## Steps

1. Run the dashboard generator script:
   ```bash
   node ~/.claude/scripts/generate-dashboard.mjs
   ```

2. Open the generated HTML file:
   ```bash
   open ~/.claude/dashboard.html
   ```

3. Tell the user the dashboard is ready and where to find it.
```

Then run `/dashboard` from any Claude Code session.

## Configuration

Create `~/.claude/dashboard.conf` to customize behavior:

```conf
# Restrict scanning to specific directories (one per line):
~/work
~/personal/repos

# Define dependency chains:
chain: ui-library -> app -> deploy
chain: backend <- shared-types
```

If no directories are listed, the entire home directory is scanned (depth 5).

## What it scans

For each git repo found, the dashboard checks for:

| Path | What it shows |
|------|---------------|
| `CLAUDE.md` / `AGENTS.md` | Project description, config sections |
| `.claude/commands/*.md` | Custom slash commands |
| `.claude/rules/*.md` | Custom rules |
| `~/.claude/commands/*.md` | Global commands |
| `~/.claude/rules/*.md` | Global rules |

## Requirements

- Node.js 14+
- Git (for freshness timestamps)

## Privacy

The generated HTML file contains:
- Filesystem paths (shortened with `~`)
- Preview lines from your `CLAUDE.md` / `AGENTS.md` files
- Names of your commands and rules

The file is local-only and never sent anywhere, but be mindful if sharing the HTML file.

## License

MIT
