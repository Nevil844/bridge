const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const axios = require('axios');

/**
 * JIRA MCP Integration
 * 
 * This integration supports both Atlassian Remote MCP Server and direct JIRA API calls.
 * 
 * Atlassian Remote MCP Server approach:
 * - Uses npx mcp-remote to connect to Atlassian's hosted MCP server
 * - Requires OAuth token and cloud ID
 * - Provides rich MCP tools for JIRA and Confluence
 * 
 * Direct API approach (fallback):
 * - Uses JIRA REST API directly
 * - Simpler, more reliable
 * - Requires base URL, email, and API token
 * 
 * Environment Variables:
 * - JIRA_USE_DIRECT_API: Set to 'true' to use direct API instead of MCP remote
 * - ATLASSIAN_MCP_SERVER_URL: URL for Atlassian remote MCP (default: https://mcp.atlassian.com/v1/sse)
 */
class JiraIntegration {
  constructor() {
    this.name = 'Jira';
    this.type = 'jira';
    this.description = 'Create and manage Jira projects, issues, boards, and workflows';
    this.icon = 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon-32x32.png';
    
    // Configuration
    this.useDirectApi = process.env.JIRA_USE_DIRECT_API === 'true';
    this.serverUrl = process.env.ATLASSIAN_MCP_SERVER_URL || 'https://mcp.atlassian.com/v1/sse';
    
    // OAuth error constant
    this.OAUTH_ERROR = 'OAuth_AUTHENTICATION_REQUIRED';
  }

  /**
   * Connect to JIRA
   * Supports both MCP remote and direct API modes
   */
  async connect(config = {}) {
    if (!config.token) {
      throw new Error('JIRA access token is required');
    }

    // Verify token and get cloud ID
    let cloudInfo = null;
    let tokenValid = false;
    try {
      cloudInfo = await this.getAccessibleResources(config.token);
      console.log(`✅ JIRA token verified for site: ${cloudInfo.siteUrl} (${cloudInfo.cloudId})`);
      tokenValid = true;
    } catch (error) {
      console.error(`❌ JIRA token verification failed: ${error.message}`);
      // Don't throw - return connection object with error state
      // This allows the integration to provide OAuth placeholder tools
      cloudInfo = {
        cloudId: null,
        siteUrl: null,
        name: null,
      };
    }

    // Determine mode
    if (this.useDirectApi) {
      // Direct API mode - no MCP client needed
      return {
        mode: 'direct',
        token: config.token,
        cloudId: cloudInfo.cloudId,
        siteUrl: cloudInfo.siteUrl,
        userId: config.userId || 'default-user',
        email: config.email || null,
        tokenValid,
      };
    } else {
      // MCP Remote mode - lazy connection
      return {
        mode: 'mcp',
        client: null,
        transport: null,
        token: config.token,
        cloudId: cloudInfo.cloudId,
        siteUrl: cloudInfo.siteUrl,
        userId: config.userId || 'default-user',
        _connecting: false,
        tokenValid,
      };
    }
  }

  /**
   * Get accessible JIRA resources for the token
   */
  async getAccessibleResources(accessToken) {
    try {
      const response = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        const resource = response.data[0];
        return {
          cloudId: resource.id,
          siteUrl: resource.url,
          name: resource.name,
        };
      }

      throw new Error('No accessible JIRA Cloud sites found for this token');
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Token is invalid or expired. Please reconnect JIRA.');
      }
      throw error;
    }
  }

  /**
   * Disconnect
   */
  async disconnect(connection) {
    if (!connection) return;

    if (connection.mode === 'mcp' && connection.client) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error('Error closing JIRA MCP client:', error.message);
      }
    }

    if (connection.transport) {
      try {
        await connection.transport.close();
      } catch (error) {
        // Ignore
      }
    }

    connection.client = null;
    connection.transport = null;
    connection._connecting = false;
  }

  /**
   * Get available tools
   */
  async getTools(connection) {
    if (!connection) {
      throw new Error('JIRA connection not initialized');
    }

    // If token is invalid, return OAuth placeholder tools
    if (connection.tokenValid === false) {
      console.log('⚠️  JIRA token is invalid, returning OAuth placeholder tools');
      return this.getOAuthPlaceholderTools();
    }

    if (connection.mode === 'direct') {
      return this.getDirectApiTools();
    } else {
      // MCP mode - connect and get tools from remote
      try {
        const client = await this.ensureMCPConnection(connection);
        if (!client) {
          return this.getOAuthPlaceholderTools();
        }

        const response = await client.listTools();
        const tools = response.tools || [];
        console.log(`✅ JIRA MCP: ${tools.length} tools available`);
        return tools;
      } catch (error) {
        if (this.isOAuthError(error)) {
          return this.getOAuthPlaceholderTools();
        }
        console.error('Error getting JIRA tools:', error.message);
        // Fallback to direct API tools on error
        return this.getDirectApiTools();
      }
    }
  }

  /**
   * Get tools for direct API mode
   */
  getDirectApiTools() {
    return [
      {
        name: 'jira_search_issues',
        description: 'Search JIRA issues using JQL (JIRA Query Language)',
        inputSchema: {
          type: 'object',
          properties: {
            jql: {
              type: 'string',
              description: 'JQL query (e.g., "project = PROJ AND status = Open")'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50, max: 100)'
            },
          },
          required: ['jql']
        }
      },
      {
        name: 'jira_get_issue',
        description: 'Get details of a specific JIRA issue by key',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key (e.g., "PROJ-123")'
            }
          },
          required: ['issueKey']
        }
      },
      {
        name: 'jira_create_issue',
        description: 'Create a new JIRA issue',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project key'
            },
            summary: {
              type: 'string',
              description: 'Issue summary/title'
            },
            description: {
              type: 'string',
              description: 'Issue description'
            },
            issueType: {
              type: 'string',
              description: 'Issue type (e.g., "Bug", "Task", "Story")'
            }
          },
          required: ['project', 'summary', 'issueType']
        }
      },
      {
        name: 'jira_update_issue',
        description: 'Update an existing JIRA issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key (e.g., "PROJ-123")'
            },
            summary: {
              type: 'string',
              description: 'New summary (optional)'
            },
            description: {
              type: 'string',
              description: 'New description (optional)'
            }
          },
          required: ['issueKey']
        }
      },
      {
        name: 'jira_add_comment',
        description: 'Add a comment to a JIRA issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key (e.g., "PROJ-123")'
            },
            comment: {
              type: 'string',
              description: 'Comment text'
            }
          },
          required: ['issueKey', 'comment']
        }
      },
      {
        name: 'jira_transition_issue',
        description: 'Transition an issue to a new status',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key (e.g., "PROJ-123")'
            },
            transitionName: {
              type: 'string',
              description: 'Transition name (e.g., "Done", "In Progress")'
            }
          },
          required: ['issueKey', 'transitionName']
        }
      },
      {
        name: 'jira_list_projects',
        description: 'List all accessible JIRA projects',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  /**
   * Get OAuth placeholder tools
   */
  getOAuthPlaceholderTools() {
    return [
      {
        name: 'jira_authenticate',
        description: 'Complete JIRA OAuth to unlock tools',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  /**
   * Call a tool
   */
  async callTool(connection, toolName, args = {}) {
    if (!connection) {
      throw new Error('JIRA connection not initialized');
    }

    // Handle OAuth tool
    if (toolName === 'jira_authenticate') {
      return this.buildOAuthResponse(connection);
    }

    // If token is invalid, return OAuth response
    if (connection.tokenValid === false) {
      console.log('⚠️  JIRA token is invalid, requesting re-authentication');
      return this.buildOAuthResponse(connection);
    }

    if (connection.mode === 'direct') {
      return await this.callDirectApiTool(connection, toolName, args);
    } else {
      return await this.callMCPTool(connection, toolName, args);
    }
  }

  /**
   * Call tool via MCP remote
   */
  async callMCPTool(connection, toolName, args) {
    const client = await this.ensureMCPConnection(connection);
    if (!client) {
      return this.buildOAuthResponse(connection);
    }

    try {
      console.log(`🔧 JIRA MCP: ${toolName}`);
      const result = await client.callTool({ name: toolName, arguments: args });

      if (result.isError) {
        const text = result.content?.[0]?.text || '';
        console.error(`❌ JIRA MCP error: ${text.substring(0, 200)}`);

        // Check for session expiration
        if (this.isSessionExpired(text)) {
          return this.buildOAuthResponse(connection);
        }
      } else {
        console.log(`✅ JIRA MCP: ${toolName} completed`);
      }

      return result;
    } catch (error) {
      console.error(`❌ JIRA MCP error (${toolName}):`, error.message);

      if (this.isOAuthError(error)) {
        return this.buildOAuthResponse(connection);
      }

      throw error;
    }
  }

  /**
   * Call tool via direct API
   */
  async callDirectApiTool(connection, toolName, args) {
    const baseUrl = `${connection.siteUrl}/rest/api/3`;
    const headers = {
      Authorization: `Bearer ${connection.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    try {
      let result;

      switch (toolName) {
        case 'jira_search_issues': {
          const { jql, maxResults = 50 } = args;
          const response = await axios.get(`${baseUrl}/search`, {
            headers,
            params: {
              jql,
              maxResults: Math.min(maxResults, 100),
            },
            timeout: 30000,
          });
          result = response.data;
          break;
        }

        case 'jira_get_issue': {
          const { issueKey } = args;
          const response = await axios.get(`${baseUrl}/issue/${issueKey}`, {
            headers,
            timeout: 10000,
          });
          result = response.data;
          break;
        }

        case 'jira_create_issue': {
          const { project, summary, description, issueType } = args;
          const response = await axios.post(`${baseUrl}/issue`, {
            fields: {
              project: { key: project },
              summary,
              description: description ? {
                type: 'doc',
                version: 1,
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: description }]
                }]
              } : undefined,
              issuetype: { name: issueType }
            }
          }, {
            headers,
            timeout: 10000,
          });
          result = response.data;
          break;
        }

        case 'jira_update_issue': {
          const { issueKey, summary, description } = args;
          const fields = {};
          if (summary) fields.summary = summary;
          if (description) {
            fields.description = {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: description }]
              }]
            };
          }
          await axios.put(`${baseUrl}/issue/${issueKey}`, { fields }, {
            headers,
            timeout: 10000,
          });
          result = { message: 'Issue updated successfully', issueKey };
          break;
        }

        case 'jira_add_comment': {
          const { issueKey, comment } = args;
          const response = await axios.post(`${baseUrl}/issue/${issueKey}/comment`, {
            body: {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: comment }]
              }]
            }
          }, {
            headers,
            timeout: 10000,
          });
          result = response.data;
          break;
        }

        case 'jira_transition_issue': {
          const { issueKey, transitionName } = args;
          
          // Get available transitions
          const transitionsResponse = await axios.get(`${baseUrl}/issue/${issueKey}/transitions`, {
            headers,
            timeout: 10000,
          });
          
          const transition = transitionsResponse.data.transitions.find(
            t => t.name.toLowerCase() === transitionName.toLowerCase()
          );
          
          if (!transition) {
            throw new Error(`Transition "${transitionName}" not found. Available: ${transitionsResponse.data.transitions.map(t => t.name).join(', ')}`);
          }
          
          await axios.post(`${baseUrl}/issue/${issueKey}/transitions`, {
            transition: { id: transition.id }
          }, {
            headers,
            timeout: 10000,
          });
          
          result = { message: `Issue transitioned to ${transitionName}`, issueKey, transitionName };
          break;
        }

        case 'jira_list_projects': {
          const response = await axios.get(`${baseUrl}/project`, {
            headers,
            timeout: 10000,
          });
          result = response.data;
          break;
        }

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return {
        isError: false,
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      console.error(`❌ JIRA API error (${toolName}):`, error.message);
      
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            details: error.response?.data || null,
            status: error.response?.status || null,
          })
        }]
      };
    }
  }

  /**
   * Ensure MCP connection is established
   */
  async ensureMCPConnection(connection) {
    if (connection.client) {
      return connection.client;
    }

    if (connection._connecting) {
      // Wait for connection to complete
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (connection.client) return connection.client;
        if (!connection._connecting) break;
      }
    }

    // Start connection
    connection._connecting = true;

    try {
      await this.connectMCPRemote(connection);
      connection._connecting = false;
      return connection.client;
    } catch (error) {
      connection._connecting = false;
      
      if (this.isOAuthError(error)) {
        console.log('🔐 JIRA OAuth required');
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Connect to Atlassian Remote MCP Server
   */
  async connectMCPRemote(connection) {
    console.log(`🔌 Connecting to Atlassian Remote MCP (${this.serverUrl})...`);

    const env = {
      ...process.env,
      ATLASSIAN_ACCESS_TOKEN: connection.token,
      ATLASSIAN_CLOUD_ID: connection.cloudId,
      ATLASSIAN_SITE_URL: connection.siteUrl,
      // Prevent browser OAuth (for server environments)
      BROWSER: 'none',
      NO_BROWSER: '1',
      CI: 'true',
    };

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'mcp-remote', this.serverUrl],
      env,
    });

    const client = new Client(
      {
        name: 'bridge-ai-jira',
        version: '2.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Handle OAuth redirects
    const authPromise = new Promise((_, reject) => {
      const handleOutput = (chunk) => {
        const text = chunk.toString();
        const match = text.match(/https:\/\/mcp\.atlassian\.com\/[^\s]+/);
        if (match) {
          reject(new Error(`${this.OAUTH_ERROR}: ${match[0]}`));
        }
      };

      transport.process?.stdout?.on('data', handleOutput);
      transport.process?.stderr?.on('data', handleOutput);
    });

    try {
      await Promise.race([
        client.connect(transport),
        authPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
        ),
      ]);

      console.log('✅ JIRA MCP connected');
      connection.client = client;
      connection.transport = transport;
    } catch (error) {
      // Clean up on error
      try {
        await transport.close();
      } catch (e) {
        // Ignore
      }

      throw error;
    }
  }

  /**
   * Get resources (for MCP mode)
   */
  async getResources(connection) {
    if (!connection || connection.mode !== 'mcp') {
      return [];
    }

    const client = await this.ensureMCPConnection(connection);
    if (!client) return [];

    try {
      const response = await client.listResources();
      return response.resources || [];
    } catch (error) {
      console.error('Error listing JIRA resources:', error.message);
      return [];
    }
  }

  /**
   * Read resource (for MCP mode)
   */
  async readResource(connection, resourceUri) {
    if (!connection || connection.mode !== 'mcp') {
      throw new Error('Resource reading only available in MCP mode');
    }

    const client = await this.ensureMCPConnection(connection);
    if (!client) {
      throw new Error('JIRA authentication required');
    }

    return await client.readResource({ uri: resourceUri });
  }

  /**
   * Check if error is OAuth-related
   */
  isOAuthError(error) {
    const message = error?.message || '';
    return message.includes(this.OAUTH_ERROR) ||
           message.includes('OAuth') ||
           message.includes('authorize') ||
           message.includes('Authentication required');
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(text = '') {
    return text.includes('Unauthorized') ||
           text.includes('invalid token') ||
           text.includes('expired') ||
           text.includes('401');
  }

  /**
   * Build OAuth response
   */
  buildOAuthResponse(connection) {
    const oauthHandler = require('../../oauth/handler');
    const url = oauthHandler.getAuthUrl('jira', connection?.userId || 'default-user');

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Please authenticate with JIRA by opening the link below, then try again.',
          oauthUrl: url,
        })
      }]
    };
  }
}

module.exports = JiraIntegration;
