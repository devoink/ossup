#!/usr/bin/env bash
# Create GitHub repo and push. Requires: gh auth login
set -euo pipefail
cd "$(dirname "$0")/.."

OWNER="${1:-devoink}"
REPO="${2:-ossput}"
VISIBILITY="${3:-public}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh && gh auth login"
  exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin already exists:"
  git remote -v
  exit 1
fi

gh repo create "${OWNER}/${REPO}" \
  --"${VISIBILITY}" \
  --source=. \
  --remote=origin \
  --description="MCP + Skill for Aliyun OSS presigned direct upload" \
  --push

echo "Done: https://github.com/${OWNER}/${REPO}"
