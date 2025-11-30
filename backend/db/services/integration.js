/**
 * Integration Service
 * Manages user MCP integrations (OAuth credentials, API keys)
 */

const { getPrismaClient } = require('../index');
const crypto = require('crypto');
const userService = require('./user');

class IntegrationService {
  constructor() {
    this.prisma = getPrismaClient();
    
    // Ensure encryption key is set in production
    if (process.env.NODE_ENV === 'production' && (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === 'default-key-change-in-production')) {
      throw new Error('ENCRYPTION_KEY must be set in production environment');
    }
    
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  /**
   * Encrypt sensitive credentials
   */
  encrypt(text) {
    if (!text) return null;
    
    try {
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(JSON.stringify(text), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error);
      return text; // Fallback to unencrypted (not recommended for production)
    }
  }

  /**
   * Decrypt sensitive credentials
   */
  decrypt(text) {
    if (!text || typeof text !== 'string') return null;
    
    try {
      const [ivHex, encrypted] = text.split(':');
      if (!ivHex || !encrypted) return text;
      
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      return text; // Return as-is if decryption fails
    }
  }

  /**
   * Store or update user integration
   * Automatically creates user if they don't exist
   */
  async storeIntegration(userId, provider, credentials, metadata = null) {
    // Ensure user exists (create if not)
    const user = await userService.getOrCreateUser(userId, null);
    
    // Encrypt credentials for security
    const encryptedCredentials = this.encrypt(credentials);

    return await this.prisma.userIntegration.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
      },
      update: {
        credentials: encryptedCredentials,
        metadata,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        provider,
        credentials: encryptedCredentials,
        metadata,
        isActive: true,
      },
    });
  }

  /**
   * Get user integration
   */
  async getIntegration(userId, provider) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const integration = await this.prisma.userIntegration.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
      },
    });

    if (!integration) return null;

    // Decrypt credentials before returning
    return {
      ...integration,
      credentials: this.decrypt(integration.credentials),
    };
  }

  /**
   * Get all active integrations for a user
   * Automatically creates user if they don't exist
   */
  async getUserIntegrations(userId) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const integrations = await this.prisma.userIntegration.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Decrypt credentials for each integration
    return integrations.map(int => {
      const decrypted = this.decrypt(int.credentials);
      
      // Log what we got from DB (for debugging)
      if (int.provider === 'slack') {
        console.log(`📦 DB: Slack credentials from database:`);
        console.log(`   - Encrypted (first 50 chars): ${int.credentials ? int.credentials.substring(0, 50) : 'null'}...`);
        console.log(`   - Decrypted type: ${typeof decrypted}`);
        console.log(`   - Decrypted keys: ${decrypted && typeof decrypted === 'object' ? Object.keys(decrypted).join(', ') : 'N/A'}`);
        if (decrypted && typeof decrypted === 'object') {
          console.log(`   - Has token: ${!!decrypted.token}`);
          console.log(`   - Has accessToken: ${!!decrypted.accessToken}`);
          console.log(`   - Full structure: ${JSON.stringify(decrypted, null, 2)}`);
        }
      }
      
      return {
        ...int,
        credentials: decrypted,
      };
    });
  }

  /**
   * Delete/deactivate integration
   */
  async deleteIntegration(userId, provider) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.userIntegration.update({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Check if user has integration
   */
  async hasIntegration(userId, provider) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const count = await this.prisma.userIntegration.count({
      where: {
        userId: user.id,
        provider,
        isActive: true,
      },
    });
    return count > 0;
  }

  /**
   * Get all providers user has integrated
   */
  async getUserProviders(userId) {
    const integrations = await this.prisma.userIntegration.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        provider: true,
      },
    });

    return integrations.map(int => int.provider);
  }
}

module.exports = new IntegrationService();

