/**
 * Notification Service
 * Handles creation, scheduling, and sending of notifications
 */

const { getPrismaClient } = require('../index');

class NotificationService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Create a new notification
   */
  async createNotification(data) {
    try {
      const {
        title,
        message,
        type = 'push',
        targetType = 'all',
        targetValue = null,
        scheduledFor = null,
        createdBy,
        metadata = {},
      } = data;

      // If scheduledFor is null, set status to 'pending' for immediate send
      const status = scheduledFor && new Date(scheduledFor) > new Date() 
        ? 'pending' 
        : 'pending';

      const notification = await this.prisma.notification.create({
        data: {
          title,
          message,
          type,
          targetType,
          targetValue,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          status,
          createdBy,
          metadata,
        },
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error('Failed to create notification');
    }
  }

  /**
   * Get all notifications with pagination
   */
  async getAllNotifications(skip = 0, take = 5) {
    try {
      const notifications = await this.prisma.notification.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      });

      return notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw new Error('Failed to fetch notifications');
    }
  }

  /**
   * Get notifications count
   */
  async getNotificationsCount() {
    try {
      return await this.prisma.notification.count();
    } catch (error) {
      console.error('Error counting notifications:', error);
      throw new Error('Failed to count notifications');
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(id) {
    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id },
      });

      return notification;
    } catch (error) {
      console.error('Error fetching notification:', error);
      throw new Error('Failed to fetch notification');
    }
  }

  /**
   * Update notification
   */
  async updateNotification(id, data) {
    try {
      const notification = await this.prisma.notification.update({
        where: { id },
        data: {
          ...data,
          scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
        },
      });

      return notification;
    } catch (error) {
      console.error('Error updating notification:', error);
      throw new Error('Failed to update notification');
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(id) {
    try {
      await this.prisma.notification.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw new Error('Failed to delete notification');
    }
  }

  /**
   * Cancel a pending notification
   */
  async cancelNotification(id) {
    try {
      const notification = await this.prisma.notification.update({
        where: { id },
        data: {
          status: 'cancelled',
        },
      });

      return notification;
    } catch (error) {
      console.error('Error cancelling notification:', error);
      throw new Error('Failed to cancel notification');
    }
  }

  /**
   * Get pending notifications that are ready to send
   */
  async getPendingNotifications() {
    try {
      const now = new Date();
      
      const notifications = await this.prisma.notification.findMany({
        where: {
          status: 'pending',
          OR: [
            { scheduledFor: null }, // Immediate send
            { scheduledFor: { lte: now } }, // Scheduled time has passed
          ],
        },
      });

      // Filter out disabled cron notifications and log for debugging
      const filtered = notifications.filter(notification => {
        const metadata = notification.metadata || {};
        const hasCron = metadata.cronExpression;
        if (hasCron) {
          // If cron is explicitly disabled, skip it
          const isEnabled = metadata.cronEnabled !== false;
          if (!isEnabled) {
            console.log(`[${new Date().toISOString()}] ⏸️  Skipping disabled cron notification: ${notification.id}`);
          }
          return isEnabled;
        }
        return true;
      });

      // Debug logging
      if (notifications.length > 0) {
        console.log(`[${new Date().toISOString()}] 🔍 Found ${notifications.length} pending notification(s) before filtering, ${filtered.length} after filtering`);
        notifications.forEach(n => {
          const metadata = n.metadata || {};
          const hasCron = metadata.cronExpression;
          console.log(`  - ${n.id}: status=${n.status}, scheduledFor=${n.scheduledFor ? n.scheduledFor.toISOString() : 'null'}, hasCron=${hasCron}, cronEnabled=${metadata.cronEnabled !== false ? 'true' : 'false'}`);
        });
      }

      return filtered;
    } catch (error) {
      console.error('Error fetching pending notifications:', error);
      throw new Error('Failed to fetch pending notifications');
    }
  }

  /**
   * Get target users for a notification
   */
  async getTargetUsers(notification) {
    try {
      const { targetType, targetValue } = notification;

      switch (targetType) {
        case 'all':
          // All users with emails
          return await this.prisma.user.findMany({
            where: {
              email: { not: null },
            },
            select: {
              id: true,
              email: true,
              username: true,
            },
          });

        case 'plan':
          // Users with specific plan
          if (!targetValue) {
            return [];
          }
          return await this.prisma.user.findMany({
            where: {
              plan: targetValue,
              email: { not: null },
            },
            select: {
              id: true,
              email: true,
              username: true,
            },
          });

        case 'waitlist':
          // All waitlist entries (approved or not based on targetValue)
          const waitlistEntries = await this.prisma.waitlist.findMany({
            where: targetValue === 'approved' 
              ? { isInvited: true }
              : targetValue === 'pending'
              ? { isInvited: false }
              : {},
            select: {
              email: true,
            },
          });

          // Return as user-like objects
          return waitlistEntries.map(entry => ({
            id: null,
            email: entry.email,
            username: null,
          }));

        case 'specific':
          // Specific user IDs
          if (!targetValue) {
            return [];
          }
          const userIds = targetValue.split(',').map(id => id.trim()).filter(Boolean);
          return await this.prisma.user.findMany({
            where: {
              id: { in: userIds },
              email: { not: null },
            },
            select: {
              id: true,
              email: true,
              username: true,
            },
          });

        default:
          return [];
      }
    } catch (error) {
      console.error('Error getting target users:', error);
      throw new Error('Failed to get target users');
    }
  }

  /**
   * Mark notification as sending
   */
  async markAsSending(id) {
    try {
      await this.prisma.notification.update({
        where: { id },
        data: {
          status: 'sending',
        },
      });
    } catch (error) {
      console.error('Error marking notification as sending:', error);
    }
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(id, sentCount, failedCount = 0, sentUserIds = []) {
    try {
      const existing = await this.prisma.notification.findUnique({
        where: { id },
        select: { metadata: true },
      });

      const metadata = existing?.metadata || {};
      // Always store sentUserIds, even if empty (to distinguish from old notifications)
      metadata.sentUserIds = sentUserIds;

      await this.prisma.notification.update({
        where: { id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          sentCount,
          failedCount,
          metadata,
        },
      });
    } catch (error) {
      console.error('Error marking notification as sent:', error);
    }
  }

  /**
   * Mark notification as failed
   */
  async markAsFailed(id, errorMessage) {
    try {
      await this.prisma.notification.update({
        where: { id },
        data: {
          status: 'failed',
          metadata: {
            error: errorMessage,
          },
        },
      });
    } catch (error) {
      console.error('Error marking notification as failed:', error);
    }
  }
}

module.exports = new NotificationService();

