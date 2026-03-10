# Claude Code Dashboard — Open Source Checklist

## Security (blockers)

- [x] Fix command injection in `getFreshness()` — use `execFileSync` instead of shell string interpolation
- [x] Fix incomplete HTML escaping — add `"` → `&quot;` to `esc()`

## Portability

- [x] Replace `process.env.HOME` with `os.homedir()`
- [x] Remove `2>/dev/null` shell redirects — use try/catch around `execFileSync`
- [x] Document minimum Node version (14+) in package.json engines + README

## Robustness

- [x] Ensure output directory exists before writing (`mkdirSync` with `recursive: true`)
- [x] Fix `parseInt` NaN edge case — use `Number()` + `Number.isFinite()` guard

## Packaging

- [x] Create `package.json` with bin entry, type: module, engines field
- [x] Add CLI flags: `--help`, `--version`, `--output <path>`, `--open`
- [x] Create README.md with installation, usage, config format, privacy note
- [x] Add LICENSE (MIT)
- [x] Add tests (30 passing: HTML escaping, freshness, markdown parsing, config parsing)
- [x] Extract `BOILERPLATE_RE` patterns to named array constant

## Polish

- [x] Name magic numbers as constants (ONE_DAY, THIRTY_DAYS, NINETY_DAYS, ONE_YEAR)
- [x] Privacy note in README
- [x] `npx claude-code-dashboard` support via bin entry
- [x] Create `.gitignore`
- [x] Init git repo

## Future

- [ ] Screenshot / demo GIF for README
- [ ] GitHub Actions CI (lint + test)
- [ ] Light/dark mode toggle
- [ ] Group repos by parent directory
- [ ] Export as JSON (`--json` flag)
- [ ] Config linting (detect contradictions)
