/**
 * Push Notification Service
 * Sends push notifications via Expo Push Notification API
 */

const deviceTokenService = require('../db/services/deviceToken');

class PushNotificationService {
  constructor() {
    // Expo Push API endpoint
    this.expoPushUrl = 'https://exp.host/--/api/v2/push/send';
  }


  /**
   * Send push notification to multiple tokens (batch)
   */
  async sendToTokens(tokens, title, body, data = {}) {
    try {
      if (tokens.length === 0) {
        return { sent: 0, failed: 0, results: [] };
      }

      // Expo allows up to 100 messages per request
      const batchSize = 100;
      let sent = 0;
      let failed = 0;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const messages = batch.map(token => ({
          to: token,
          sound: 'default',
          title,
          body,
          data,
          priority: 'high',
          channelId: 'default',
        }));

        try {
          const response = await fetch(this.expoPushUrl, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
          });

          const result = await response.json();

          // Process results
          if (result.data) {
            for (let i = 0; i < result.data.length; i++) {
              const item = result.data[i];
              if (item.status === 'ok') {
                sent++;
              } else {
                failed++;
                // Handle invalid tokens
                if (item.details?.error === 'DeviceNotRegistered') {
                  await deviceTokenService.deactivateToken(batch[i]);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error sending batch:', error);
          failed += batch.length;
        }
      }

      return { sent, failed };
    } catch (error) {
      console.error('Error sending push notifications:', error);
      throw error;
    }
  }

  /**
   * Send push notification to a user (all their devices)
   */
  async sendToUser(userId, title, body, data = {}) {
    try {
      const tokens = await deviceTokenService.getUserTokens(userId);
      
      if (tokens.length === 0) {
        return { sent: 0, failed: 0, message: 'No active device tokens found' };
      }

      const tokenList = tokens.map(t => t.token);
      return await this.sendToTokens(tokenList, title, body, data);
    } catch (error) {
      console.error('Error sending to user:', error);
      throw error;
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(userIds, title, body, data = {}) {
    try {
      const tokens = await deviceTokenService.getUsersTokens(userIds);
      
      if (tokens.length === 0) {
        return { sent: 0, failed: 0, sentUserIds: [], message: 'No active device tokens found' };
      }

      // Create a map of token to userId
      const tokenToUserId = {};
      tokens.forEach(t => {
        if (!tokenToUserId[t.token]) {
          tokenToUserId[t.token] = [];
        }
        tokenToUserId[t.token].push(t.userId);
      });

      const tokenList = tokens.map(t => t.token);
      const result = await this.sendToTokens(tokenList, title, body, data);

      // Track which users had successful sends
      const sentUserIdsSet = new Set();
      const tokenListWithResults = tokenList;
      
      // For simplicity, if we sent successfully, assume all users with tokens got it
      // In a more sophisticated implementation, we'd track per-token success
      if (result.sent > 0) {
        tokens.forEach(t => {
          sentUserIdsSet.add(t.userId);
        });
      }

      return {
        ...result,
        sentUserIds: Array.from(sentUserIdsSet),
      };
    } catch (error) {
      console.error('Error sending to users:', error);
      throw error;
    }
  }
}

module.exports = new PushNotificationService();

