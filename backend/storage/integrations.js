const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Storage file path
const STORAGE_DIR = path.join(__dirname, '../data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'integrations.json');

// Simple encryption key (in production, use env variable!)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-this-to-a-secure-32-char-key!!';
const ALGORITHM = 'aes-256-cbc';

/**
 * Simple encryption for tokens
 */
function encrypt(text) {
  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return text; // Fallback to plain text (not recommended!)
  }
}

/**
 * Simple decryption for tokens
 */
function decrypt(text) {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = parts.join(':');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return text; // Assume it's plain text
  }
}

/**
 * Ensure storage directory exists
 */
function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Load all integrations from file
 */
function loadIntegrations() {
  try {
    ensureStorageDir();
    
    if (!fs.existsSync(STORAGE_FILE)) {
      return new Map();
    }

    const data = fs.readFileSync(STORAGE_FILE, 'utf8');
    const parsed = JSON.parse(data);
    
    // Convert back to Map and decrypt tokens
    const integrations = new Map();
    for (const [userId, userIntegrations] of Object.entries(parsed)) {
      const decryptedIntegrations = userIntegrations.map(integration => ({
        ...integration,
        token: integration.token ? decrypt(integration.token) : undefined,
        config: {
          ...integration.config,
          token: integration.config?.token ? decrypt(integration.config.token) : undefined,
        },
      }));
      integrations.set(userId, decryptedIntegrations);
    }
    
    console.log(`✅ Loaded integrations for ${integrations.size} user(s) from storage`);
    return integrations;
  } catch (error) {
    console.error('Error loading integrations:', error);
    return new Map();
  }
}

/**
 * Save all integrations to file
 */
function saveIntegrations(integrations) {
  try {
    ensureStorageDir();
    
    // Convert Map to object and encrypt tokens
    const data = {};
    for (const [userId, userIntegrations] of integrations.entries()) {
      data[userId] = userIntegrations.map(integration => ({
        ...integration,
        token: integration.token ? encrypt(integration.token) : undefined,
        config: {
          ...integration.config,
          token: integration.config?.token ? encrypt(integration.config.token) : undefined,
        },
        // Don't store the actual client/process (they're not serializable)
        client: undefined,
        process: undefined,
      }));
    }
    
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Saved integrations for ${integrations.size} user(s) to storage`);
    return true;
  } catch (error) {
    console.error('Error saving integrations:', error);
    return false;
  }
}

/**
 * Save a single user's integrations
 */
function saveUserIntegrations(userId, userIntegrations, allIntegrations) {
  allIntegrations.set(userId, userIntegrations);
  return saveIntegrations(allIntegrations);
}

module.exports = {
  loadIntegrations,
  saveIntegrations,
  saveUserIntegrations,
  encrypt,
  decrypt,
};

