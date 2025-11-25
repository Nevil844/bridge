# Bridge AI - Prisma Database Setup

## 📦 Stack
- **ORM**: Prisma
- **Database**: PostgreSQL 14+
- **Vector Search**: pgvector extension

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
npm install @prisma/client
npm install -D prisma
npm install pgvector
```

### 2. Configure Environment
Create a `.env` file in the backend directory:
```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/bridge_ai?schema=public"
```

### 3. Install pgvector Extension
```bash
# macOS (Homebrew)
brew install pgvector

# Ubuntu/Debian
sudo apt install postgresql-14-pgvector

# Or use Docker
docker run -d \
  --name bridge-ai-postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=bridge_ai \
  -p 5432:5432 \
  ankane/pgvector
```

### 4. Run Migrations
```bash
# Generate Prisma Client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name initial_setup

# Or apply the SQL migration manually
psql -U your_user -d bridge_ai -f prisma/migrations/001_initial_setup.sql
```

### 5. Seed Database (Optional)
```bash
npx prisma db seed
```

## 📊 Schema Overview

### User
- Stores user authentication info
- Links to all user-owned data (conversations, integrations, memory)

### Conversation
- Tracks chat sessions
- Linked to User
- Has many Messages, ToolContexts, and MemoryVectors

### Message
- Stores individual messages (user/assistant/system/tool)
- Supports metadata for tool_calls, function results, etc.
- Can be embedded into MemoryVectors

### ToolContext
- Maintains state for multi-step tool operations
- Examples: shopping cart (Zomato), draft PR (GitHub), playlist (Spotify)
- Active/inactive flag for lifecycle management

### MemoryVector
- Stores semantic embeddings for RAG
- Uses pgvector for similarity search
- Links to User, Conversation, and optionally Message

### UserIntegration
- Stores MCP OAuth credentials and API keys
- One integration per provider per user
- Supports metadata for provider-specific configs

### TokenUsage (Optional)
- Tracks monthly AI token consumption
- Useful for billing and rate limiting

## 🔍 Common Queries

### Query Last N Messages for LangChain Memory
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get last 10 messages from a conversation
async function getConversationHistory(conversationId: string, limit: number = 10) {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      role: true,
      content: true,
      metadata: true,
      createdAt: true,
    },
  });
  
  // Reverse to get chronological order (oldest first)
  return messages.reverse();
}

// Format for LangChain
function formatForLangChain(messages: any[]) {
  return messages.map(msg => ({
    type: msg.role, // "human" | "ai" | "system"
    content: msg.content,
  }));
}
```

### Vector Similarity Search
```typescript
// Find similar memories using cosine similarity
async function findSimilarMemories(
  userId: string,
  embedding: number[],
  limit: number = 5
) {
  // Raw SQL for vector similarity search
  const similar = await prisma.$queryRaw`
    SELECT 
      id,
      content,
      metadata,
      1 - (embedding <=> ${embedding}::vector) as similarity
    FROM memory_vectors
    WHERE user_id = ${userId}
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT ${limit}
  `;
  
  return similar;
}

// Example: Embed user query and find relevant context
import OpenAI from 'openai';
const openai = new OpenAI();

async function semanticSearch(userId: string, query: string) {
  // 1. Embed the query
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const embedding = response.data[0].embedding;
  
  // 2. Search for similar memories
  const results = await findSimilarMemories(userId, embedding);
  
  return results;
}
```

### Create Conversation with Messages
```typescript
async function createConversationWithMessages(
  userId: string,
  title: string,
  messages: Array<{ role: string; content: string }>
) {
  return await prisma.conversation.create({
    data: {
      userId,
      title,
      messages: {
        create: messages,
      },
    },
    include: {
      messages: true,
    },
  });
}
```

### Store Tool Context
```typescript
async function storeToolContext(
  conversationId: string,
  toolName: string,
  state: any
) {
  // Deactivate previous contexts for this tool
  await prisma.toolContext.updateMany({
    where: {
      conversationId,
      toolName,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });
  
  // Create new active context
  return await prisma.toolContext.create({
    data: {
      conversationId,
      toolName,
      state,
      isActive: true,
    },
  });
}
```

### Get Active Tool Contexts
```typescript
async function getActiveToolContexts(conversationId: string) {
  return await prisma.toolContext.findMany({
    where: {
      conversationId,
      isActive: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
}
```

### Store User Integration
```typescript
async function storeIntegration(
  userId: string,
  provider: string,
  credentials: any,
  metadata?: any
) {
  return await prisma.userIntegration.upsert({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    update: {
      credentials,
      metadata,
      isActive: true,
      updatedAt: new Date(),
    },
    create: {
      userId,
      provider,
      credentials,
      metadata,
      isActive: true,
    },
  });
}
```

### Track Token Usage
```typescript
async function trackTokenUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number
) {
  const month = new Date().toISOString().slice(0, 7); // "2025-01"
  
  return await prisma.tokenUsage.upsert({
    where: {
      userId_month_model: {
        userId,
        month,
        model,
      },
    },
    update: {
      inputTokens: {
        increment: inputTokens,
      },
      outputTokens: {
        increment: outputTokens,
      },
      totalTokens: {
        increment: inputTokens + outputTokens,
      },
      updatedAt: new Date(),
    },
    create: {
      userId,
      month,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  });
}
```

## 🔐 Security Notes

1. **Encrypt Credentials**: The `credentials` field in `UserIntegration` stores sensitive OAuth tokens. Encrypt this data at rest using tools like:
   - `@prisma/client` middleware with `crypto`
   - Database-level encryption (PostgreSQL pgcrypto)
   - Application-level encryption (AES-256-GCM)

2. **Environment Variables**: Never commit `.env` files. Use secret management tools in production.

3. **Connection Pooling**: Use Prisma's built-in connection pooling or external poolers like PgBouncer for production.

## 📚 Additional Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Vector Similarity Search Guide](https://www.postgresql.org/docs/current/pgvector.html)

