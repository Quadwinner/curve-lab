#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f data-out/meta.json || { echo "data-out/meta.json missing: run the indexer first" >&2; exit 1; }
npx tsx scripts/check-publish.ts
remote=$(git remote get-url origin)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp -r data-out/. "$tmp/"
cd "$tmp"
git init -q -b data
git add -A
git -c user.name=curve-lab-bot -c user.email=bot@users.noreply.github.com commit -qm "data $(date -u +%FT%TZ)"
git push -qf "$remote" data
echo "published $(git rev-parse --short HEAD) to $remote data"
