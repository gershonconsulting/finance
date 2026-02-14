#!/bin/bash

# Pre-Deployment Verification Script
# Run this BEFORE deploying to catch version mismatches

set -e

echo "🔍 Pre-Deployment Verification"
echo "════════════════════════════════════════════════════"
echo ""

# Extract versions from each file
PKG_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')
SRC_VERSION=$(grep "version:" src/index.tsx | head -1 | sed "s/.*version: '\([0-9.]*\)'.*/\1/")
SERVER_VERSION=$(grep "version:" server.js | head -1 | sed "s/.*version: '\([0-9.]*\)'.*/\1/")
HTML_VERSION=$(grep ">v[0-9]" public/index.html | head -1 | sed 's/.*>v\([0-9.]*\)<.*/\1/')

echo "📋 Source File Versions:"
echo "  package.json:      $PKG_VERSION"
echo "  src/index.tsx:     $SRC_VERSION"
echo "  server.js:         $SERVER_VERSION"
echo "  public/index.html: $HTML_VERSION"
echo ""

# Check if all versions match
if [ "$PKG_VERSION" = "$SRC_VERSION" ] && [ "$SRC_VERSION" = "$SERVER_VERSION" ] && [ "$SERVER_VERSION" = "$HTML_VERSION" ]; then
  echo "✅ All source versions match: $PKG_VERSION"
else
  echo "❌ ERROR: Version mismatch detected!"
  echo ""
  echo "Expected all to be the same, but found:"
  echo "  package.json:      $PKG_VERSION"
  echo "  src/index.tsx:     $SRC_VERSION"
  echo "  server.js:         $SERVER_VERSION"
  echo "  public/index.html: $HTML_VERSION"
  echo ""
  echo "Run: ./update-version.sh <version> to fix"
  exit 1
fi

# Check if dist exists
if [ ! -d "dist" ]; then
  echo "⚠️  WARNING: dist/ directory not found"
  echo "   Run: npm run build"
  exit 1
fi

echo ""
echo "📦 Built Files Check:"

# Check dist/index.html version
if [ -f "dist/index.html" ]; then
  DIST_HTML_VERSION=$(grep ">v[0-9]" dist/index.html | head -1 | sed 's/.*>v\([0-9.]*\)<.*/\1/')
  echo "  dist/index.html:   $DIST_HTML_VERSION"
  
  if [ "$DIST_HTML_VERSION" = "$PKG_VERSION" ]; then
    echo "  ✅ dist/index.html matches source"
  else
    echo "  ❌ dist/index.html version mismatch!"
    echo "     Expected: $PKG_VERSION"
    echo "     Found:    $DIST_HTML_VERSION"
    echo ""
    echo "Run: npm run build"
    exit 1
  fi
else
  echo "  ⚠️  dist/index.html not found"
  echo "     Run: npm run build"
  exit 1
fi

# Check dist/_worker.js has version
if [ -f "dist/_worker.js" ]; then
  if grep -q "version:\"$PKG_VERSION\"" dist/_worker.js; then
    echo "  ✅ dist/_worker.js contains v$PKG_VERSION"
  else
    echo "  ⚠️  dist/_worker.js version not found or mismatch"
    echo "     Run: npm run build"
    exit 1
  fi
else
  echo "  ⚠️  dist/_worker.js not found"
  echo "     Run: npm run build"
  exit 1
fi

# Check for /api/sheets endpoints
echo ""
echo "🔍 Google Sheets Endpoints Check:"
if grep -q "/api/sheets/" dist/_worker.js; then
  SHEETS_COUNT=$(grep -c '"/api/sheets/' dist/_worker.js || echo "0")
  echo "  ✅ Found /api/sheets/ endpoints in dist/_worker.js (count: $SHEETS_COUNT)"
else
  echo "  ❌ /api/sheets/ endpoints NOT found in dist/_worker.js"
  echo "     This means Google Sheets IMPORTDATA will NOT work!"
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "✅ All checks passed!"
echo ""
echo "📋 Ready to deploy version: $PKG_VERSION"
echo ""
echo "Next steps:"
echo "  1. git add -A"
echo "  2. git commit -m 'v$PKG_VERSION: <description>'"
echo "  3. Deploy via GenSpark Deploy Tab"
echo "  4. After deploy: Hard refresh browser (Ctrl+Shift+R)"
echo "  5. Verify: curl https://finance.gershoncrm.com/api/health | jq '.version'"
echo ""
