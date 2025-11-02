/**
 * MCP Integrations Registry
 * Add new integrations here to make them available in the app
 */

const GitHubIntegration = require('./github.js');
const GoogleDriveIntegration = require('./google-drive.js');
const GmailIntegration = require('./gmail.js');
const ZerodhaIntegration = require('./zerodha.js');
const SpotifyIntegration = require('./spotify.js');
const ZomatoIntegration = require('./zomato.js');

// Available integrations
// Add new integrations here as you create them
const integrations = {
  github: {
    class: GitHubIntegration,
    name: 'GitHub',
    description: 'Access GitHub repositories, issues, pull requests, and more',
    icon: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    authType: 'oauth',
  },
  'google-drive': {
    class: GoogleDriveIntegration,
    name: 'Google Drive',
    description: 'Search files, list documents, and access your Google Drive',
    icon: 'https://www.google.com/drive/static/images/drive/logo-drive.png',
    authType: 'oauth',
  },
  gmail: {
    class: GmailIntegration,
    name: 'Gmail',
    description: 'Read, send, search, and manage your Gmail emails',
    icon: 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png',
    authType: 'oauth',
  },
  zerodha: {
    class: ZerodhaIntegration,
    name: 'Zerodha',
    description: 'Access your portfolio, market data, and trading insights',
    icon: 'https://zerodha.com/static/images/logo.svg',
    authType: 'oauth',
  },
  spotify: {
    class: SpotifyIntegration,
    name: 'Spotify',
    description: 'Control playback, manage playlists, and search music',
    icon: 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png',
    authType: 'oauth',
  },
  zomato: {
    class: ZomatoIntegration,
    name: 'Zomato',
    description: 'Discover restaurants, browse menus, create carts, and place food orders',
    icon: 'https://logo.clearbit.com/zomato.com',
    authType: 'oauth',
  },
  // Future integrations:
  // slack: {
  //   class: SlackIntegration,
  //   name: 'Slack',
  //   description: 'Send messages, read channels, and manage your workspace',
  //   icon: 'https://...',
  //   authType: 'oauth',
  // },
  // jira: {
  //   class: JiraIntegration,
  //   name: 'Jira',
  //   description: 'Create and manage issues, projects, and workflows',
  //   icon: 'https://...',
  //   authType: 'api_key',
  // },
};

module.exports = integrations;

