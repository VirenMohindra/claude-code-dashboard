import { VERSION, DEFAULT_OUTPUT, HOME } from "./constants.mjs";

export function parseArgs(argv) {
  const args = {
    output: DEFAULT_OUTPUT,
    open: false,
    json: false,
    catalog: false,
    command: null,
    template: null,
    dryRun: false,
    quiet: false,
    watch: false,
    diff: false,
    anonymize: false,
    completions: false,
  };
  let i = 2; // skip node + script
  if (argv[2] === "init") {
    args.command = "init";
    i = 3;
  } else if (argv[2] === "lint") {
    args.command = "lint";
    i = 3;
  }
  while (i < argv.length) {
    switch (argv[i]) {
      case "--help":
      case "-h":
        console.log(`claude-code-dashboard v${VERSION}

Scans your home directory for git repos with Claude Code configuration
and generates a self-contained HTML dashboard.

Usage:
  claude-code-dashboard [options]

Options:
  --output, -o <path>  Output path (default: ~/.claude/dashboard.html)
  --json               Output full data model as JSON instead of HTML
  --catalog            Generate a shareable skill catalog HTML page
  --open               Open the dashboard in your default browser after generating
  --quiet              Suppress output, just write file
  --watch              Regenerate on file changes
  --diff               Show changes since last generation
  --anonymize          Anonymize paths for shareable export
  --completions        Output shell completion script for bash/zsh
  --version, -v        Show version
  --help, -h           Show this help

Subcommands:
  init                 Scaffold Claude Code config for current directory
    --template, -t <stack>  Override auto-detected stack (next, react, python, etc.)
    --dry-run               Preview what would be created without writing files
  lint                 Check all repos for config issues

Config file: ~/.claude/dashboard.conf
  Add directories (one per line) to restrict scanning scope.
  Define dependency chains: chain: A -> B -> C
  Lines starting with # are comments.`);
        process.exit(0);
      case "--version":
      case "-v":
        console.log(VERSION);
        process.exit(0);
      case "--output":
      case "-o":
        args.output = argv[++i];
        if (!args.output) {
          console.error("Error: --output requires a path argument");
          process.exit(1);
        }
        // Expand ~ at the start of the path
        if (args.output.startsWith("~")) {
          args.output = args.output.replace(/^~/, HOME);
        }
        break;
      case "--json":
        args.json = true;
        break;
      case "--catalog":
        args.catalog = true;
        break;
      case "--open":
        args.open = true;
        break;
      case "--template":
      case "-t":
        args.template = argv[++i];
        if (!args.template) {
          console.error("Error: --template requires a stack argument");
          process.exit(1);
        }
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--quiet":
        args.quiet = true;
        break;
      case "--watch":
        args.watch = true;
        break;
      case "--diff":
        args.diff = true;
        break;
      case "--anonymize":
        args.anonymize = true;
        break;
      case "--completions":
        args.completions = true;
        break;
      default:
        console.error(`Unknown option: ${argv[i]}\nRun with --help for usage.`);
        process.exit(1);
    }
    i++;
  }
  return args;
}

export function generateCompletions() {
  console.log(`# claude-code-dashboard completions
# eval "$(claude-code-dashboard --completions)"
if [ -n "$ZSH_VERSION" ]; then
  _claude_code_dashboard() {
    local -a opts; opts=(init lint --output --open --json --catalog --quiet --watch --diff --anonymize --completions --help --version)
    if (( CURRENT == 2 )); then _describe 'option' opts; fi
  }; compdef _claude_code_dashboard claude-code-dashboard
elif [ -n "$BASH_VERSION" ]; then
  _claude_code_dashboard() { COMPREPLY=( $(compgen -W "init lint --output --open --json --catalog --quiet --watch --diff --anonymize --completions --help --version" -- "\${COMP_WORDS[COMP_CWORD]}") ); }
  complete -F _claude_code_dashboard claude-code-dashboard
fi`);
  process.exit(0);
}
