/**
 * OAuth Integrations Registry
 * Add OAuth providers here to make them available in the app
 */

const GitHubOAuth = require('./github.js');

// Available OAuth integrations
const oauthIntegrations = {
  github: GitHubOAuth,
  // Future OAuth integrations:
  // google: GoogleOAuth,
  // slack: SlackOAuth,
  // microsoft: MicrosoftOAuth,
};

module.exports = oauthIntegrations;

