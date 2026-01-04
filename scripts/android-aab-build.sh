#!/bin/bash

# Bridge AI - Android AAB (App Bundle) Build Script
# Usage: ./android-aab-build.sh [release]
# This creates an AAB file for Google Play Store upload

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build type (default: release)
BUILD_TYPE="${1:-release}"

echo -e "${GREEN}🚀 Bridge AI - Android AAB Build Script${NC}"
echo "=========================================="

# Set up Java
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"

# Set up Android SDK
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"

# Verify Java
if ! command -v java &> /dev/null; then
    echo -e "${RED}❌ Java not found. Please install OpenJDK 17:${NC}"
    echo "   brew install openjdk@17"
    exit 1
fi

echo -e "${GREEN}✓${NC} Java: $(java -version 2>&1 | head -1)"

# Verify Android SDK
if [ ! -d "$ANDROID_HOME" ]; then
    echo -e "${RED}❌ Android SDK not found at $ANDROID_HOME${NC}"
    echo "   Please install Android SDK or update ANDROID_HOME path"
    exit 1
fi

echo -e "${GREEN}✓${NC} Android SDK: $ANDROID_HOME"

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo -e "${YELLOW}📦 Building $BUILD_TYPE AAB (App Bundle)...${NC}"
echo ""

# Ensure native files are up to date
if [ ! -d "android" ]; then
    echo -e "${YELLOW}⚙️  Generating native Android files...${NC}"
    npx expo prebuild --platform android --clean
    echo ""
fi

# Build the AAB
cd android

if [ "$BUILD_TYPE" == "debug" ]; then
    ./gradlew bundleDebug
    AAB_PATH="app/build/outputs/bundle/debug/app-debug.aab"
else
    ./gradlew bundleRelease
    AAB_PATH="app/build/outputs/bundle/release/app-release.aab"
fi

cd ..

# Check if build succeeded
if [ -f "android/$AAB_PATH" ]; then
    AAB_SIZE=$(ls -lh "android/$AAB_PATH" | awk '{print $5}')
    echo ""
    echo -e "${GREEN}✅ BUILD SUCCESSFUL!${NC}"
    echo "=========================================="
    echo -e "AAB Location: ${GREEN}android/$AAB_PATH${NC}"
    echo -e "AAB Size: ${YELLOW}$AAB_SIZE${NC}"
    echo ""
    echo "📤 Ready for Google Play Store upload!"
    echo ""
    echo "To copy to Desktop:"
    echo "  cp android/$AAB_PATH ~/Desktop/BridgeAI-$BUILD_TYPE.aab"
    echo ""
    echo "To open in Finder:"
    echo "  open -R android/$AAB_PATH"
else
    echo -e "${RED}❌ Build failed - AAB not found${NC}"
    exit 1
fi

