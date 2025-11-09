/**
 * Database Middleware
 * Adds database services to request object
 */

const conversationService = require('../db/services/conversation');
const integrationService = require('../db/services/integration');
const memoryService = require('../db/services/memory');
const toolContextService = require('../db/services/toolContext');
const userService = require('../db/services/user');
const tokenUsageService = require('../db/services/tokenUsage');

/**
 * Middleware to attach DB services to req.db
 */
function attachDatabaseServices(req, res, next) {
  req.db = {
    conversation: conversationService,
    integration: integrationService,
    memory: memoryService,
    toolContext: toolContextService,
    user: userService,
    tokenUsage: tokenUsageService,
  };
  next();
}

module.exports = { attachDatabaseServices };

