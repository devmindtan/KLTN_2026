#!/bin/bash
# Auto-increment version theo semantic versioning
# Usage: ./version-bump.sh <version_file>

VERSION_FILE=$1

if [ ! -f "$VERSION_FILE" ]; then
    echo "1.0.0" > "$VERSION_FILE"
fi

CURRENT_VERSION=$(cat "$VERSION_FILE")

# Parse version: v1.0.0 → major=1, minor=0, patch=0
IFS='.' read -r -a parts <<< "$CURRENT_VERSION"
MAJOR="${parts[0]}"
MINOR="${parts[1]}"
PATCH="${parts[2]}"

# Increment patch
PATCH=$((PATCH + 1))

# Check rollover: v1.0.9 → v1.1.0
if [ $PATCH -ge 10 ]; then
    PATCH=0
    MINOR=$((MINOR + 1))
fi

# Check rollover: v1.9.x → v2.0.0
if [ $MINOR -ge 10 ]; then
    MINOR=0
    MAJOR=$((MAJOR + 1))
fi

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "$NEW_VERSION" > "$VERSION_FILE"
echo "$NEW_VERSION"
