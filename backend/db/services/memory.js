/**
 * Memory Service
 * Handles vector embeddings for semantic search and RAG
 */

const { getPrismaClient } = require('../index');
const userService = require('./user');

class MemoryService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Store a memory vector
   * Note: Using raw SQL because Prisma doesn't support vector type directly
   */
  async storeMemory(userId, content, embedding, conversationId = null, messageId = null, metadata = null) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const embeddingStr = `[${embedding.join(',')}]`;
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    
    // Use raw SQL because Prisma's Unsupported type doesn't support create operations
    // Generate CUID-like ID (Prisma's default)
    const { randomBytes } = require('crypto');
    const id = 'cm' + randomBytes(16).toString('hex');
    
    const result = await this.prisma.$queryRawUnsafe(`
      INSERT INTO memory_vectors (id, "userId", "conversationId", "messageId", embedding, content, metadata, "createdAt")
      VALUES ($1, $2, $3, $4, $5::vector, $6, $7::jsonb, NOW())
      RETURNING id, "userId", "conversationId", "messageId", content, metadata, "createdAt"
    `, id, user.id, conversationId, messageId, embeddingStr, content, metadataStr);
    
    return result[0];
  }

  /**
   * Bulk store memories
   * Note: Using raw SQL because Prisma doesn't support vector type directly
   */
  async storeMemories(memories) {
    if (memories.length === 0) return { count: 0 };
    
    const { randomBytes } = require('crypto');
    
    // Build bulk insert query with generated IDs
    const values = memories.map((mem, idx) => {
      const baseIdx = idx * 7;
      const id = 'cm' + randomBytes(16).toString('hex');
      return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}::vector, $${baseIdx + 6}, $${baseIdx + 7}::jsonb, NOW())`;
    }).join(', ');
    
    const params = memories.flatMap(mem => {
      const id = 'cm' + randomBytes(16).toString('hex');
      return [
        id,
        mem.userId,
        mem.conversationId || null,
        mem.messageId || null,
        `[${mem.embedding.join(',')}]`,
        mem.content,
        mem.metadata ? JSON.stringify(mem.metadata) : null,
      ];
    });
    
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO memory_vectors (id, "userId", "conversationId", "messageId", embedding, content, metadata, "createdAt")
      VALUES ${values}
    `, ...params);
    
    return { count: memories.length };
  }

  /**
   * Semantic search using cosine similarity
   * Returns top N most similar memories
   */
  async searchSimilar(userId, queryEmbedding, limit = 5, conversationId = null) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    const whereClause = conversationId 
      ? `WHERE "userId" = $1 AND "conversationId" = $2`
      : `WHERE "userId" = $1`;
    
    const params = conversationId ? [user.id, conversationId] : [user.id];

    const results = await this.prisma.$queryRawUnsafe(`
      SELECT 
        id,
        content,
        metadata,
        "conversationId",
        "messageId",
        "createdAt",
        1 - (embedding <=> $${params.length + 1}::vector) as similarity
      FROM memory_vectors
      ${whereClause}
      ORDER BY embedding <=> $${params.length + 1}::vector
      LIMIT $${params.length + 2}
    `, ...params, embeddingStr, limit);

    return results;
  }

  /**
   * Get memories by conversation
   */
  async getConversationMemories(conversationId, limit = 20) {
    return await this.prisma.memoryVector.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all user memories
   */
  async getUserMemories(userId, limit = 50, offset = 0) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.memoryVector.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Delete memories by conversation
   */
  async deleteConversationMemories(conversationId) {
    return await this.prisma.memoryVector.deleteMany({
      where: { conversationId },
    });
  }

  /**
   * Delete specific memory
   */
  async deleteMemory(memoryId, userId) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.memoryVector.delete({
      where: {
        id: memoryId,
        userId: user.id,
      },
    });
  }

  /**
   * Hybrid search: combine vector similarity with keyword search
   */
  async hybridSearch(userId, queryEmbedding, keywords, limit = 10, conversationId = null) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    const whereClause = conversationId 
      ? `WHERE "userId" = $1 AND "conversationId" = $2 AND (content ILIKE $3)`
      : `WHERE "userId" = $1 AND (content ILIKE $2)`;
    
    // Sanitize keywords to prevent SQL injection
    const sanitizedKeywords = keywords.replace(/[%_\\]/g, '\\$&');
    const keywordPattern = `%${sanitizedKeywords}%`;
    const params = conversationId 
      ? [user.id, conversationId, keywordPattern] 
      : [user.id, keywordPattern];

    const results = await this.prisma.$queryRawUnsafe(`
      SELECT 
        id,
        content,
        metadata,
        "conversationId",
        "messageId",
        "createdAt",
        1 - (embedding <=> $${params.length + 1}::vector) as similarity
      FROM memory_vectors
      ${whereClause}
      ORDER BY embedding <=> $${params.length + 1}::vector
      LIMIT $${params.length + 2}
    `, ...params, embeddingStr, limit);

    return results;
  }
}

module.exports = new MemoryService();

