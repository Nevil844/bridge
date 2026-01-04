/**
 * Authentication Middleware
 * Verifies user authentication using existing Google OAuth integration
 * 
 * SECURITY: We NEVER trust userId from frontend. We extract it from the authenticated token.
 * 
 * This middleware:
 * 1. Requires Authorization header with Google access token
 * 2. Looks up which user owns that token
 * 3. Verifies the user exists and has completed Google OAuth
 * 4. Sets req.userId from the token, NOT from request params
 */

const userService = require('../db/services/user');
const integrationService = require('../db/services/integration');
const { getPrismaClient } = require('../db/index');

/**
 * Middleware to verify user authentication using Google access token
 * 
 * SECURITY: Token-based authentication ONLY - extracts userId from token, NEVER from request params
 * 
 * This is the same as verifyUser - both require token-based authentication
 * 
 * Requirements:
 * - Authorization header with Google access token (REQUIRED)
 * - Token must match a user's stored google-auth token
 * - User must exist and have active google-auth integration
 * 
 * On success, attaches user object to req.user and req.userId (from token)
 */
async function verifyAuth(req, res, next) {
  // Use the same secure token-based authentication as verifyUser
  return verifyUser(req, res, next);
}

/**
 * Middleware: Verify user using token-based authentication ONLY
 * 
 * SECURITY: Token-based authentication is REQUIRED - no fallbacks
 * - Requires Authorization header with Google access token
 * - Extracts userId from token (NEVER from request params)
 * - Prevents user impersonation attacks
 * 
 * Frontend MUST send: Authorization: Bearer <google-access-token>
 */
async function verifyUser(req, res, next) {
  try {
    // REQUIRE Authorization header - no exceptions
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authorization token is required. Please include your Google access token in the Authorization header.' 
      });
    }

    // Extract token from "Bearer <token>" or just "<token>"
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;
    
    if (!token || token.trim() === '') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid authorization token format. Expected: Authorization: Bearer <token>' 
      });
    }

    // Find which user owns this token by searching all google-auth integrations
    const prisma = getPrismaClient();
    const integrations = await prisma.userIntegration.findMany({
      where: {
        provider: 'google-auth',
        isActive: true,
      },
    });

    let authenticatedUserId = null;
    
    // Decrypt and check each integration's token
    for (const integration of integrations) {
      try {
        const decryptedCredentials = integrationService.decrypt(integration.credentials);
        if (decryptedCredentials && typeof decryptedCredentials === 'object' && decryptedCredentials.accessToken === token) {
          authenticatedUserId = integration.userId;
          break;
        }
      } catch (error) {
        // Skip if decryption fails - try next integration
        continue;
      }
    }

    // Token not found or invalid
    if (!authenticatedUserId) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid or expired token. Please re-authenticate with Google OAuth.' 
      });
    }

    // Verify user exists
    const user = await userService.getUserById(authenticatedUserId);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User not found.' 
      });
    }

    // Attach user to request object - this is the ONLY trusted userId (from token, not request)
    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error) {
    console.error('User verification error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to verify user' 
    });
  }
}

module.exports = {
  verifyAuth,
  verifyUser,
};

