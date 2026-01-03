/**
 * Admin Service
 * Provides admin-only functionality for managing users, stats, and approvals
 */

const { getPrismaClient } = require('../index');
const userService = require('./user');
const conversationService = require('./conversation');
const creditSystem = require('../../config/creditSystem');

class AdminService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Get dashboard statistics
   * Returns: total cost, active users, top users, etc.
   */
  async getDashboardStats() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    
    const startOfMonth = new Date(now);
    startOfMonth.setMonth(startOfMonth.getMonth() - 1);
    
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all users with their token usage for current month
    const tokenUsage = await this.prisma.tokenUsage.findMany({
      where: {
        month: currentMonth,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            plan: true,
          },
        },
      },
    });

    // Calculate total cost for current month
    let totalCredits = 0;
    const userCredits = {};

    for (const usage of tokenUsage) {
      const credits = parseFloat(usage.creditsUsed) || 0;
      totalCredits += credits;
      
      if (!userCredits[usage.userId]) {
        userCredits[usage.userId] = {
          userId: usage.userId,
          username: usage.user.username,
          email: usage.user.email,
          plan: usage.user.plan,
          totalCredits: 0,
        };
      }
      userCredits[usage.userId].totalCredits += credits;
    }

    const totalCost = creditSystem.creditsToCost(totalCredits);

    // Get top users by credits (sorted)
    const topUsers = Object.values(userCredits)
      .sort((a, b) => b.totalCredits - a.totalCredits)
      .slice(0, 10);

    // Get active users (users with conversations)
    // Use groupBy for better performance
    const todayActiveUsers = await this.prisma.conversation.groupBy({
      by: ['userId'],
      where: {
        lastActive: {
          gte: startOfToday,
        },
        isDeleted: false,
      },
    });

    const weekActiveUsers = await this.prisma.conversation.groupBy({
      by: ['userId'],
      where: {
        lastActive: {
          gte: startOfWeek,
        },
        isDeleted: false,
      },
    });

    const monthActiveUsers = await this.prisma.conversation.groupBy({
      by: ['userId'],
      where: {
        lastActive: {
          gte: startOfMonth,
        },
        isDeleted: false,
      },
    });

    // Ensure totalCost is a valid number
    const safeTotalCost = isNaN(totalCost) || !isFinite(totalCost) ? 0 : totalCost;
    const safeTotalCredits = isNaN(totalCredits) || !isFinite(totalCredits) ? 0 : totalCredits;

    return {
      totalCost: safeTotalCost.toFixed(2),
      totalCredits: safeTotalCredits.toFixed(2),
      currentMonth,
      activeUsers: {
        today: todayActiveUsers.length,
        week: weekActiveUsers.length,
        month: monthActiveUsers.length,
      },
      topUsers: topUsers.map(user => {
        const safeUserCredits = isNaN(user.totalCredits) || !isFinite(user.totalCredits) ? 0 : user.totalCredits;
        return {
          ...user,
          totalCredits: safeUserCredits.toFixed(2),
          cost: creditSystem.creditsToCost(safeUserCredits).toFixed(2),
        };
      }),
    };
  }

  /**
   * Get all users with their usage statistics
   */
  async getAllUsers(includeDeleted = false) {
    const users = await this.prisma.user.findMany({
      include: {
        _count: {
          select: {
            conversations: true,
            userIntegrations: true,
          },
        },
      },
    });

    // Get last chat time for each user (including deleted if requested)
    const userStats = await Promise.all(
      users.map(async (user) => {
        // Get conversation count (filtered by isDeleted if needed)
        const conversationWhere = {
          userId: user.id,
          ...(includeDeleted ? {} : { isDeleted: false }),
        };
        
        const conversationCount = await this.prisma.conversation.count({
          where: conversationWhere,
        });

        // Get message count through conversations
        const messageCount = await this.prisma.message.count({
          where: {
            conversation: {
              userId: user.id,
              ...(includeDeleted ? {} : { isDeleted: false }),
            },
          },
        });

        const lastConversation = await this.prisma.conversation.findFirst({
          where: conversationWhere,
          orderBy: {
            lastActive: 'desc',
          },
          select: {
            lastActive: true,
            isDeleted: true,
          },
        });

        // Get current month credits
        const currentMonth = new Date();
        const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
        const tokenUsage = await this.prisma.tokenUsage.findMany({
          where: {
            userId: user.id,
            month: month,
          },
        });

        const totalCredits = tokenUsage.reduce((sum, usage) => {
          return sum + (parseFloat(usage.creditsUsed) || 0);
        }, 0);

        // Convert lastActive to IST (UTC+5:30)
        let lastChatTimeIST = null;
        if (lastConversation?.lastActive) {
          const utcDate = new Date(lastConversation.lastActive);
          const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
          lastChatTimeIST = istDate.toISOString();
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          plan: user.plan,
          createdAt: user.createdAt,
          conversationCount,
          messageCount,
          integrationCount: user._count.userIntegrations,
          lastChatTime: lastConversation?.lastActive || null,
          lastChatTimeIST,
          monthlyCredits: totalCredits.toFixed(2),
          monthlyCost: creditSystem.creditsToCost(totalCredits).toFixed(2),
        };
      })
    );

    return userStats;
  }

  /**
   * Get user details including all conversations (including deleted)
   */
  async getUserDetails(userId) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        conversations: {
          where: {}, // Include all conversations (including deleted)
          include: {
            _count: {
              select: { messages: true },
            },
          },
          orderBy: {
            lastActive: 'desc',
          },
        },
        tokenUsage: {
          orderBy: {
            month: 'desc',
          },
          take: 12, // Last 12 months
        },
      },
    });

    if (!user) {
      return null;
    }

    // Calculate total credits
    const totalCredits = user.tokenUsage.reduce((sum, usage) => {
      return sum + (parseFloat(usage.creditsUsed) || 0);
    }, 0);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      plan: user.plan,
      createdAt: user.createdAt,
      totalCredits: totalCredits.toFixed(2),
      totalCost: creditSystem.creditsToCost(totalCredits).toFixed(2),
      conversations: user.conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        isDeleted: conv.isDeleted,
        lastActive: conv.lastActive,
        messageCount: conv._count.messages,
        createdAt: conv.createdAt,
      })),
      monthlyUsage: user.tokenUsage.map(usage => ({
        month: usage.month,
        creditsUsed: parseFloat(usage.creditsUsed).toFixed(2),
        cost: creditSystem.creditsToCost(parseFloat(usage.creditsUsed)).toFixed(2),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      })),
    };
  }

  /**
   * Update user plan
   */
  async updateUserPlan(userId, plan) {
    const validPlans = ['free', 'pro', 'power', 'enterprise'];
    if (!validPlans.includes(plan)) {
      throw new Error(`Invalid plan. Must be one of: ${validPlans.join(', ')}`);
    }

    return await userService.updateUser(userId, { plan });
  }

  /**
   * Get conversation with messages (admin access - bypasses user ownership check)
   */
  async getConversation(conversationId) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      title: conversation.title,
      isDeleted: conversation.isDeleted,
      lastActive: conversation.lastActive,
      createdAt: conversation.createdAt,
      messages: conversation.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        metadata: msg.metadata,
      })),
    };
  }

  /**
   * Get all waitlist entries for approval management
   */
  async getApprovals() {
    try {
      // Get all waitlist entries
      const waitlistEntries = await this.prisma.waitlist.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Get all users to match with waitlist entries (for additional info if user exists)
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          plan: true,
        },
      });

      // Create a map of email -> user info
      const userMap = {};
      users.forEach(user => {
        if (user.email) {
          userMap[user.email.toLowerCase()] = user;
        }
      });

      // Map waitlist entries to approval format
      const approvalsList = waitlistEntries.map(entry => {
        const user = userMap[entry.email.toLowerCase()];
        return {
          id: entry.id, // Waitlist entry ID
          email: entry.email,
          isApproved: entry.isInvited,
          createdAt: entry.createdAt,
          // Include user info if user exists
          userId: user?.id || null,
          username: user?.username || null,
          plan: user?.plan || null,
        };
      });

      // Sort: unapproved (isApproved: false) first, then approved users
      return approvalsList.sort((a, b) => {
        // If both have same approval status, sort by creation date (newest first)
        if (a.isApproved === b.isApproved) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        // Unapproved (false) comes before approved (true)
        return a.isApproved ? 1 : -1;
      });
    } catch (error) {
      console.error('Error fetching approvals:', error);
      throw new Error('Failed to fetch approvals');
    }
  }

  /**
   * Approve a waitlist entry (set isInvited to true)
   * @param {string} waitlistId - The waitlist entry ID
   */
  async approveRequest(waitlistId) {
    try {
      // Get waitlist entry
      const waitlistEntry = await this.prisma.waitlist.findUnique({
        where: { id: waitlistId },
      });

      if (!waitlistEntry) {
        throw new Error('Waitlist entry not found');
      }

      // Update waitlist entry
      await this.prisma.waitlist.update({
        where: { id: waitlistId },
        data: { isInvited: true },
      });

      return { success: true, email: waitlistEntry.email, message: 'Waitlist entry approved successfully' };
    } catch (error) {
      console.error('Error approving waitlist entry:', error);
      throw new Error('Failed to approve waitlist entry');
    }
  }

  /**
   * Remove/reject an approval (set isInvited to false in waitlist)
   * @param {string} waitlistId - The waitlist entry ID
   */
  async removeApproval(waitlistId) {
    try {
      // Get waitlist entry
      const waitlistEntry = await this.prisma.waitlist.findUnique({
        where: { id: waitlistId },
      });

      if (!waitlistEntry) {
        throw new Error('Waitlist entry not found');
      }

      // Update waitlist entry
      await this.prisma.waitlist.update({
        where: { id: waitlistId },
        data: { isInvited: false },
      });

      return { success: true, email: waitlistEntry.email, message: 'Waitlist approval removed successfully' };
    } catch (error) {
      console.error('Error removing approval:', error);
      throw new Error('Failed to remove approval');
    }
  }

  /**
   * Check if a user is an admin
   */
  async isAdmin(userId) {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
    });
    return !!admin;
  }

  /**
   * Get admin by userId
   */
  async getAdminByUserId(userId) {
    return await this.prisma.admin.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  /**
   * Get all admins
   */
  async getAllAdmins() {
    return await this.prisma.admin.findMany({
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Add a user as admin
   */
  async addAdmin(userId, addedByUserId) {
    // Get user to get email
    const userService = require('./user');
    const user = await userService.getUserById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Check if already admin
    const existingAdmin = await this.prisma.admin.findUnique({
      where: { userId },
    });

    if (existingAdmin) {
      throw new Error('User is already an admin');
    }

    return await this.prisma.admin.create({
      data: {
        userId,
        email: user.email || '',
        addedBy: addedByUserId,
      },
    });
  }

  /**
   * Remove admin privileges from a user
   */
  async removeAdmin(userId) {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
    });

    if (!admin) {
      throw new Error('User is not an admin');
    }

    return await this.prisma.admin.delete({
      where: { userId },
    });
  }

  /**
   * Get all integration settings
   */
  async getIntegrationSettings() {
    const settings = await this.prisma.integrationSetting.findMany({
      orderBy: { provider: 'asc' },
    });

    // Get all available integrations from registry
    const integrationRegistry = require('../../mcp/integrations/index.js');
    const allIntegrations = Object.keys(integrationRegistry);

    // Create a map of existing settings
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.provider] = setting;
    });

    // Return all integrations with their enabled status
    return allIntegrations.map(provider => {
      const setting = settingsMap[provider];
      const registryInfo = integrationRegistry[provider];
      return {
        provider,
        name: registryInfo?.name || provider,
        description: registryInfo?.description || '',
        icon: registryInfo?.icon || '',
        isEnabled: setting ? setting.isEnabled : true, // Default to enabled if no setting exists
      };
    });
  }

  /**
   * Update integration setting (enable/disable)
   */
  async updateIntegrationSetting(provider, isEnabled) {
    return await this.prisma.integrationSetting.upsert({
      where: { provider },
      update: { isEnabled },
      create: {
        provider,
        isEnabled,
      },
    });
  }
}

module.exports = new AdminService();

