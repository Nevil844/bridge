/**
 * MCP Integrations Registry
 * Add new integrations here to make them available in the app
 */

const GitHubIntegration = require('./github.js');
const GoogleDriveIntegration = require('./google-drive.js');

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

