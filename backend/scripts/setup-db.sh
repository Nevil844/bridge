#!/bin/bash
# Bridge AI - Database Setup Script

echo "🌉 Bridge AI - Database Setup"
echo "=============================="

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed"
    echo "Please install PostgreSQL first:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt install postgresql"
    exit 1
fi

# Check if pgvector Homebrew package is installed (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if brew list pgvector &>/dev/null; then
        echo "✅ pgvector Homebrew package is installed"
    else
        echo "⚠️  pgvector Homebrew package not found"
        echo "Installing pgvector..."
        brew install pgvector || {
            echo "❌ Failed to install pgvector"
            echo "Please install manually: brew install pgvector"
            exit 1
        }
    fi
fi

# Ask for database details
echo ""
echo "Database Configuration:"
read -p "Database name (default: bridge_ai): " DB_NAME
DB_NAME=${DB_NAME:-bridge_ai}

read -p "Username (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "Password: " DB_PASSWORD
echo ""

read -p "Host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

# Check for port conflicts
echo ""
echo "📦 Checking PostgreSQL connection and pgvector extension..."

# Check if local PostgreSQL is running (might conflict with Docker)
LOCAL_PG=$(lsof -i :5432 2>/dev/null | grep -v "com.docke\|Docker" | grep "postgres" | head -1)
if [ ! -z "$LOCAL_PG" ]; then
    echo "⚠️  WARNING: Local PostgreSQL instance detected on port 5432"
    echo "   This might conflict with your Docker container"
    echo "   Options:"
    echo "   1. Stop local PostgreSQL: brew services stop postgresql"
    echo "   2. Use Docker directly: npm run db:setup:docker"
    echo "   3. Use different port for Docker (modify docker run command)"
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 1
    fi
fi

# Check if using Docker (common case)
DOCKER_CONTAINER=""
if docker ps --format '{{.Names}}' | grep -q "bridge-ai-db\|postgres\|pgvector"; then
    echo "🐳 Detected Docker PostgreSQL container"
    DOCKER_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "bridge-ai-db|postgres|pgvector" | head -1)
    
    # Try to detect password from container
    if [ ! -z "$DOCKER_CONTAINER" ]; then
        DETECTED_PASSWORD=$(docker inspect "$DOCKER_CONTAINER" 2>/dev/null | grep -o 'POSTGRES_PASSWORD=[^,]*' | cut -d= -f2 | tr -d '"')
        if [ ! -z "$DETECTED_PASSWORD" ]; then
            echo "🔍 Detected password from container: ${DETECTED_PASSWORD:0:3}***"
            echo "💡 Using detected password. If this doesn't work, try: $DETECTED_PASSWORD"
            if [ -z "$DB_PASSWORD" ]; then
                DB_PASSWORD="$DETECTED_PASSWORD"
            fi
        else
            if [ -z "$DB_PASSWORD" ]; then
                echo "💡 Tip: Try common passwords: 'yourpassword', 'postgres', or leave empty"
            fi
        fi
    fi
    
    # If Docker detected and local PG exists, suggest using Docker script
    if [ ! -z "$LOCAL_PG" ] && [ ! -z "$DOCKER_CONTAINER" ]; then
        echo ""
        echo "💡 Tip: Since you have both local PostgreSQL and Docker, consider using:"
        echo "   npm run db:setup:docker"
        echo "   This will connect directly to the Docker container"
    fi
fi

# Test connection with better error reporting
CONNECTION_TEST=$(PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d postgres -c "SELECT 1;" 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ Cannot connect to PostgreSQL"
    echo ""
    echo "Connection details:"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  User: $DB_USER"
    echo "  Password: ${DB_PASSWORD:+***set***}"
    echo ""
    echo "Common issues:"
    echo "  • Wrong password (Docker containers often use empty password or 'postgres')"
    echo "  • PostgreSQL not running"
    echo "  • Wrong host/port"
    echo ""
    echo "For Docker containers, try:"
    echo "  Password: (leave empty) or 'postgres'"
    echo "  Or check: docker exec -it bridge-ai-db psql -U postgres"
    echo ""
    read -p "Do you want to retry with different credentials? (y/n): " RETRY
    if [ "$RETRY" = "y" ]; then
        read -p "Username (default: postgres): " DB_USER
        DB_USER=${DB_USER:-postgres}
        read -sp "Password (try empty or 'postgres'): " DB_PASSWORD
        echo ""
        
        # Retry connection
        CONNECTION_TEST=$(PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d postgres -c "SELECT 1;" 2>&1)
        if [ $? -ne 0 ]; then
            echo "❌ Still cannot connect. Error:"
            echo "$CONNECTION_TEST" | head -3
            exit 1
        fi
    else
        exit 1
    fi
fi
echo "✅ Successfully connected to PostgreSQL"

# Try to enable pgvector extension in postgres database first
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d postgres -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ pgvector extension is available"
else
    echo "⚠️  Warning: Could not enable pgvector extension in postgres database"
    echo "This might be okay - we'll try to enable it in your database instead"
fi

# Create database
echo ""
echo "📝 Creating database..."
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d postgres -c "CREATE DATABASE $DB_NAME;" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database '$DB_NAME' created"
else
    echo "⚠️  Database might already exist, continuing..."
fi

# Enable pgvector extension in the new database
echo "📦 Enabling pgvector extension in database..."
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ pgvector extension enabled"
else
    echo "❌ Failed to enable pgvector extension"
    echo "Please ensure pgvector is installed:"
    echo "  macOS: brew install pgvector"
    echo "  Ubuntu: sudo apt install postgresql-14-pgvector"
    echo ""
    echo "Then restart PostgreSQL and try again"
    exit 1
fi

# Update .env file
echo ""
echo "📄 Updating .env file..."
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?schema=public"

if [ ! -f .env ]; then
    cp env.example .env
fi

# Update DATABASE_URL in .env
if grep -q "DATABASE_URL=" .env; then
    sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=\"$DATABASE_URL\"|" .env
    rm .env.bak 2>/dev/null
else
    echo "DATABASE_URL=\"$DATABASE_URL\"" >> .env
fi

echo "✅ .env updated with DATABASE_URL"

# Generate encryption key if not exists
if ! grep -q "ENCRYPTION_KEY=" .env || grep -q "your-32-byte-encryption-key-here" .env; then
    echo ""
    echo "🔐 Generating encryption key..."
    ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if grep -q "ENCRYPTION_KEY=" .env; then
        sed -i.bak "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$ENCRYPTION_KEY\"|" .env
        rm .env.bak 2>/dev/null
    else
        echo "ENCRYPTION_KEY=\"$ENCRYPTION_KEY\"" >> .env
    fi
    echo "✅ Encryption key generated"
fi

# Run Prisma migrations
echo ""
echo "🔄 Running Prisma migrations..."
npx prisma generate
npx prisma migrate dev --name initial_setup

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Update other environment variables in .env"
    echo "  2. Start the server: npm start"
else
    echo ""
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi

