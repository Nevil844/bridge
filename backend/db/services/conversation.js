/**
 * Conversation Service
 * Handles conversation and message persistence
 */

const { getPrismaClient } = require('../index');
const userService = require('./user');

class ConversationService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Create a new conversation
   * Automatically creates user if they don't exist (multi-tenant friendly)
   */
  async createConversation(userId, title = 'New Chat') {
    // Ensure user exists (create if not) - userId might be username or actual ID
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.conversation.create({
      data: {
        userId: user.id, // Use the actual user ID from database
        title,
        lastActive: new Date(),
      },
    });
  }

  /**
   * Get user's conversations (paginated)
   * Automatically creates user if they don't exist
   */
  async getUserConversations(userId, limit = 50, offset = 0) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { lastActive: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        lastActive: true,
        createdAt: true,
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  /**
   * Get conversation by ID
   * Automatically creates user if they don't exist
   */
  async getConversation(conversationId, userId) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(conversationId, userId, title) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.conversation.update({
      where: {
        id: conversationId,
        userId: user.id,
      },
      data: {
        title,
        lastActive: new Date(),
      },
    });
  }

  /**
   * Delete conversation (cascade deletes messages)
   */
  async deleteConversation(conversationId, userId) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.conversation.delete({
      where: {
        id: conversationId,
        userId: user.id,
      },
    });
  }

  /**
   * Delete all conversations for a user (cascade deletes messages)
   */
  async deleteAllConversations(userId) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.conversation.deleteMany({
      where: {
        userId: user.id,
      },
    });
  }

  /**
   * Add message to conversation
   */
  async addMessage(conversationId, role, content, metadata = null) {
    // Update conversation's lastActive timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastActive: new Date() },
    });

    return await this.prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        metadata,
      },
    });
  }

  /**
   * Get conversation history (last N messages)
   * Perfect for LangChain memory
   */
  async getConversationHistory(conversationId, limit = 20) {
    const messages = await this.prisma.message.findMany({
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

  /**
   * Get messages with pagination
   */
  async getMessages(conversationId, limit = 50, offset = 0) {
    return await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Bulk add messages (efficient for initial conversation creation)
   */
  async addMessages(conversationId, messages) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastActive: new Date() },
    });

    return await this.prisma.message.createMany({
      data: messages.map(msg => ({
        conversationId,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata || null,
      })),
    });
  }

  /**
   * Search conversations by title or message content
   */
  async searchConversations(userId, query, limit = 10) {
    return await this.prisma.conversation.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          {
            messages: {
              some: {
                content: { contains: query, mode: 'insensitive' },
              },
            },
          },
        ],
      },
      orderBy: { lastActive: 'desc' },
      take: limit,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });
  }
}

module.exports = new ConversationService();

