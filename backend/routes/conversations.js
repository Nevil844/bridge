/**
 * Conversation API Routes
 * RESTful endpoints for conversation management
 */

const express = require('express');
const router = express.Router();
const conversationService = require('../db/services/conversation');
const memoryService = require('../db/services/memory');
const toolContextService = require('../db/services/toolContext');
const { verifyUser } = require('../middleware/auth');

// Unified embedding service (supports OpenAI and AWS Bedrock Titan)
const embeddingService = require('../ai-providers/embeddings');

// Helper: Generate embeddings (uses unified service)
const generateEmbedding = async (text) => {
  return await embeddingService.generateEmbedding(text);
};

/**
 * GET /api/conversations
 * Get user's conversations with pagination
 * Query params:
 * - limit: Number of conversations (default: 50)
 * - offset: Pagination offset (default: 0)
 * - includeDeleted: Include deleted conversations (default: false - users don't see deleted chats)
 */
router.get('/', verifyUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const includeDeleted = req.query.includeDeleted === 'true'; // Default to false - hide deleted from users

    const conversations = await conversationService.getUserConversations(
      req.userId, 
      limit, 
      offset, 
      includeDeleted
    );
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post('/', verifyUser, async (req, res) => {
  try {
    const { title } = req.body;

    const conversation = await conversationService.createConversation(req.userId, title);
    res.json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/conversations/:id
 * Get conversation with messages
 */
router.get('/:id', verifyUser, async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await conversationService.getConversation(id, req.userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update conversation title
 */
router.patch('/:id', verifyUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const conversation = await conversationService.updateConversationTitle(id, req.userId, title);
    res.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete conversation and all related data
 */
router.delete('/:id', verifyUser, async (req, res) => {
  try {
    const { id } = req.params;

    await conversationService.deleteConversation(id, req.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * DELETE /api/conversations
 * Delete all conversations for the authenticated user
 */
router.delete('/', verifyUser, async (req, res) => {
  try {
    const result = await conversationService.deleteAllConversations(req.userId);
    res.json({ 
      success: true, 
      deletedCount: result.count 
    });
  } catch (error) {
    console.error('Error deleting all conversations:', error);
    res.status(500).json({ error: 'Failed to delete all conversations' });
  }
});

/**
 * GET /api/conversations/:id/messages
 * Get conversation messages with pagination
 */
router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const messages = await conversationService.getMessages(id, limit, offset);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * MEMORY TYPE 1: SHORT-TERM CONTEXT MEMORY
 * GET /api/conversations/:id/history
 * Get last N messages in LangChain-compatible format
 * 
 * Returns: Array of {role, content} for ConversationBufferWindowMemory
 * Query params:
 * - limit: Number of recent messages to fetch (default: 20)
 * - format: 'langchain' for LangChain format, 'raw' for full message objects
 */
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const format = req.query.format || 'langchain';

    const history = await conversationService.getConversationHistory(id, limit);
    
    // Transform to LangChain format if requested
    if (format === 'langchain') {
      const langchainFormat = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      return res.json(langchainFormat);
    }
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * GET /api/conversations/search
 * Search conversations by title or content
 */
router.get('/search', verifyUser, async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 10;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await conversationService.searchConversations(req.userId, query, limit);
    res.json(results);
  } catch (error) {
    console.error('Error searching conversations:', error);
    res.status(500).json({ error: 'Failed to search conversations' });
  }
});

// ============================================
// MEMORY TYPE 2: WORKING MEMORY (Tool Contexts)
// ============================================

/**
 * POST /api/conversations/:id/tool-context
 * Create or update tool context for multi-turn flows
 * 
 * Body: {toolName, state}
 * - toolName: Name of the tool being used
 * - state: JSON object with tool state (step, params, etc.)
 * 
 * Automatically deactivates previous contexts for same tool
 */
router.post('/:id/tool-context', async (req, res) => {
  try {
    const { id } = req.params;
    const { toolName, state } = req.body;
    
    if (!toolName || !state) {
      return res.status(400).json({ error: 'toolName and state are required' });
    }
    
    const context = await toolContextService.storeContext(id, toolName, state);
    res.json(context);
  } catch (error) {
    console.error('Error storing tool context:', error);
    res.status(500).json({ error: 'Failed to store tool context' });
  }
});

/**
 * GET /api/conversations/:id/tool-context/active
 * Get active tool context for conversation
 * Query params:
 * - toolName: Optional, filter by specific tool
 */
router.get('/:id/tool-context/active', async (req, res) => {
  try {
    const { id } = req.params;
    const { toolName } = req.query;
    
    if (toolName) {
      const context = await toolContextService.getActiveContext(id, toolName);
      return res.json(context);
    }
    
    // Get all active contexts for this conversation
    const contexts = await toolContextService.getConversationContexts(id, true);
    res.json(contexts);
  } catch (error) {
    console.error('Error fetching tool context:', error);
    res.status(500).json({ error: 'Failed to fetch tool context' });
  }
});

/**
 * PATCH /api/conversations/:id/tool-context/:contextId
 * Update tool context state
 * 
 * Body: {state}
 */
router.patch('/:id/tool-context/:contextId', async (req, res) => {
  try {
    const { contextId } = req.params;
    const { state } = req.body;
    
    if (!state) {
      return res.status(400).json({ error: 'state is required' });
    }
    
    const context = await toolContextService.updateContext(contextId, state);
    res.json(context);
  } catch (error) {
    console.error('Error updating tool context:', error);
    res.status(500).json({ error: 'Failed to update tool context' });
  }
});

/**
 * PATCH /api/conversations/:id/tool-context/:contextId/deactivate
 * Deactivate tool context (mark as complete)
 */
router.patch('/:id/tool-context/:contextId/deactivate', async (req, res) => {
  try {
    const { contextId } = req.params;
    
    const context = await toolContextService.deactivateContext(contextId);
    res.json(context);
  } catch (error) {
    console.error('Error deactivating tool context:', error);
    res.status(500).json({ error: 'Failed to deactivate tool context' });
  }
});

// ============================================
// UNIFIED MEMORY ENDPOINT (ALL 3 TYPES)
// ============================================

/**
 * GET /api/conversations/:id/full-context
 * Get complete context combining all 3 memory types
 * 
 * Query params:
 * - recentLimit: Number of recent messages (default: 20)
 * - semanticLimit: Number of semantic results (default: 5)
 * - query: Optional query for semantic search (defaults to last user message)
 * 
 * Returns:
 * {
 *   recent: [...],           // Short-term: Last N messages
 *   toolContext: {...},      // Working: Active tool state
 *   semantic: [...]          // Long-term: Semantically similar memories
 * }
 * 
 * Perfect for LangChain integration!
 */
router.get('/:id/full-context', verifyUser, async (req, res) => {
  try {
    const { id } = req.params;
    const recentLimit = parseInt(req.query.recentLimit) || 20;
    const semanticLimit = parseInt(req.query.semanticLimit) || 5;
    const query = req.query.query;
    
    // 1. SHORT-TERM: Recent messages
    const recent = await conversationService.getConversationHistory(id, recentLimit);
    
    // 2. WORKING: Active tool contexts
    const toolContexts = await toolContextService.getConversationContexts(id, true);
    const toolContext = toolContexts.length > 0 ? toolContexts[0] : null;
    
    // 3. LONG-TERM: Semantic search
    let semantic = [];
    if (embeddingService.isConfigured()) {
      try {
        // Use provided query or last user message
        const searchQuery = query || (recent.length > 0 ? recent[recent.length - 1].content : '');
        
        if (searchQuery) {
          const embedding = await generateEmbedding(searchQuery);
          if (embedding) {
            semantic = await memoryService.searchSimilar(
              req.userId,
              embedding,
              semanticLimit,
              id
            );
          }
        }
      } catch (error) {
        console.error('Error fetching semantic memories:', error);
        // Continue without semantic search
      }
    }
    
    // Return unified context
    res.json({
      recent: recent.map(msg => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt
      })),
      toolContext: toolContext ? {
        toolName: toolContext.toolName,
        state: toolContext.state,
        isActive: toolContext.isActive
      } : null,
      semantic: semantic.map(mem => ({
        content: mem.content,
        similarity: mem.similarity,
        createdAt: mem.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching full context:', error);
    res.status(500).json({ error: 'Failed to fetch full context' });
  }
});

module.exports = router;

