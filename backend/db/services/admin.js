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
   * Get all approvals (placeholder - implement based on your approval system)
   */
  async getApprovals() {
    try {
      // TODO: Implement based on your approval system
      // This is a placeholder - you'll need to create an approvals table or use existing system
      // For now, return empty array so UI doesn't break
      return [];
    } catch (error) {
      console.error('Error fetching approvals:', error);
      // Return empty array on error so UI doesn't break
      return [];
    }
  }

  /**
   * Approve a request
   */
  async approveRequest(approvalId) {
    try {
      // TODO: Implement based on your approval system
      return { success: true, approvalId, message: 'Approval system not yet implemented' };
    } catch (error) {
      console.error('Error approving request:', error);
      throw new Error('Failed to approve request');
    }
  }

  /**
   * Remove/reject an approval
   */
  async removeApproval(approvalId) {
    try {
      // TODO: Implement based on your approval system
      return { success: true, approvalId, message: 'Approval system not yet implemented' };
    } catch (error) {
      console.error('Error removing approval:', error);
      throw new Error('Failed to remove approval');
    }
  }
}

module.exports = new AdminService();

