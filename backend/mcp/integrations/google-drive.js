const { google } = require('googleapis');

/**
 * Google Drive Integration (Direct API)
 * Directly uses Google Drive API v3 without MCP server
 * This is simpler and more reliable than the deprecated MCP server
 */
class GoogleDriveIntegration {
  constructor() {
    this.name = 'Google Drive';
    this.type = 'google-drive';
    this.description = 'Search files, list documents, and access your Google Drive';
    this.icon = 'https://www.google.com/drive/static/images/drive/logo-drive.png';
  }

  /**
   * Connect to Google Drive API
   * @param {Object} config - Integration configuration
   * @param {string} config.token - Google access token
   * @param {string} config.refreshToken - Google refresh token
   * @returns {Promise<Object>} - Drive client
   */
  async connect(config) {
    if (!config || !config.token || !config.refreshToken) {
      throw new Error('Google Drive access token and refresh token are required');
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_DRIVE_CLIENT_ID,
        process.env.GOOGLE_DRIVE_CLIENT_SECRET
      );
      
      oauth2Client.setCredentials({
        access_token: config.token,
        refresh_token: config.refreshToken,
      });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Test the connection
      await drive.about.get({ fields: 'user' });
      
      return { drive, oauth2Client };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disconnect from Google Drive
   * @param {Object} connection - The connection object
   */
  async disconnect(connection) {
    // No explicit disconnect needed for Google Drive API
  }

  /**
   * Get available tools (manually defined)
   * @param {Object} connection - The connection object
   */
  async getTools(connection) {
    return [
      {
        name: 'list_drive_files',
        description: 'List recent files from Google Drive. Returns file names, types, modified dates, and links.',
        inputSchema: {
          type: 'object',
          properties: {
            pageSize: {
              type: 'number',
              description: 'Number of files to return (default: 10, max: 100)',
            },
            orderBy: {
              type: 'string',
              description: 'Sort order: "modifiedTime desc" (most recent first), "name", "createdTime desc", etc.',
            },
          },
        },
      },
      {
        name: 'search_drive_files',
        description: 'Search for files in Google Drive by name',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'The term to search for in file names',
            },
            pageSize: {
              type: 'number',
              description: 'Number of results to return (default: 10)',
            },
          },
          required: ['searchTerm'],
        },
      },
      {
        name: 'get_drive_file_details',
        description: 'Get detailed information about a specific Google Drive file',
        inputSchema: {
          type: 'object',
          properties: {
            fileId: {
              type: 'string',
              description: 'The ID of the file to retrieve',
            },
          },
          required: ['fileId'],
        },
      },
    ];
  }

  /**
   * Call a tool
   * @param {Object} connection - The connection object
   * @param {string} toolName - Name of the tool
   * @param {Object} args - Tool arguments
   */
  async callTool(connection, toolName, args) {
    const { drive } = connection;
    if (!drive) {
      throw new Error('Google Drive not connected');
    }

    try {
      switch (toolName) {
        case 'list_drive_files': {
          const { pageSize = 10, orderBy = 'modifiedTime desc' } = args;
          
          const response = await drive.files.list({
            pageSize: Math.min(pageSize, 100),
            fields: 'files(id, name, mimeType, modifiedTime, createdTime, size, webViewLink, owners)',
            orderBy,
            q: 'trashed = false',
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  files: response.data.files.map(file => ({
                    id: file.id,
                    name: file.name,
                    type: file.mimeType,
                    modifiedTime: file.modifiedTime,
                    size: file.size,
                    link: file.webViewLink,
                    owner: file.owners?.[0]?.displayName,
                  })),
                  count: response.data.files.length,
                }, null, 2),
              },
            ],
          };
        }

        case 'search_drive_files': {
          const { searchTerm, pageSize = 10 } = args;
          
          const query = `name contains '${searchTerm}' and trashed = false`;
          const response = await drive.files.list({
            pageSize: Math.min(pageSize, 100),
            fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
            orderBy: 'modifiedTime desc',
            q: query,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  searchTerm,
                  files: response.data.files.map(file => ({
                    id: file.id,
                    name: file.name,
                    type: file.mimeType,
                    modifiedTime: file.modifiedTime,
                    link: file.webViewLink,
                  })),
                  count: response.data.files.length,
                }, null, 2),
              },
            ],
          };
        }

        case 'get_drive_file_details': {
          const { fileId } = args;
          
          const response = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, description, size, createdTime, modifiedTime, owners, parents, webViewLink, thumbnailLink',
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`Error executing ${toolName}:`, error.message);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              details: error.response?.data?.error || error.stack,
            }),
          },
        ],
        isError: true,
      };
    }
  }
}

module.exports = GoogleDriveIntegration;
