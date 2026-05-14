#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION=$(grep '"version"' "$PROJECT_ROOT/package.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
if [ -z "$VERSION" ]; then
  echo "Error: failed to read version from package.json" >&2
  exit 1
fi

IMAGE="fellow99/llm-router"
TAG_VERSION="$IMAGE:$VERSION"
TAG_LATEST="$IMAGE:latest"

echo "Building $TAG_VERSION ..."
docker build -t "$TAG_VERSION" -f "$SCRIPT_DIR/Dockerfile" "$PROJECT_ROOT"

echo "Tagging $TAG_LATEST ..."
docker tag "$TAG_VERSION" "$TAG_LATEST"

echo ""
echo "Done: $TAG_VERSION"
echo "      $TAG_LATEST"
echo ""

read -rp "Push to registry? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  echo "Pushing $TAG_VERSION ..."
  docker push "$TAG_VERSION"
  echo "Pushing $TAG_LATEST ..."
  docker push "$TAG_LATEST"
  echo "Push complete."
else
  echo "Skipped push."
fi
