#!/bin/bash

# Deploy Bridge AI Landing Page to EC2
# Usage: ./scripts/deploy-landing.sh [web-directory]

set -e  # Exit on error

# Configuration
WEB_DIR="${1:-/var/www/bridge.neviljobanputra.com}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"

echo "🚀 Deploying Bridge AI Landing Page..."
echo "📁 Project directory: $PROJECT_DIR"
echo "📁 Web directory: $WEB_DIR"
echo ""

# Check if we're in the right directory
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the project root?"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR"

# Check if node_modules exists, install if not
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build web version
echo "🔨 Building web version..."
npx expo export --platform web

# Check if dist directory was created
if [ ! -d "$DIST_DIR" ]; then
    echo "❌ Error: dist directory not found after build"
    exit 1
fi

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

# Create web directory if it doesn't exist
if [ ! -d "$WEB_DIR" ]; then
    echo "📁 Creating web directory: $WEB_DIR"
    $SUDO mkdir -p "$WEB_DIR"
fi

# Backup existing files (optional)
if [ -d "$WEB_DIR" ] && [ "$(ls -A $WEB_DIR)" ]; then
    echo "💾 Backing up existing files..."
    $SUDO cp -r "$WEB_DIR" "${WEB_DIR}.backup.$(date +%Y%m%d_%H%M%S)" || true
fi

# Copy built files
echo "📤 Copying files to web directory..."
$SUDO cp -r "$DIST_DIR"/* "$WEB_DIR/"

# Set proper permissions
echo "🔐 Setting permissions..."
$SUDO chown -R www-data:www-data "$WEB_DIR"
$SUDO chmod -R 755 "$WEB_DIR"

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if $SUDO nginx -t 2>/dev/null; then
    echo "✅ Nginx configuration is valid"
    # Reload Nginx
    echo "🔄 Reloading Nginx..."
    $SUDO systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "⚠️  Warning: Nginx configuration test failed"
    echo "   You may need to fix your Nginx config manually"
fi

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your landing page should be available at: https://bridge.neviljobanputra.com"
echo ""
echo "📝 Next steps:"
echo "   1. Verify DNS is pointing to your EC2 instance"
echo "   2. Check Nginx logs if needed: sudo tail -f /var/log/nginx/error.log"
echo "   3. Test the site in your browser"

