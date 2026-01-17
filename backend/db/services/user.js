/**
 * User Service
 * Manages user accounts and authentication
 */

const { getPrismaClient } = require('../index');

class UserService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Create a new user
   */
  async createUser(username, email = null) {
    return await this.prisma.user.create({
      data: {
        username,
        email,
      },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username) {
    return await this.prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Get or create user (useful for OAuth flows)
   * Can accept either username or userId (id)
   */
  async getOrCreateUser(usernameOrId, email = null) {
    // First try to find by ID
    let user = await this.getUserById(usernameOrId);
    
    // If not found, try username
    if (!user) {
      user = await this.getUserByUsername(usernameOrId);
    }
    
    // If still not found and email provided, try email
    if (!user && email) {
      user = await this.getUserByEmail(email);
    }

    // If still not found, create new user (using usernameOrId as username)
    if (!user) {
      user = await this.createUser(usernameOrId, email);
    }

    return user;
  }

  /**
   * Update user
   */
  async updateUser(userId, data) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Soft delete user (sets isDeleted flag to prevent re-login)
   * This prevents users from deleting and re-creating accounts to abuse free credits
   */
  async deleteUser(userId) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { 
        isDeleted: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    const [conversationCount, messageCount, integrationCount, memoryCount] = await Promise.all([
      this.prisma.conversation.count({ where: { userId } }),
      this.prisma.message.count({
        where: {
          conversation: { userId },
        },
      }),
      this.prisma.userIntegration.count({
        where: { userId, isActive: true },
      }),
      this.prisma.memoryVector.count({ where: { userId } }),
    ]);

    return {
      conversations: conversationCount,
      messages: messageCount,
      integrations: integrationCount,
      memories: memoryCount,
    };
  }
}

module.exports = new UserService();

