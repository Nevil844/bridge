/**
 * Notification Sender Service
 * Handles actual sending of notifications via different channels
 */

const notificationService = require('../db/services/notification');

class NotificationSender {
  /**
   * Send cron notification - creates a new sent notification entry
   * while keeping the cron notification as pending for next run
   */
  async sendCronNotification(cronNotification) {
    try {
      // Get target users
      const targetUsers = await notificationService.getTargetUsers(cronNotification);
      
      if (targetUsers.length === 0) {
        return { sent: 0, failed: 0, message: 'No target users found' };
      }

      // Create a completely separate notification entry for this cron execution
      // This is a NEW notification, not linked to the cron - they are separate entities
      const sentNotification = await notificationService.createNotification({
        title: cronNotification.title,
        message: cronNotification.message,
        type: 'push',
        targetType: cronNotification.targetType,
        targetValue: cronNotification.targetValue,
        scheduledFor: null, // Already being sent
        createdBy: cronNotification.createdBy,
        metadata: {}, // No cronExpression - this is a regular sent notification, completely separate from cron
      });

      // Mark the new notification as sending
      await notificationService.markAsSending(sentNotification.id);

      // Send push notifications
      const pushResult = await this.sendPushNotification(sentNotification, targetUsers);
      const sentCount = pushResult.sent || 0;
      const failedCount = pushResult.failed || 0;
      const sentUserIds = pushResult.sentUserIds || [];

      // Mark the new notification as sent
      await notificationService.markAsSent(sentNotification.id, sentCount, failedCount, sentUserIds);

      // Calculate next occurrence and update cron notification's scheduledFor
      const metadata = cronNotification.metadata || {};
      const cronExpression = metadata.cronExpression;
      if (cronExpression) {
        const { CronExpressionParser } = require('cron-parser');
        const interval = CronExpressionParser.parse(cronExpression, {
          tz: 'Asia/Kolkata', // IST timezone
        });
        const nextOccurrence = interval.next().toDate();
        // Update the cron notification's scheduledFor to the next occurrence
        await notificationService.updateNotification(cronNotification.id, {
          scheduledFor: nextOccurrence,
        });
      }

      return {
        sent: sentCount,
        failed: failedCount,
        total: targetUsers.length,
      };
    } catch (error) {
      console.error('Error sending cron notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to users (for one-time notifications)
   */
  async sendNotification(notification) {
    try {
      // Mark as sending
      await notificationService.markAsSending(notification.id);

      // Get target users
      const targetUsers = await notificationService.getTargetUsers(notification);
      
      if (targetUsers.length === 0) {
        await notificationService.markAsSent(notification.id, 0, 0, []);
        return { sent: 0, failed: 0, message: 'No target users found' };
      }

      // Only send push notifications
      const pushResult = await this.sendPushNotification(notification, targetUsers);
      const sentCount = pushResult.sent || 0;
      const failedCount = pushResult.failed || 0;
      const sentUserIds = pushResult.sentUserIds || [];

      // Mark as sent with user IDs
      await notificationService.markAsSent(notification.id, sentCount, failedCount, sentUserIds);

      return {
        sent: sentCount,
        failed: failedCount,
        total: targetUsers.length,
      };
    } catch (error) {
      console.error('Error sending notification:', error);
      await notificationService.markAsFailed(notification.id, error.message);
      throw error;
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(notification, users) {
    const pushService = require('./pushNotification');
    
    // Filter users with IDs (skip waitlist entries without accounts)
    const usersWithIds = users.filter(u => u.id);
    
      if (usersWithIds.length === 0) {
        return { sent: 0, failed: 0, sentUserIds: [] };
      }

      const userIds = usersWithIds.map(u => u.id);
      
      try {
        const result = await pushService.sendToUsers(
          userIds,
          notification.title,
          notification.message,
          {
            notificationId: notification.id,
            type: 'admin_notification',
            ...notification.metadata,
          }
        );

      return {
        sent: result.sent || 0,
        failed: result.failed || 0,
        sentUserIds: result.sentUserIds || [], // Return user IDs that were successfully sent
      };
    } catch (error) {
      console.error('Error sending push notifications:', error);
      return {
        sent: 0,
        failed: usersWithIds.length,
        sentUserIds: [], // Return empty array on error
      };
    }
  }

}

module.exports = new NotificationSender();

