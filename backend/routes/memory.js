/**
 * Memory API Routes - MEMORY TYPE 3: LONG-TERM SEMANTIC MEMORY
 * 
 * Semantic search and vector embeddings for LangChain integration
 * Uses pgvector for efficient similarity search
 * 
 * Endpoints:
 * - POST /api/memory/vector - Store embedding
 * - POST /api/memory/search - Semantic search by embedding
 * - POST /api/memory/hybrid-search - Combined vector + keyword search
 * - GET /api/memory/user - Get user's memories
 * - GET /api/memory/conversation/:id - Get conversation memories
 * - DELETE /api/memory/:id - Delete specific memory
 */

const express = require('express');
const router = express.Router();
const memoryService = require('../db/services/memory');
const embeddingService = require('../ai-providers/embeddings');

/**
 * Helper: Generate embedding for text (uses unified embedding service)
 */
async function generateEmbedding(text) {
  return await embeddingService.generateEmbedding(text);
}

/**
 * POST /api/memory
 * Store a memory with embedding (auto-generated)
 * 
 * Body: {userId, content, conversationId?, messageId?, metadata?}
 */
router.post('/', async (req, res) => {
  try {
    const { userId, content, conversationId, messageId, metadata } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ error: 'userId and content are required' });
    }

    // Generate embedding
    const embedding = await generateEmbedding(content);

    // Store memory
    const memory = await memoryService.storeMemory(
      userId,
      content,
      embedding,
      conversationId,
      messageId,
      metadata
    );

    res.json(memory);
  } catch (error) {
    console.error('Error storing memory:', error);
    res.status(500).json({ error: 'Failed to store memory' });
  }
});

/**
 * POST /api/memory/vector
 * Store a memory with pre-computed embedding
 * For LangChain integration where embeddings are generated client-side
 * 
 * Body: {userId, content, embedding, conversationId?, messageId?, metadata?}
 * - embedding: Array of 1536 floats (text-embedding-3-small)
 */
router.post('/vector', async (req, res) => {
  try {
    const { userId, content, embedding, conversationId, messageId, metadata } = req.body;

    if (!userId || !content || !embedding) {
      return res.status(400).json({ error: 'userId, content, and embedding are required' });
    }

    if (!Array.isArray(embedding) || embedding.length !== 1536) {
      return res.status(400).json({ error: 'embedding must be an array of 1536 floats' });
    }

    // Store memory with provided embedding
    const memory = await memoryService.storeMemory(
      userId,
      content,
      embedding,
      conversationId,
      messageId,
      metadata
    );

    res.json(memory);
  } catch (error) {
    console.error('Error storing memory vector:', error);
    res.status(500).json({ error: 'Failed to store memory vector' });
  }
});

/**
 * POST /api/memory/search
 * Semantic search for similar memories (query text)
 * 
 * Body: {userId, query, conversationId?, limit?, topK?}
 * - query: Text to search for
 * - limit/topK: Number of results (default: 5)
 * 
 * Uses pgvector cosine similarity: embedding <-> query_embedding
 */
router.post('/search', async (req, res) => {
  try {
    const { userId, query, conversationId, limit, topK } = req.body;

    if (!userId || !query) {
      return res.status(400).json({ error: 'userId and query are required' });
    }

    // Generate embedding for query
    const embedding = await generateEmbedding(query);

    // Search similar memories
    const resultLimit = limit || topK || 5;
    const results = await memoryService.searchSimilar(
      userId,
      embedding,
      resultLimit,
      conversationId
    );

    res.json(results);
  } catch (error) {
    console.error('Error searching memories:', error);
    res.status(500).json({ error: 'Failed to search memories' });
  }
});

/**
 * POST /api/memory/search/vector
 * Semantic search with pre-computed embedding
 * For LangChain integration
 * 
 * Body: {userId, queryEmbedding, conversationId?, topK?}
 * - queryEmbedding: Array of 1536 floats
 * - topK: Number of results (default: 5)
 * 
 * Returns: Top K semantically similar results with similarity scores
 */
router.post('/search/vector', async (req, res) => {
  try {
    const { userId, queryEmbedding, conversationId, topK } = req.body;

    if (!userId || !queryEmbedding) {
      return res.status(400).json({ error: 'userId and queryEmbedding are required' });
    }

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== 1536) {
      return res.status(400).json({ error: 'queryEmbedding must be an array of 1536 floats' });
    }

    // Search similar memories
    const results = await memoryService.searchSimilar(
      userId,
      queryEmbedding,
      topK || 5,
      conversationId
    );

    res.json(results);
  } catch (error) {
    console.error('Error searching memories:', error);
    res.status(500).json({ error: 'Failed to search memories' });
  }
});

/**
 * POST /api/memory/hybrid-search
 * Hybrid search: vector similarity + keyword matching
 */
router.post('/hybrid-search', async (req, res) => {
  try {
    const { userId, query, keywords, conversationId, limit } = req.body;

    if (!userId || !query || !keywords) {
      return res.status(400).json({ error: 'userId, query, and keywords are required' });
    }

    // Generate embedding for query
    const embedding = await generateEmbedding(query);

    // Hybrid search
    const results = await memoryService.hybridSearch(
      userId,
      embedding,
      keywords,
      limit || 10,
      conversationId
    );

    res.json(results);
  } catch (error) {
    console.error('Error in hybrid search:', error);
    res.status(500).json({ error: 'Failed to perform hybrid search' });
  }
});

/**
 * GET /api/memory/conversation/:id
 * Get all memories for a conversation
 */
router.get('/conversation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const memories = await memoryService.getConversationMemories(id, limit);
    res.json(memories);
  } catch (error) {
    console.error('Error fetching conversation memories:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

/**
 * GET /api/memory/user
 * Get user's memories
 */
router.get('/user', async (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const memories = await memoryService.getUserMemories(userId, limit, offset);
    res.json(memories);
  } catch (error) {
    console.error('Error fetching user memories:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

/**
 * DELETE /api/memory/:id
 * Delete a specific memory
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId || 'default-user';

    await memoryService.deleteMemory(id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

module.exports = router;

