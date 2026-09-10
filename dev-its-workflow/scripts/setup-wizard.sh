#!/usr/bin/env bash
# Dev-ITS Workflow - First-run environment detection helper
# This script detects what it can about the repo and outputs JSON for the config wizard.
# The actual config.json is written by the orchestrator (Claude) after asking the user
# for what can't be auto-detected (reviewers, branch naming, etc.)
set -euo pipefail

REPO_ROOT="${1:-.}"

echo "{"

# --- Backend detection ---
REMOTE=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || echo "")
if [[ "$REMOTE" == *"github.com"* ]]; then
  BACKEND="github"
  # Extract org/repo from URL
  ORG=$(echo "$REMOTE" | sed -n 's|.*github.com[:/]\([^/]*\)/.*|\1|p')
  REPO=$(echo "$REMOTE" | sed -n 's|.*github.com[:/][^/]*/\([^.]*\).*|\1|p')
elif [[ "$REMOTE" == *"dev.azure.com"* ]] || [[ "$REMOTE" == *"visualstudio.com"* ]]; then
  BACKEND="azure-devops"
  ORG=$(echo "$REMOTE" | sed -n 's|.*dev.azure.com/\([^/]*\)/.*|\1|p')
  REPO=$(echo "$REMOTE" | sed -n 's|.*/\([^/]*\)$|\1|p' | sed 's/.git$//')
else
  BACKEND="unknown"
  ORG=""
  REPO=""
fi

echo "  \"backend\": \"$BACKEND\","
echo "  \"org\": \"$ORG\","
echo "  \"repo\": \"$REPO\","
echo "  \"remote\": \"$REMOTE\","

# --- Base branch detection ---
DEFAULT_BRANCH=$(git -C "$REPO_ROOT" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")
echo "  \"base_branch\": \"$DEFAULT_BRANCH\","

# --- Tool detection ---
GH_PATH=$(which gh 2>/dev/null || where gh 2>/dev/null || echo "")
AZ_PATH=$(which az 2>/dev/null || where az 2>/dev/null || echo "")
DOCKER=$(docker info >/dev/null 2>&1 && echo "true" || echo "false")

echo "  \"gh_path\": \"$GH_PATH\","
echo "  \"az_path\": \"$AZ_PATH\","
echo "  \"docker_available\": $DOCKER,"

# --- Stack detection ---
STACK="unknown"
if [[ -f "$REPO_ROOT/package.json" ]]; then
  STACK="node"
elif [[ -f "$REPO_ROOT/pyproject.toml" ]] || [[ -f "$REPO_ROOT/requirements.txt" ]]; then
  STACK="python"
elif ls "$REPO_ROOT"/*.csproj >/dev/null 2>&1 || ls "$REPO_ROOT"/**/*.csproj >/dev/null 2>&1; then
  STACK="dotnet"
elif [[ -f "$REPO_ROOT/go.mod" ]]; then
  STACK="go"
elif [[ -f "$REPO_ROOT/Cargo.toml" ]]; then
  STACK="rust"
elif [[ -f "$REPO_ROOT/pom.xml" ]] || [[ -f "$REPO_ROOT/build.gradle" ]]; then
  STACK="java"
fi
echo "  \"stack\": \"$STACK\","

# --- Docker requirement detection ---
NEEDS_DOCKER="false"
if [[ -f "$REPO_ROOT/docker-compose.yml" ]] || [[ -f "$REPO_ROOT/docker-compose.yaml" ]] || [[ -f "$REPO_ROOT/compose.yml" ]]; then
  NEEDS_DOCKER="true"
fi
echo "  \"needs_docker\": $NEEDS_DOCKER,"

# --- Existing test detection ---
HAS_TESTS="false"
if ls "$REPO_ROOT"/tests/ >/dev/null 2>&1 || ls "$REPO_ROOT"/__tests__/ >/dev/null 2>&1 || ls "$REPO_ROOT"/*test* >/dev/null 2>&1; then
  HAS_TESTS="true"
fi
echo "  \"has_existing_tests\": $HAS_TESTS"

echo "}"
