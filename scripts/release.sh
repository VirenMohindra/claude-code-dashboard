#!/bin/bash
set -euo pipefail

# Usage: ./scripts/release.sh <patch|minor|major>
# Bumps version in package.json + src/constants.mjs, commits, tags, and pushes.
# Then create a GitHub Release to trigger npm publish.

TYPE="${1:-patch}"

if [[ "$TYPE" != "patch" && "$TYPE" != "minor" && "$TYPE" != "major" ]]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major>"
  exit 1
fi

# Ensure working tree is clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean. Commit or stash changes first."
  exit 1
fi

# Ensure on main
BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Error: must be on main branch (currently on $BRANCH)"
  exit 1
fi

# Bump version in package.json (no git tag, no commit)
NEW_VERSION="$(npm version "$TYPE" --no-git-tag-version)"
NEW_VERSION="${NEW_VERSION#v}"

# Update VERSION in src/constants.mjs
sed -i.bak "s/export const VERSION = \".*\"/export const VERSION = \"$NEW_VERSION\"/" src/constants.mjs
rm -f src/constants.mjs.bak

# Verify versions match
PKG_VERSION="$(node -p "require('./package.json').version")"
SRC_VERSION="$(node -p "import('./src/constants.mjs').then(m => console.log(m.VERSION))" 2>/dev/null || node -e "import('./src/constants.mjs').then(m => { console.log(m.VERSION); process.exit(0) })")"

echo "package.json: $PKG_VERSION"
echo "constants.mjs: $NEW_VERSION"

# Run tests
echo "Running tests..."
npm test
echo "Running lint..."
npm run lint

# Commit and tag
git add package.json src/constants.mjs
git commit -m "release: v$NEW_VERSION"
git tag "v$NEW_VERSION"
git push origin main --tags

echo ""
echo "Pushed v$NEW_VERSION. Now create a GitHub Release to publish to npm:"
echo ""
echo "  gh release create v$NEW_VERSION --title \"v$NEW_VERSION\" --generate-notes"
echo ""
