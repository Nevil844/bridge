/**
 * Notification Sender Service
 * Handles actual sending of notifications via different channels
 */

const notificationService = require('../db/services/notification');

class NotificationSender {
  /**
   * Send notification to users
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

