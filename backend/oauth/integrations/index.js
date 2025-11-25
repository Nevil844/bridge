/**
 * OAuth Integrations Registry
 * Add OAuth providers here to make them available in the app
 */

const GitHubOAuth = require('./github.js');
const GoogleDriveOAuth = require('./google-drive.js');
const GmailOAuth = require('./gmail.js');
const ZerodhaOAuth = require('./zerodha.js');
const SpotifyOAuth = require('./spotify.js');
const ZomatoOAuth = require('./zomato.js');
const JiraOAuth = require('./jira.js');

// Available OAuth integrations
const oauthIntegrations = {
  github: GitHubOAuth,
  'google-drive': GoogleDriveOAuth,
  gmail: GmailOAuth,
  zerodha: ZerodhaOAuth,
  spotify: SpotifyOAuth,
  zomato: ZomatoOAuth,
  jira: JiraOAuth,
  // Future OAuth integrations:
  // slack: SlackOAuth,
  // microsoft: MicrosoftOAuth,
};

module.exports = oauthIntegrations;

