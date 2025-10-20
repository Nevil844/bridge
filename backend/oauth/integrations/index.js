/**
 * OAuth Integrations Registry
 * Add OAuth providers here to make them available in the app
 */

const GitHubOAuth = require('./github.js');
const GoogleDriveOAuth = require('./google-drive.js');

// Available OAuth integrations
const oauthIntegrations = {
  github: GitHubOAuth,
  'google-drive': GoogleDriveOAuth,
  // Future OAuth integrations:
  // slack: SlackOAuth,
  // microsoft: MicrosoftOAuth,
};

module.exports = oauthIntegrations;

