/**
 * Tool Context Service
 * Manages stateful multi-step tool operations (cart, drafts, playlists, etc.)
 */

const { getPrismaClient } = require('../index');

class ToolContextService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Store or update tool context
   * Automatically deactivates previous contexts for the same tool
   */
  async storeContext(conversationId, toolName, state) {
    // Deactivate previous contexts for this tool
    await this.prisma.toolContext.updateMany({
      where: {
        conversationId,
        toolName,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Create new active context
    return await this.prisma.toolContext.create({
      data: {
        conversationId,
        toolName,
        state,
        isActive: true,
      },
    });
  }

  /**
   * Get active context for a specific tool
   */
  async getActiveContext(conversationId, toolName) {
    return await this.prisma.toolContext.findFirst({
      where: {
        conversationId,
        toolName,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Get all active contexts for a conversation
   */
  async getActiveContexts(conversationId) {
    return await this.prisma.toolContext.findMany({
      where: {
        conversationId,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Get conversation contexts (optionally filter by active status)
   * For LangChain integration
   */
  async getConversationContexts(conversationId, activeOnly = false) {
    const where = { conversationId };
    if (activeOnly) {
      where.isActive = true;
    }

    return await this.prisma.toolContext.findMany({
      where,
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Update existing context state
   */
  async updateContext(contextId, state) {
    return await this.prisma.toolContext.update({
      where: { id: contextId },
      data: {
        state,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Deactivate a specific context
   */
  async deactivateContext(contextId) {
    return await this.prisma.toolContext.update({
      where: { id: contextId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Deactivate all contexts for a conversation
   */
  async deactivateAllContexts(conversationId) {
    return await this.prisma.toolContext.updateMany({
      where: {
        conversationId,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get context history (including inactive)
   */
  async getContextHistory(conversationId, toolName = null) {
    const where = { conversationId };
    if (toolName) where.toolName = toolName;

    return await this.prisma.toolContext.findMany({
      where,
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }
}

module.exports = new ToolContextService();

