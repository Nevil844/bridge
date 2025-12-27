/**
 * Admin Middleware
 * SECURITY: Verifies admin access by checking email from authenticated token
 * 
 * This middleware:
 * 1. Requires verifyUser to run first (ensures valid token)
 * 2. Extracts user email from Google OAuth integration
 * 3. Verifies email matches admin email (neviljobanputra34@gmail.com)
 * 4. Only allows access if email matches exactly
 * 
 * SECURITY NOTES:
 * - Email check is case-sensitive and exact match
 * - Token must be valid (verified by verifyUser)
 * - No fallbacks or bypasses
 */

const integrationService = require('../db/services/integration');
const { getPrismaClient } = require('../db/index');

// Admin email - hardcoded for security
const ADMIN_EMAIL = 'neviljobanputra34@gmail.com';

/**
 * Middleware to verify admin access
 * MUST be used after verifyUser middleware
 * 
 * @example
 * router.get('/admin/dashboard', verifyUser, verifyAdmin, adminController.getDashboard);
 */
async function verifyAdmin(req, res, next) {
  try {
    // Ensure verifyUser ran first (req.userId should exist)
    if (!req.userId) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User authentication required before admin verification' 
      });
    }

    // Get user's email from Google OAuth integration
    const prisma = getPrismaClient();
    const integration = await prisma.userIntegration.findFirst({
      where: {
        userId: req.userId,
        provider: 'google-auth',
        isActive: true,
      },
    });

    if (!integration) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Admin access requires Google OAuth integration' 
      });
    }

    // Decrypt credentials to get email
    let userEmail = null;
    try {
      const decryptedCredentials = integrationService.decrypt(integration.credentials);
      if (decryptedCredentials && typeof decryptedCredentials === 'object') {
        userEmail = decryptedCredentials.email || decryptedCredentials.user?.email;
      }
    } catch (error) {
      console.error('Error decrypting admin credentials:', error);
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to verify admin access' 
      });
    }

    // Verify email matches admin email (case-sensitive exact match)
    if (!userEmail || userEmail !== ADMIN_EMAIL) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Admin access denied. This endpoint is restricted to administrators only.' 
      });
    }

    // Admin verified - attach admin flag to request
    req.isAdmin = true;
    req.adminEmail = userEmail;
    
    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to verify admin access' 
    });
  }
}

/**
 * Helper function to check if a user is admin (for use in services)
 * Returns true if user email matches admin email
 */
async function isAdmin(userId) {
  try {
    const prisma = getPrismaClient();
    const integration = await prisma.userIntegration.findFirst({
      where: {
        userId: userId,
        provider: 'google-auth',
        isActive: true,
      },
    });

    if (!integration) {
      return false;
    }

    const decryptedCredentials = integrationService.decrypt(integration.credentials);
    if (decryptedCredentials && typeof decryptedCredentials === 'object') {
      const userEmail = decryptedCredentials.email || decryptedCredentials.user?.email;
      return userEmail === ADMIN_EMAIL;
    }

    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

module.exports = {
  verifyAdmin,
  isAdmin,
  ADMIN_EMAIL,
};

