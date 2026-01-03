#!/bin/bash

# Bridge AI - iOS Build Script for App Store
# This uses EAS Build to create an iOS build for App Store submission

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🍎 Bridge AI - iOS App Store Build${NC}"
echo "=========================================="
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo -e "${RED}❌ EAS CLI not found. Installing...${NC}"
    npm install -g eas-cli
    echo ""
fi

echo -e "${GREEN}✓${NC} EAS CLI: $(eas --version)"
echo ""

# Check if logged in
if ! eas whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to EAS. Please login:${NC}"
    echo "   eas login"
    exit 1
fi

echo -e "${GREEN}✓${NC} Logged in to EAS"
echo ""

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Check if eas.json exists
if [ ! -f "eas.json" ]; then
    echo -e "${YELLOW}⚠️  eas.json not found. Configuring EAS Build...${NC}"
    eas build:configure
    echo ""
fi

echo -e "${YELLOW}📦 Building iOS app for App Store...${NC}"
echo ""
echo "This will:"
echo "  • Build your app in the cloud"
echo "  • Generate an .ipa file"
echo "  • Handle code signing automatically"
echo ""
read -p "Continue? (Y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${GREEN}🚀 Starting build...${NC}"
echo ""

# Build for production
eas build --platform ios --profile production

echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Wait for the build to finish (check: eas build:list)"
echo "  2. Submit to App Store: eas submit --platform ios"
echo "  3. Or download the .ipa and submit manually via App Store Connect"
echo ""

