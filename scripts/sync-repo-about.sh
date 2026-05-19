#!/usr/bin/env bash
# Sync package.json homepage → GitHub repo About "Website" (requires gh auth login)
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh && gh auth login"
  exit 1
fi

HOMEPAGE="$(node -pe "JSON.parse(require('fs').readFileSync('package.json','utf8')).homepage")"
if [[ -z "${HOMEPAGE}" ]]; then
  echo "package.json has no homepage field"
  exit 1
fi

REMOTE="$(git remote get-url origin 2>/dev/null || true)"
if [[ -z "${REMOTE}" ]]; then
  echo "No git remote origin; pass OWNER/REPO: $0 [owner] [repo]"
  OWNER="${1:-devoink}"
  REPO="${2:-ossput}"
else
  # origin → git@github.com:owner/repo.git or https://github.com/owner/repo.git
  SLUG="$(echo "${REMOTE}" | sed -E 's#.*github\.com[:/]([^/]+)/([^/.]+)(\.git)?$#\1/\2#')"
  OWNER="${SLUG%%/*}"
  REPO="${SLUG##*/}"
fi

gh repo edit "${OWNER}/${REPO}" --homepage "${HOMEPAGE}"
echo "About website: ${HOMEPAGE}"
echo "https://github.com/${OWNER}/${REPO}"
