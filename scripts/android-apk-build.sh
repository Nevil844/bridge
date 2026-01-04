#!/bin/bash

# Bridge AI - Android APK Build Script
# Usage: ./android-apk-build.sh [debug|release]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build type (default: release)
BUILD_TYPE="${1:-release}"

echo -e "${GREEN}🚀 Bridge AI - Android APK Build Script${NC}"
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

echo -e "${YELLOW}📦 Building $BUILD_TYPE APK...${NC}"
echo ""

# Clean previous builds (optional - uncomment if needed)
# echo "Cleaning previous builds..."
# rm -rf android/app/build android/app/.cxx android/build

# Build the APK
cd android

if [ "$BUILD_TYPE" == "debug" ]; then
    ./gradlew assembleDebug
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
else
    ./gradlew assembleRelease
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
fi

cd ..

# Check if build succeeded
if [ -f "android/$APK_PATH" ]; then
    APK_SIZE=$(ls -lh "android/$APK_PATH" | awk '{print $5}')
    echo ""
    echo -e "${GREEN}✅ BUILD SUCCESSFUL!${NC}"
    echo "=========================================="
    echo -e "APK Location: ${GREEN}android/$APK_PATH${NC}"
    echo -e "APK Size: ${YELLOW}$APK_SIZE${NC}"
    echo ""
    echo "To install on connected device:"
    echo "  adb install android/$APK_PATH"
    echo ""
    echo "To copy to Desktop:"
    echo "  cp android/$APK_PATH ~/Desktop/BridgeAI-$BUILD_TYPE.apk"
else
    echo -e "${RED}❌ Build failed - APK not found${NC}"
    exit 1
fi

