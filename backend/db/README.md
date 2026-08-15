# Database Services

This directory contains the Prisma database client and service layer for Bridge AI.

## Structure

```
db/
├── index.js                    # Prisma client singleton
├── services/
│   ├── conversation.js         # Conversation & message management
│   ├── integration.js          # User integrations (OAuth, encrypted)
│   ├── memory.js               # Vector embeddings & semantic search
│   ├── toolContext.js          # Multi-step tool state management
│   ├── user.js                 # User account management
│   └── tokenUsage.js           # AI token tracking & billing
```

## Usage

### Import Services

```javascript
const conversationService = require('./db/services/conversation');
const integrationService = require('./db/services/integration');
const memoryService = require('./db/services/memory');
const toolContextService = require('./db/services/toolContext');
const userService = require('./db/services/user');
const tokenUsageService = require('./db/services/tokenUsage');
```

### Conversation Service

```javascript
// Create conversation
const conv = await conversationService.createConversation('user123', 'My Chat');

// Add message
await conversationService.addMessage(conv.id, 'user', 'Hello!');

// Get history (for LangChain)
const history = await conversationService.getConversationHistory(conv.id, 10);

// Search conversations
const results = await conversationService.searchConversations('user123', 'github');
```

### Integration Service

```javascript
// Store OAuth credentials (auto-encrypted)
await integrationService.storeIntegration(
  'user123',
  'github',
  { access_token: 'token', refresh_token: 'refresh' }
);

// Get integration
const github = await integrationService.getIntegration('user123', 'github');

// Check if user has integration
const hasGithub = await integrationService.hasIntegration('user123', 'github');
```

### Memory Service (Semantic Search)

```javascript
// Store memory with embedding
await memoryService.storeMemory(
  'user123',
  'User wants to create GitHub repos',
  embedding,  // array of 1536 floats
  conversationId
);

// Semantic search
const similar = await memoryService.searchSimilar(
  'user123',
  queryEmbedding,
  5  // top 5 results
);

// Hybrid search (vector + keywords)
const results = await memoryService.hybridSearch(
  'user123',
  queryEmbedding,
  'github repository'
);
```

### Tool Context Service

```javascript
// Store context (auto-deactivates previous)
await toolContextService.storeContext(
  conversationId,
  'zomato',
  { cart: [{ item: 'Pizza', qty: 2 }] }
);

// Get active context
const cart = await toolContextService.getActiveContext(conversationId, 'zomato');

// Get all active contexts
const allContexts = await toolContextService.getActiveContexts(conversationId);
```

### User Service

```javascript
// Get or create user
const user = await userService.getOrCreateUser('john_doe', 'john@example.com');

// Get user stats
const stats = await userService.getUserStats('user123');
// { conversations: 10, messages: 150, integrations: 3, memories: 45 }
```

### Token Usage Service

```javascript
// Track usage
await tokenUsageService.trackUsage(
  'user123',
  'gemini-2.5-flash',
  500,  // input tokens
  1000  // output tokens
);

// Get current month total
const usage = await tokenUsageService.getCurrentMonthTotal('user123');
// { inputTokens: 5000, outputTokens: 10000, totalTokens: 15000 }

// Check if over limit
const isOverLimit = await tokenUsageService.isOverLimit('user123', 100000);
```

## Database Schema

See `/backend/prisma/schema.prisma` for the full schema.

Key models:
- **User** - User accounts
- **Conversation** - Chat sessions
- **Message** - Chat messages
- **ToolContext** - Stateful tool operations
- **MemoryVector** - Semantic embeddings (pgvector)
- **UserIntegration** - Encrypted OAuth credentials
- **TokenUsage** - AI token consumption

## Features

### 🔐 Automatic Encryption
OAuth credentials in `UserIntegration` are automatically encrypted/decrypted using `ENCRYPTION_KEY`.

### 🔍 Semantic Search
`MemoryVector` uses pgvector for fast cosine similarity search on 1536-dimensional embeddings.

### 🗑️ Cascade Deletes
Deleting a user cascades to all conversations, messages, integrations, and memories.

### 📊 Indexes
Optimized indexes for common queries:
- User conversations by `lastActive`
- Messages by conversation and timestamp
- Vector similarity search (HNSW index)

## Best Practices

### 1. Always use userId for multi-tenancy
```javascript
// Good
await conversationService.getUserConversations(userId);

// Bad (no user isolation)
await prisma.conversation.findMany();
```

### 2. Use services instead of raw Prisma
```javascript
// Good
await conversationService.addMessage(convId, 'user', 'Hello');

// Acceptable but less maintainable
await prisma.message.create({ data: { ... } });
```

### 3. Handle errors gracefully
```javascript
try {
  await conversationService.deleteConversation(id, userId);
} catch (error) {
  if (error.code === 'P2025') {
    // Record not found
  }
}
```

### 4. Use transactions for complex operations
```javascript
const prisma = getPrismaClient();

await prisma.$transaction(async (tx) => {
  await tx.conversation.create({ ... });
  await tx.message.create({ ... });
});
```

## Development

### View Database
```bash
npm run db:studio
```

### Run Migrations
```bash
npx prisma migrate dev
```

### Reset Database
```bash
npm run db:reset  # Warning: deletes all data!
```

## See Also

- `/backend/prisma/README.md` - Prisma setup guide

