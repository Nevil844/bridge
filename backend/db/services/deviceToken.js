/**
 * Device Token Service
 * Manages push notification device tokens
 */

const { getPrismaClient } = require('../index');

class DeviceTokenService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Register or update a device token
   */
  async registerToken(userId, token, platform) {
    try {
      return await this.prisma.deviceToken.upsert({
        where: { token },
        update: { userId, platform, isActive: true },
        create: { userId, token, platform, isActive: true },
      });
    } catch (error) {
      console.error('Error registering device token:', error);
      throw new Error('Failed to register device token');
    }
  }

  /**
   * Get all active tokens for a user
   */
  async getUserTokens(userId) {
    try {
      return await this.prisma.deviceToken.findMany({
        where: {
          userId,
          isActive: true,
        },
      });
    } catch (error) {
      console.error('Error fetching user tokens:', error);
      throw new Error('Failed to fetch user tokens');
    }
  }

  /**
   * Get all active tokens for multiple users
   */
  async getUsersTokens(userIds) {
    try {
      return await this.prisma.deviceToken.findMany({
        where: {
          userId: { in: userIds },
          isActive: true,
        },
      });
    } catch (error) {
      console.error('Error fetching users tokens:', error);
      throw new Error('Failed to fetch users tokens');
    }
  }

  /**
   * Deactivate a token (user opts out or uninstalls)
   */
  async deactivateToken(token) {
    try {
      return await this.prisma.deviceToken.update({
        where: { token },
        data: { isActive: false },
      });
    } catch (error) {
      // Token might not exist, that's okay
      if (error.code === 'P2025') {
        return null;
      }
      console.error('Error deactivating token:', error);
      throw new Error('Failed to deactivate token');
    }
  }

}

module.exports = new DeviceTokenService();

