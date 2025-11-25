const { google } = require('googleapis');

/**
 * Gmail Integration (Direct API)
 * Directly uses Gmail API v1 without MCP server
 * Provides email management, sending, searching, and organization
 */
class GmailIntegration {
  constructor() {
    this.name = 'Gmail';
    this.type = 'gmail';
    this.description = 'Read, send, search, and manage your Gmail emails';
    this.icon = 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png';
  }

  /**
   * Connect to Gmail API
   * @param {Object} config - Integration configuration
   * @param {string} config.token - Google access token
   * @param {string} config.refreshToken - Google refresh token
   * @returns {Promise<Object>} - Gmail client
   */
  async connect(config) {
    if (!config || !config.token || !config.refreshToken) {
      throw new Error('Gmail access token and refresh token are required');
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET
      );
      
      oauth2Client.setCredentials({
        access_token: config.token,
        refresh_token: config.refreshToken,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Test the connection
      await gmail.users.getProfile({ userId: 'me' });
      
      return { gmail, oauth2Client };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disconnect from Gmail
   * @param {Object} connection - The connection object
   */
  async disconnect(connection) {
    // No explicit disconnect needed for Gmail API
  }

  /**
   * Get available tools (manually defined)
   * @param {Object} connection - The connection object
   */
  async getTools(connection) {
    return [
      {
        name: 'list_emails',
        description: 'List recent emails from Gmail inbox. Returns email subjects, senders, snippets, and dates.',
        inputSchema: {
          type: 'object',
          properties: {
            maxResults: {
              type: 'number',
              description: 'Number of emails to return (default: 10, max: 100)',
            },
            query: {
              type: 'string',
              description: 'Gmail search query (e.g., "is:unread", "from:user@example.com", "subject:meeting")',
            },
          },
        },
      },
      {
        name: 'search_emails',
        description: 'Search for emails in Gmail using Gmail search syntax',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Gmail search query (e.g., "from:example@gmail.com subject:report")',
            },
            maxResults: {
              type: 'number',
              description: 'Number of results to return (default: 10)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_email',
        description: 'Get the full details of a specific email by ID',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: {
              type: 'string',
              description: 'The ID of the email to retrieve',
            },
          },
          required: ['emailId'],
        },
      },
      {
        name: 'send_email',
        description: 'Send an email from your Gmail account',
        inputSchema: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Recipient email address',
            },
            subject: {
              type: 'string',
              description: 'Email subject',
            },
            body: {
              type: 'string',
              description: 'Email body (plain text or HTML)',
            },
            cc: {
              type: 'string',
              description: 'CC email addresses (comma-separated)',
            },
            bcc: {
              type: 'string',
              description: 'BCC email addresses (comma-separated)',
            },
          },
          required: ['to', 'subject', 'body'],
        },
      },
      {
        name: 'get_labels',
        description: 'Get all Gmail labels for the user',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'add_label',
        description: 'Add a label to an email',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: {
              type: 'string',
              description: 'The ID of the email',
            },
            labelId: {
              type: 'string',
              description: 'The ID of the label to add',
            },
          },
          required: ['emailId', 'labelId'],
        },
      },
      {
        name: 'remove_label',
        description: 'Remove a label from an email',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: {
              type: 'string',
              description: 'The ID of the email',
            },
            labelId: {
              type: 'string',
              description: 'The ID of the label to remove',
            },
          },
          required: ['emailId', 'labelId'],
        },
      },
      {
        name: 'trash_email',
        description: 'Move an email to trash',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: {
              type: 'string',
              description: 'The ID of the email to trash',
            },
          },
          required: ['emailId'],
        },
      },
    ];
  }

  /**
   * Parse email headers
   */
  parseHeaders(headers) {
    const result = {};
    headers.forEach(header => {
      result[header.name.toLowerCase()] = header.value;
    });
    return result;
  }

  /**
   * Decode email body
   */
  decodeBody(data) {
    if (!data) return '';
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  }

  /**
   * Get email body from parts
   */
  getEmailBody(payload) {
    let body = '';
    
    if (payload.body && payload.body.data) {
      body = this.decodeBody(payload.body.data);
    } else if (payload.parts) {
      // Multi-part email
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          body = this.decodeBody(part.body.data);
          break;
        } else if (part.mimeType === 'text/html' && part.body.data && !body) {
          body = this.decodeBody(part.body.data);
        }
      }
    }
    
    return body;
  }

  /**
   * Create email message in RFC 2822 format
   */
  createMessage(to, subject, body, cc = '', bcc = '') {
    const messageParts = [
      `To: ${to}`,
      `Subject: ${subject}`,
    ];
    
    if (cc) messageParts.push(`Cc: ${cc}`);
    if (bcc) messageParts.push(`Bcc: ${bcc}`);
    
    messageParts.push('Content-Type: text/html; charset=utf-8');
    messageParts.push('');
    messageParts.push(body);
    
    const message = messageParts.join('\r\n');
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Call a tool
   * @param {Object} connection - The connection object
   * @param {string} toolName - Name of the tool
   * @param {Object} args - Tool arguments
   */
  async callTool(connection, toolName, args) {
    const { gmail } = connection;
    if (!gmail) {
      throw new Error('Gmail not connected');
    }

    try {
      switch (toolName) {
        case 'list_emails': {
          const { maxResults = 10, query = '' } = args;
          
          const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: Math.min(maxResults, 100),
            q: query,
          });

          const messages = response.data.messages || [];
          
          // Get details for each message
          const emailDetails = await Promise.all(
            messages.map(async (msg) => {
              const details = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject', 'Date'],
              });
              
              const headers = this.parseHeaders(details.data.payload.headers);
              
              return {
                id: msg.id,
                threadId: msg.threadId,
                from: headers.from,
                subject: headers.subject,
                date: headers.date,
                snippet: details.data.snippet,
              };
            })
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  emails: emailDetails,
                  count: emailDetails.length,
                  query: query || 'all emails',
                }, null, 2),
              },
            ],
          };
        }

        case 'search_emails': {
          const { query, maxResults = 10 } = args;
          
          const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: Math.min(maxResults, 100),
            q: query,
          });

          const messages = response.data.messages || [];
          
          // Get details for each message
          const emailDetails = await Promise.all(
            messages.map(async (msg) => {
              const details = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject', 'Date'],
              });
              
              const headers = this.parseHeaders(details.data.payload.headers);
              
              return {
                id: msg.id,
                threadId: msg.threadId,
                from: headers.from,
                subject: headers.subject,
                date: headers.date,
                snippet: details.data.snippet,
              };
            })
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  query,
                  emails: emailDetails,
                  count: emailDetails.length,
                }, null, 2),
              },
            ],
          };
        }

        case 'get_email': {
          const { emailId } = args;
          
          const response = await gmail.users.messages.get({
            userId: 'me',
            id: emailId,
            format: 'full',
          });

          const headers = this.parseHeaders(response.data.payload.headers);
          const body = this.getEmailBody(response.data.payload);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  id: response.data.id,
                  threadId: response.data.threadId,
                  from: headers.from,
                  to: headers.to,
                  subject: headers.subject,
                  date: headers.date,
                  body,
                  snippet: response.data.snippet,
                  labels: response.data.labelIds,
                }, null, 2),
              },
            ],
          };
        }

        case 'send_email': {
          const { to, subject, body, cc, bcc } = args;
          
          const encodedMessage = this.createMessage(to, subject, body, cc, bcc);
          
          const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: encodedMessage,
            },
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  messageId: response.data.id,
                  to,
                  subject,
                }, null, 2),
              },
            ],
          };
        }

        case 'get_labels': {
          const response = await gmail.users.labels.list({
            userId: 'me',
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  labels: response.data.labels.map(label => ({
                    id: label.id,
                    name: label.name,
                    type: label.type,
                  })),
                  count: response.data.labels.length,
                }, null, 2),
              },
            ],
          };
        }

        case 'add_label': {
          const { emailId, labelId } = args;
          
          await gmail.users.messages.modify({
            userId: 'me',
            id: emailId,
            requestBody: {
              addLabelIds: [labelId],
            },
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  emailId,
                  labelId,
                  action: 'added',
                }, null, 2),
              },
            ],
          };
        }

        case 'remove_label': {
          const { emailId, labelId } = args;
          
          await gmail.users.messages.modify({
            userId: 'me',
            id: emailId,
            requestBody: {
              removeLabelIds: [labelId],
            },
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  emailId,
                  labelId,
                  action: 'removed',
                }, null, 2),
              },
            ],
          };
        }

        case 'trash_email': {
          const { emailId } = args;
          
          await gmail.users.messages.trash({
            userId: 'me',
            id: emailId,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  emailId,
                  action: 'trashed',
                }, null, 2),
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

module.exports = GmailIntegration;

