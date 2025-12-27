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

// No longer need integrationService - we use req.user.email directly

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
    // Ensure verifyUser ran first (req.user should exist)
    if (!req.user || !req.userId) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User authentication required before admin verification' 
      });
    }

    // Get user's email directly from the user object (set by verifyUser)
    const userEmail = req.user.email;

    if (!userEmail) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'User email not found. Admin access requires a valid email address.' 
      });
    }

    // Verify email matches admin email (case-sensitive exact match)
    if (userEmail !== ADMIN_EMAIL) {
      console.log('Admin access denied:', {
        userEmail,
        adminEmail: ADMIN_EMAIL,
        match: userEmail === ADMIN_EMAIL,
        userId: req.userId,
      });
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
    const userService = require('../db/services/user');
    const user = await userService.getUserById(userId);
    
    if (!user || !user.email) {
      return false;
    }

    return user.email === ADMIN_EMAIL;
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

