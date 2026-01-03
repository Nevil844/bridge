#!/bin/bash

# Bridge AI - Release Keystore Generation Script
# This script generates a release keystore for signing Android AAB/APK files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 Bridge AI - Release Keystore Generator${NC}"
echo "=========================================="
echo ""

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

KEYSTORE_PATH="android/app/bridge-ai-release.keystore"
KEYSTORE_PROPERTIES="android/keystore.properties"

# Check if keystore already exists
if [ -f "$KEYSTORE_PATH" ]; then
    echo -e "${YELLOW}⚠️  Release keystore already exists at: $KEYSTORE_PATH${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    rm -f "$KEYSTORE_PATH"
fi

# Set up Java
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"

# Verify Java
if ! command -v java &> /dev/null; then
    echo -e "${RED}❌ Java not found. Please install OpenJDK 17:${NC}"
    echo "   brew install openjdk@17"
    exit 1
fi

echo -e "${GREEN}✓${NC} Java: $(java -version 2>&1 | head -1)"
echo ""

# Get keystore information
echo "Please provide the following information for your release keystore:"
echo ""

read -p "Keystore password: " -s KEYSTORE_PASSWORD
echo ""
read -p "Confirm keystore password: " -s KEYSTORE_PASSWORD_CONFIRM
echo ""

if [ "$KEYSTORE_PASSWORD" != "$KEYSTORE_PASSWORD_CONFIRM" ]; then
    echo -e "${RED}❌ Passwords do not match!${NC}"
    exit 1
fi

read -p "Key alias (default: bridge-ai-key): " KEY_ALIAS
KEY_ALIAS=${KEY_ALIAS:-bridge-ai-key}

read -p "Key password (default: same as keystore password): " -s KEY_PASSWORD
echo ""
if [ -z "$KEY_PASSWORD" ]; then
    KEY_PASSWORD="$KEYSTORE_PASSWORD"
fi

read -p "Your name (for certificate): " CERT_NAME
read -p "Your organization (for certificate): " CERT_ORG
read -p "Your city (for certificate): " CERT_CITY
read -p "Your state/province (for certificate): " CERT_STATE
read -p "Your country code (2 letters, e.g., US, IN): " CERT_COUNTRY

echo ""
echo -e "${YELLOW}📦 Generating keystore...${NC}"

# Generate the keystore
keytool -genkeypair \
    -v \
    -storetype PKCS12 \
    -keystore "$KEYSTORE_PATH" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "CN=$CERT_NAME, OU=$CERT_ORG, L=$CERT_CITY, ST=$CERT_STATE, C=$CERT_COUNTRY"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Keystore generated successfully!${NC}"
    echo ""
    echo "Keystore location: $KEYSTORE_PATH"
    echo ""
    
    # Create keystore.properties file
    echo -e "${YELLOW}📝 Creating keystore.properties...${NC}"
    cat > "$KEYSTORE_PROPERTIES" << EOF
# Bridge AI Release Keystore Configuration
# DO NOT COMMIT THIS FILE TO GIT - It contains sensitive passwords
MYAPP_RELEASE_STORE_FILE=bridge-ai-release.keystore
MYAPP_RELEASE_KEY_ALIAS=$KEY_ALIAS
MYAPP_RELEASE_STORE_PASSWORD=$KEYSTORE_PASSWORD
MYAPP_RELEASE_KEY_PASSWORD=$KEY_PASSWORD
EOF
    
    echo -e "${GREEN}✅ Created keystore.properties at: $KEYSTORE_PROPERTIES${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTES:${NC}"
    echo "1. Keep your keystore file and passwords safe!"
    echo "2. If you lose the keystore, you cannot update your app on Google Play"
    echo "3. The keystore.properties file has been created but should NOT be committed to git"
    echo "4. Make a backup of your keystore file in a secure location"
    echo ""
    echo -e "${GREEN}✅ Setup complete! You can now build a signed release AAB.${NC}"
else
    echo -e "${RED}❌ Failed to generate keystore${NC}"
    exit 1
fi

