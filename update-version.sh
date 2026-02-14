#!/bin/bash

# Version Update Script - Updates version in ALL locations
# Usage: ./update-version.sh 2.4.3

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <new-version>"
  echo "Example: $0 2.4.3"
  exit 1
fi

NEW_VERSION=$1

echo "🔄 Updating version to ${NEW_VERSION}..."

# 1. Update package.json
echo "📦 Updating package.json..."
sed -i "s/\"version\": \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\": \"${NEW_VERSION}\"/" package.json

# 2. Update src/index.tsx (health endpoint)
echo "🔧 Updating src/index.tsx..."
sed -i "s/version: '[0-9]\+\.[0-9]\+\.[0-9]\+'/version: '${NEW_VERSION}'/" src/index.tsx

# 3. Update server.js (Node.js health endpoint)
echo "🔧 Updating server.js..."
sed -i "s/version: '[0-9]\+\.[0-9]\+\.[0-9]\+'/version: '${NEW_VERSION}'/" server.js

# 4. Update public/index.html (UI badge)
echo "🎨 Updating public/index.html..."
sed -i "s/>v[0-9]\+\.[0-9]\+\.[0-9]\+</>v${NEW_VERSION}</" public/index.html

# 5. Update release date to now
RELEASE_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "📅 Updating release date to ${RELEASE_DATE}..."
sed -i "s/releaseDate: '[^']*'/releaseDate: '${RELEASE_DATE}'/" src/index.tsx
sed -i "s/releaseDate: '[^']*'/releaseDate: '${RELEASE_DATE}'/" server.js

echo ""
echo "✅ Version updated to ${NEW_VERSION} in all files!"
echo ""
echo "📋 Verification:"
echo "─────────────────────────────────────"
echo "package.json:      $(grep '"version"' package.json | head -1 | xargs)"
echo "src/index.tsx:     $(grep "version:" src/index.tsx | head -1 | xargs)"
echo "server.js:         $(grep "version:" server.js | head -1 | xargs)"
echo "public/index.html: $(grep ">v[0-9]" public/index.html | head -1 | xargs)"
echo ""
echo "🔨 Next steps:"
echo "1. npm run build"
echo "2. Verify: grep 'v${NEW_VERSION}' dist/index.html"
echo "3. git add -A && git commit -m 'v${NEW_VERSION}: <describe changes>'"
echo "4. Deploy to GenSpark"
