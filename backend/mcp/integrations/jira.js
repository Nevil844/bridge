const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

/**
 * JIRA Integration
 * 
 * Uses JIRA REST API directly for all operations.
 * Works reliably on servers without browser OAuth.
 * Client sends requests with their token, server executes using that token.
 * 
 * All tools use the JIRA REST API v3:
 * - Base URL: {siteUrl}/rest/api/3
 * - Authentication: Bearer token (OAuth access token)
 */
class JiraIntegration {
  constructor() {
    this.name = 'Jira';
    this.type = 'jira';
    this.description = 'Create and manage Jira projects, issues, boards, and workflows';
    this.icon = 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon-32x32.png';
    
    // OAuth error constant
    this.OAUTH_ERROR = 'OAuth_AUTHENTICATION_REQUIRED';
  }

  /**
   * Refresh access token if needed (similar to Spotify)
   */
  async refreshTokenIfNeeded(accessToken, refreshToken, userId) {
    if (!refreshToken) {
      return accessToken;
    }

    try {
      const JiraOAuth = require('../../oauth/integrations/jira.js');
      const jiraOAuth = new JiraOAuth();
      
      // Try to validate token by checking accessible resources
      try {
        await Promise.race([
          this.getAccessibleResources(accessToken),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        return accessToken; // Token is valid
      } catch (validationError) {
        // Token invalid or expired, refresh it
        if (validationError.message.includes('Token is invalid') || 
            validationError.message.includes('expired') ||
            validationError.response?.status === 401) {
          console.log('⚠️  JIRA token validation failed, refreshing...');
          const refreshResult = await Promise.race([
            jiraOAuth.refreshAccessToken(refreshToken),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
          ]);
          console.log('✅ JIRA token refreshed successfully');
          
          // Update database with new token (non-blocking)
          if (userId && refreshResult.accessToken) {
            try {
              const integrationService = require('../../db/services/integration');
              await integrationService.storeIntegration(
                userId,
                'jira',
                {
                  token: refreshResult.accessToken,
                  refreshToken: refreshResult.refreshToken || refreshToken,
                }
              );
              console.log('✅ Updated JIRA token in database');
            } catch (dbError) {
              console.warn('⚠️  Could not update JIRA token in database:', dbError.message);
              // Don't fail - token is refreshed in memory
            }
          }
          
          return refreshResult.accessToken;
        }
        // Other errors (network, etc.) - return original token
        throw validationError;
      }
    } catch (error) {
      console.log('⚠️  Could not validate/refresh JIRA token, using existing:', error.message);
      return accessToken;
    }
  }

  /**
   * Connect to JIRA
   * Verifies token and retrieves cloud information
   * Automatically refreshes token if expired
   */
  async connect(config = {}) {
    if (!config.token) {
      throw new Error('JIRA access token is required');
    }

    const userId = config.userId || 'default-user';
    let accessToken = config.token;
    const refreshToken = config.refreshToken;

    // Refresh token if needed (like Spotify)
    if (refreshToken) {
      accessToken = await this.refreshTokenIfNeeded(accessToken, refreshToken, userId);
    }

    // Verify token and get cloud ID
    let cloudInfo = null;
    let tokenValid = false;
    try {
      cloudInfo = await this.getAccessibleResources(accessToken);
      console.log(`✅ JIRA token verified for site: ${cloudInfo.siteUrl} (${cloudInfo.cloudId})`);
      tokenValid = true;
    } catch (error) {
      console.error(`❌ JIRA token verification failed: ${error.message}`);
      console.error(`   Token preview: ${accessToken ? accessToken.substring(0, 20) + '...' : 'missing'}`);
      // Don't throw - return connection object with error state
      // This allows the integration to provide OAuth placeholder tools
      cloudInfo = {
        cloudId: null,
        siteUrl: null,
        name: null,
      };
    }

    return {
      token: accessToken, // Use refreshed token if it was refreshed
      refreshToken: refreshToken, // Keep refresh token
      cloudId: cloudInfo.cloudId,
      siteUrl: cloudInfo.siteUrl,
      userId: userId,
      email: config.email || null,
      tokenValid,
    };
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
      if (error.response?.status === 403) {
        throw new Error('Token does not have required permissions. Please reconnect JIRA.');
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error(`Network error connecting to JIRA: ${error.message}`);
      }
      console.error(`JIRA accessible resources error:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Disconnect (no-op for direct API mode)
   */
  async disconnect(connection) {
    // No cleanup needed for direct API mode
    return;
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

    return this.getDirectApiTools();
  }

  /**
   * Get tools for direct API mode
   */
  getDirectApiTools() {
    return [
      {
        name: 'jira_list_projects',
        description: 'List all accessible JIRA projects with their keys, names, and project types',
        inputSchema: {
          type: 'object',
          properties: {
            expand: {
              type: 'string',
              description: 'Use expand to include additional information about projects in the response. This parameter accepts a comma-separated list. Expanded options include: description, issueTypes, lead, projectKeys, projectCategory'
            },
            recent: {
              type: 'number',
              description: 'Returns the most recently accessed projects for the current user. Valid values: 0 to 20'
            }
          },
          required: []
        }
      },
      {
        name: 'jira_search_issues',
        description: 'Search JIRA issues using JQL (JIRA Query Language). Returns matching issues with their details.',
        inputSchema: {
          type: 'object',
          properties: {
            jql: {
              type: 'string',
              description: 'JQL query (e.g., "project = PROJ AND status = Open" or "assignee = currentUser() AND status != Done")'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50, max: 100)'
            },
            startAt: {
              type: 'number',
              description: 'The index of the first issue to return (default: 0)'
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of fields to return for each issue. Use "*all" for all fields, "*navigable" for navigable fields, or specific field names like "summary", "status", "assignee"'
            },
            expand: {
              type: 'string',
              description: 'Use expand to include additional information about issues in the response. Options include: renderedFields, names, schema, transitions, operations, editmeta, changelog'
            }
          },
          required: ['jql']
        }
      },
      {
        name: 'jira_get_issue',
        description: 'Get details of a specific JIRA issue by key or ID. Returns full issue information including fields, comments, and changelog.',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key or ID (e.g., "PROJ-123")'
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of fields to return. Use "*all" for all fields, "*navigable" for navigable fields, or specific field names'
            },
            expand: {
              type: 'string',
              description: 'Use expand to include additional information. Options include: renderedFields, names, schema, transitions, operations, editmeta, changelog'
            },
            updateHistory: {
              type: 'boolean',
              description: 'Whether the project in which the issue is created is added to the user\'s Recently viewed project list'
            }
          },
          required: ['issueKey']
        }
      },
      {
        name: 'jira_create_issue',
        description: 'Create a new JIRA issue. Supports all standard JIRA fields including summary, description, issue type, assignee, priority, labels, and more.',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project key or ID (e.g., "PROJ" or project ID)'
            },
            summary: {
              type: 'string',
              description: 'Issue summary/title'
            },
            description: {
              type: 'string',
              description: 'Issue description (plain text or markdown)'
            },
            issueType: {
              type: 'string',
              description: 'Issue type name (e.g., "Bug", "Task", "Story", "Epic")'
            },
            assignee: {
              type: 'string',
              description: 'Assignee account ID, email, or "-1" for unassigned'
            },
            priority: {
              type: 'string',
              description: 'Priority name (e.g., "Highest", "High", "Medium", "Low", "Lowest")'
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of labels to add to the issue'
            },
            components: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of component names or IDs'
            },
            dueDate: {
              type: 'string',
              description: 'Due date in ISO 8601 format (e.g., "2024-12-31")'
            }
          },
          required: ['project', 'summary', 'issueType']
        }
      },
      {
        name: 'jira_update_issue',
        description: 'Update an existing JIRA issue. Can update summary, description, assignee, priority, labels, and other fields.',
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
              description: 'New description (optional, plain text or markdown)'
            },
            assignee: {
              type: 'string',
              description: 'Assignee account ID, email, or "-1" for unassigned (optional)'
            },
            priority: {
              type: 'string',
              description: 'Priority name (optional)'
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of labels to set (replaces existing labels)'
            },
            dueDate: {
              type: 'string',
              description: 'Due date in ISO 8601 format or null to remove (optional)'
            }
          },
          required: ['issueKey']
        }
      },
      {
        name: 'jira_add_comment',
        description: 'Add a comment to a JIRA issue. Supports plain text comments.',
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
            },
            visibility: {
              type: 'object',
              description: 'Visibility of the comment. Use { "type": "role", "value": "Administrators" } for role-based or { "type": "group", "value": "jira-developers" } for group-based visibility'
            }
          },
          required: ['issueKey', 'comment']
        }
      },
      {
        name: 'jira_transition_issue',
        description: 'Transition an issue to a new status/workflow state. Returns available transitions if the requested transition is not found.',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key (e.g., "PROJ-123")'
            },
            transitionName: {
              type: 'string',
              description: 'Transition name (e.g., "Done", "In Progress", "To Do", "In Review")'
            },
            transitionId: {
              type: 'string',
              description: 'Transition ID (alternative to transitionName)'
            },
            fields: {
              type: 'object',
              description: 'Fields to update during transition (e.g., resolution, assignee)'
            },
            update: {
              type: 'object',
              description: 'Additional update operations (e.g., comment)'
            }
          },
          required: ['issueKey']
        }
      },
      {
        name: 'jira_add_attachment',
        description: 'Upload and attach a file to a JIRA issue. Supports various file types.',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key (e.g., "PROJ-123")'
            },
            filePath: {
              type: 'string',
              description: 'Path to the file to upload (must be accessible from server)'
            },
            fileName: {
              type: 'string',
              description: 'Name for the attachment (optional, defaults to original filename)'
            }
          },
          required: ['issueKey', 'filePath']
        }
      },
      {
        name: 'jira_add_watcher',
        description: 'Add a user to an issue\'s watcher list by account ID or email.',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key (e.g., "PROJ-123")'
            },
            accountId: {
              type: 'string',
              description: 'User account ID'
            },
            email: {
              type: 'string',
              description: 'User email address (alternative to accountId)'
            }
          },
          required: ['issueKey']
        }
      },
      {
        name: 'jira_assign_issue',
        description: 'Assign a JIRA issue to a user, default assignee, or unassign. Supports email/name lookup.',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key (e.g., "PROJ-123")'
            },
            assignee: {
              type: 'string',
              description: 'Assignee account ID, email, "-1" to unassign, or null for default assignee'
            }
          },
          required: ['issueKey', 'assignee']
        }
      },
      {
        name: 'jira_bulk_create_issues',
        description: 'Create multiple JIRA issues (up to 50 per call) with full feature support including markdown, assignee resolution, and priority handling.',
        inputSchema: {
          type: 'object',
          properties: {
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  project: { type: 'string' },
                  summary: { type: 'string' },
                  description: { type: 'string' },
                  issueType: { type: 'string' },
                  assignee: { type: 'string' },
                  priority: { type: 'string' },
                  labels: { type: 'array', items: { type: 'string' } }
                },
                required: ['project', 'summary', 'issueType']
              },
              description: 'Array of issue objects to create (max 50)'
            }
          },
          required: ['issues']
        }
      },
      {
        name: 'jira_link_issues',
        description: 'Link two JIRA issues using a specified link type with an optional comment.',
        inputSchema: {
          type: 'object',
          properties: {
            inwardIssue: {
              type: 'string',
              description: 'Inward issue key (e.g., "PROJ-123")'
            },
            outwardIssue: {
              type: 'string',
              description: 'Outward issue key (e.g., "PROJ-456")'
            },
            linkType: {
              type: 'string',
              description: 'Link type (e.g., "Relates", "Blocks", "Clones", "Duplicates")'
            },
            comment: {
              type: 'string',
              description: 'Optional comment to add when creating the link'
            }
          },
          required: ['inwardIssue', 'outwardIssue', 'linkType']
        }
      },
      {
        name: 'jira_create_project',
        description: 'Create a new JIRA project with required lead, template, and type configuration.',
        inputSchema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Project key (e.g., "PROJ")'
            },
            name: {
              type: 'string',
              description: 'Project name'
            },
            projectTypeKey: {
              type: 'string',
              description: 'Project type key (e.g., "software", "business", "service_desk")'
            },
            leadAccountId: {
              type: 'string',
              description: 'Account ID of the project lead'
            },
            description: {
              type: 'string',
              description: 'Project description'
            },
            assigneeType: {
              type: 'string',
              description: 'Assignee type (e.g., "PROJECT_LEAD", "UNASSIGNED")'
            },
            avatarId: {
              type: 'number',
              description: 'Avatar ID for the project'
            },
            issueSecurityScheme: {
              type: 'number',
              description: 'Issue security scheme ID'
            },
            permissionScheme: {
              type: 'number',
              description: 'Permission scheme ID'
            },
            notificationScheme: {
              type: 'number',
              description: 'Notification scheme ID'
            },
            categoryId: {
              type: 'number',
              description: 'Project category ID'
            }
          },
          required: ['key', 'name', 'projectTypeKey', 'leadAccountId']
        }
      },
      {
        name: 'jira_create_sprint',
        description: 'Create a new sprint on a JIRA board with optional start/end dates and goal.',
        inputSchema: {
          type: 'object',
          properties: {
            boardId: {
              type: 'number',
              description: 'Board ID where the sprint will be created'
            },
            name: {
              type: 'string',
              description: 'Sprint name'
            },
            goal: {
              type: 'string',
              description: 'Sprint goal'
            },
            startDate: {
              type: 'string',
              description: 'Start date in ISO 8601 format (e.g., "2024-01-01T00:00:00.000Z")'
            },
            endDate: {
              type: 'string',
              description: 'End date in ISO 8601 format (e.g., "2024-01-14T23:59:59.999Z")'
            }
          },
          required: ['boardId', 'name']
        }
      },
      {
        name: 'jira_create_version',
        description: 'Create a new version for releases or milestones in a JIRA project.',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project key or ID'
            },
            name: {
              type: 'string',
              description: 'Version name'
            },
            description: {
              type: 'string',
              description: 'Version description'
            },
            released: {
              type: 'boolean',
              description: 'Whether the version is released'
            },
            archived: {
              type: 'boolean',
              description: 'Whether the version is archived'
            },
            startDate: {
              type: 'string',
              description: 'Start date in ISO 8601 format'
            },
            releaseDate: {
              type: 'string',
              description: 'Release date in ISO 8601 format'
            }
          },
          required: ['project', 'name']
        }
      },
      {
        name: 'jira_delete_comment',
        description: 'Delete a specific comment from a JIRA issue using its ID and the issue\'s ID/key. Requires user permission to delete comments on the issue.',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key (e.g., "PROJ-123")'
            },
            commentId: {
              type: 'string',
              description: 'Comment ID to delete'
            }
          },
          required: ['issueKey', 'commentId']
        }
      },
      {
        name: 'jira_delete_issue',
        description: 'Delete a JIRA issue by its ID or key. This action cannot be undone.',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key or ID to delete (e.g., "PROJ-123")'
            },
            deleteSubtasks: {
              type: 'boolean',
              description: 'Whether to delete subtasks (default: false)'
            }
          },
          required: ['issueKey']
        }
      },
      {
        name: 'jira_delete_version',
        description: 'Delete a JIRA version and optionally reassign its issues.',
        inputSchema: {
          type: 'object',
          properties: {
            versionId: {
              type: 'string',
              description: 'Version ID to delete'
            },
            moveAffectedIssuesTo: {
              type: 'string',
              description: 'Version ID to move affected issues to (optional)'
            },
            moveFixIssuesTo: {
              type: 'string',
              description: 'Version ID to move fix issues to (optional)'
            }
          },
          required: ['versionId']
        }
      },
      {
        name: 'jira_delete_worklog',
        description: 'Delete a worklog from a JIRA issue with estimate adjustment options.',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key (e.g., "PROJ-123")'
            },
            worklogId: {
              type: 'string',
              description: 'Worklog ID to delete'
            },
            adjustEstimate: {
              type: 'string',
              description: 'How to adjust the estimate: "new" (set to new value), "leave" (leave unchanged), "manual" (reduce by worklog time), "auto" (reduce by worklog time)'
            },
            newEstimate: {
              type: 'string',
              description: 'New estimate value (required if adjustEstimate is "new")'
            },
            increaseBy: {
              type: 'string',
              description: 'Amount to increase estimate by (for "manual" or "auto")'
            },
            reduceBy: {
              type: 'string',
              description: 'Amount to reduce estimate by (for "manual" or "auto")'
            }
          },
          required: ['issueKey', 'worklogId']
        }
      },
      {
        name: 'jira_find_users',
        description: 'Search for JIRA users by email, display name, or username to find account IDs. Essential for assigning issues, adding watchers, and other user-related operations.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (email, display name, or username)'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50, max: 1000)'
            },
            startAt: {
              type: 'number',
              description: 'The index of the first user to return (default: 0)'
            },
            includeActive: {
              type: 'boolean',
              description: 'Include active users (default: true)'
            },
            includeInactive: {
              type: 'boolean',
              description: 'Include inactive users (default: false)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'jira_get_issue_type_schemes',
        description: 'Retrieve all JIRA issue type schemes with optional filtering and pagination.',
        inputSchema: {
          type: 'object',
          properties: {
            startAt: {
              type: 'number',
              description: 'The index of the first item to return (default: 0)'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50, max: 100)'
            },
            id: {
              type: 'array',
              items: { type: 'number' },
              description: 'List of issue type scheme IDs to filter by'
            }
          },
          required: []
        }
      },
      {
        name: 'jira_get_issue_statuses',
        description: 'Retrieve all available issue statuses from JIRA with details.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'jira_get_all_users',
        description: 'Retrieve all users from the JIRA instance including active, inactive, and other user states with pagination support.',
        inputSchema: {
          type: 'object',
          properties: {
            startAt: {
              type: 'number',
              description: 'The index of the first user to return (default: 0)'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50, max: 1000)'
            },
            includeActive: {
              type: 'boolean',
              description: 'Include active users (default: true)'
            },
            includeInactive: {
              type: 'boolean',
              description: 'Include inactive users (default: false)'
            }
          },
          required: []
        }
      },
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

      return await this.callDirectApiTool(connection, toolName, args);
  }

  /**
   * Call tool via direct API
   */
  async callDirectApiTool(connection, toolName, args) {
    if (!connection.siteUrl) {
      throw new Error('JIRA site URL is not available. Please reconnect JIRA.');
    }

    // Refresh token if needed before making API call (like Spotify)
    let accessToken = connection.token;
    if (connection.refreshToken) {
      accessToken = await this.refreshTokenIfNeeded(
        connection.token,
        connection.refreshToken,
        connection.userId
      );
      // Update connection with refreshed token
      if (accessToken !== connection.token) {
        connection.token = accessToken;
      }
    }

    // For OAuth 2.0 (3LO), use api.atlassian.com with cloudId
    // See: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#about
    let baseUrl;
    if (connection.cloudId) {
      // OAuth 2.0 (3LO) format: https://api.atlassian.com/ex/jira/<cloudId>/rest/api/3
      baseUrl = `https://api.atlassian.com/ex/jira/${connection.cloudId}/rest/api/3`;
      console.log(`🔗 Using OAuth 2.0 API URL format with cloudId: ${connection.cloudId}`);
    } else {
      // Fallback to site URL format (for basic auth or other auth methods)
      baseUrl = `${connection.siteUrl}/rest/api/3`;
      console.log(`🔗 Using site URL format: ${connection.siteUrl}`);
    }
    
    // Base headers for all requests
    const baseHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
    
    // Helper to get headers with Content-Type for POST/PUT requests
    const getHeaders = (includeContentType = false) => {
      if (includeContentType) {
        return {
          ...baseHeaders,
          'Content-Type': 'application/json',
        };
      }
      return baseHeaders;
    };

    try {
      let result;

      switch (toolName) {
        case 'jira_list_projects': {
          const { expand, recent } = args;
          const params = {};
          if (expand) params.expand = expand;
          if (recent !== undefined) params.recent = recent;

          const response = await axios.get(`${baseUrl}/project`, {
            headers: getHeaders(false), // GET request - no Content-Type
            params,
            timeout: 10000,
          });

          // Format the response to be more useful
          result = {
            projects: response.data.map(project => ({
              id: project.id,
              key: project.key,
              name: project.name,
              projectTypeKey: project.projectTypeKey,
              simplified: project.simplified,
              style: project.style,
              isPrivate: project.isPrivate,
              properties: project.properties,
              lead: project.lead ? {
                accountId: project.lead.accountId,
                displayName: project.lead.displayName,
                emailAddress: project.lead.emailAddress,
              } : null,
              projectCategory: project.projectCategory ? {
                id: project.projectCategory.id,
                name: project.projectCategory.name,
                description: project.projectCategory.description,
              } : null,
            })),
            total: response.data.length,
          };
          break;
        }

        case 'jira_search_issues': {
          const { jql, maxResults = 50, startAt = 0, fields, expand } = args;
          
          if (!jql || jql.trim() === '') {
            throw new Error('JQL query is required for searching issues');
          }
          
          // Try to resolve currentUser() if present in JQL
          let finalJql = jql.trim();
          const userId = connection.userId;
          const userEmail = connection.email;
          
          // If JQL contains currentUser() and we have user info, try to replace it
          if (finalJql.includes('currentUser()') && (userId || userEmail)) {
            try {
              // Try to get current user's account ID
              console.log(`🔍 Attempting to resolve currentUser() via /myself endpoint...`);
              const userResponse = await axios.get(`${baseUrl}/myself`, {
                headers: getHeaders(false), // GET request - no Content-Type
                timeout: 10000,
              });
              
              if (userResponse.data && userResponse.data.accountId) {
                // Replace currentUser() with actual account ID (without the parentheses)
                finalJql = finalJql.replace(/currentUser\(\)/g, userResponse.data.accountId);
                console.log(`✅ Replaced currentUser() with account ID: ${userResponse.data.accountId}`);
              } else {
                console.warn('⚠️  /myself returned data but no accountId');
              }
            } catch (userError) {
              console.warn('⚠️  Could not resolve currentUser(), using original JQL');
              console.warn(`   Error: ${userError.message}`);
              console.warn(`   Status: ${userError.response?.status}`);
              console.warn(`   Response: ${JSON.stringify(userError.response?.data, null, 2)}`);
              // Continue with original JQL - if currentUser() doesn't work, JIRA might support it natively
            }
          }
          
          const params = {
            jql: finalJql,
            maxResults: Math.min(maxResults, 100),
            startAt,
          };
          if (fields && fields.length > 0) {
            params.fields = fields.join(',');
          }
          if (expand) params.expand = expand;

          console.log(`🔍 JIRA search: JQL="${finalJql}", maxResults=${params.maxResults}, startAt=${startAt}`);
          
          // Retry logic for temporary service unavailability
          let lastError = null;
          const maxRetries = 2; // Reduced retries since if it fails twice, it's likely not temporary
          let response = null;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              // Use /search/jql endpoint (the old /search endpoint was deprecated)
              // See: https://developer.atlassian.com/changelog/#CHANGE-2046
              // The /search endpoint returns 410 Gone, must use /search/jql
              response = await axios.get(`${baseUrl}/search/jql`, {
                headers: getHeaders(false), // GET request - no Content-Type
                params,
                timeout: 30000,
              });
              break; // Success, exit retry loop
            } catch (error) {
              lastError = error;
              
              // Check if it's a temporary service unavailability error
              const isTemporaryError = error.response?.status === 400 && 
                (error.response?.data?.errorMessage?.toLowerCase().includes('temporarily unavailable') ||
                 error.response?.data?.errorMessage?.toLowerCase().includes('service unavailable'));
              
              // Also check for rate limiting (429) or server errors (503, 502)
              const isRetryableError = isTemporaryError || 
                error.response?.status === 429 || 
                error.response?.status === 503 || 
                error.response?.status === 502;
              
              // If it's a 400 error that's not "temporarily unavailable", it's likely a JQL syntax error
              // Don't retry those - they won't succeed
              if (error.response?.status === 400 && !isTemporaryError) {
                console.error(`❌ JQL syntax error detected - not retrying`);
                throw error;
              }
              
              // If we've tried multiple times and still getting "temporarily unavailable",
              // test with a different endpoint to verify API connectivity
              if (isTemporaryError && attempt === maxRetries) {
                console.log(`⚠️  Testing JIRA API connectivity with /myself endpoint...`);
                try {
                  // Test with /myself endpoint (simpler than search)
                  const testResponse = await axios.get(`${baseUrl}/myself`, {
                    headers: getHeaders(false), // GET request - no Content-Type
                    timeout: 10000,
                  });
                  console.log(`✅ /myself endpoint works - API is accessible, issue is with search endpoint`);
                  // The API works, but search endpoint fails - likely a search-specific issue
                  throw new Error(
                    `JIRA API is accessible, but the search endpoint is failing.\n` +
                    `This may indicate:\n` +
                    `1. Search API rate limiting or restrictions\n` +
                    `2. Insufficient permissions for search operations\n` +
                    `3. Search service temporarily unavailable\n` +
                    `4. The JQL query may be invalid (even though simple queries fail too)\n\n` +
                    `Original error: ${error.response?.data?.errorMessage || error.message}\n` +
                    `Failed JQL: ${finalJql}\n` +
                    `Note: Make sure you're using /search/jql endpoint (not /search)`
                  );
                } catch (testError) {
                  // If even /myself fails, it's a real authentication/service issue
                  console.error(`❌ Even /myself endpoint failed - checking authentication...`);
                  console.error(`   Test error status: ${testError.response?.status}`);
                  console.error(`   Test error data:`, JSON.stringify(testError.response?.data, null, 2));
                  console.error(`   Test request URL: ${testError.config?.url || baseUrl + '/myself'}`);
                  console.error(`   Base URL: ${baseUrl}`);
                  console.error(`   Site URL: ${connection.siteUrl}`);
                  
                  if (testError.response?.status === 401) {
                    throw new Error(
                      `JIRA authentication failed. Token may be invalid or expired.\n` +
                      `Status: 401 Unauthorized\n` +
                      `Please reconnect JIRA to refresh your authentication token.`
                    );
                  }
                  
                  // If /myself also returns 400 "Service temporarily unavailable", 
                  // this is very unusual and suggests a request format issue
                  if (testError.response?.status === 400 && 
                      testError.response?.data?.errorMessage?.toLowerCase().includes('temporarily unavailable')) {
                    throw new Error(
                      `JIRA API is returning "Service temporarily unavailable" for all endpoints, including /myself.\n` +
                      `This is unusual and may indicate:\n` +
                      `1. Request format issue (headers, URL construction)\n` +
                      `2. Token format or encoding problem\n` +
                      `3. JIRA instance-specific issue or rate limiting\n` +
                      `4. Network/proxy issue\n\n` +
                      `Site URL: ${connection.siteUrl}\n` +
                      `Base URL: ${baseUrl}\n` +
                      `Please verify:\n` +
                      `- Token is valid and not expired\n` +
                      `- JIRA instance URL is correct: ${connection.siteUrl}\n` +
                      `- Try accessing JIRA web interface to confirm it's accessible`
                    );
                  }
                  
                  // Re-throw the original error with more context
                  const enhancedError = new Error(
                    `JIRA API appears to be unavailable.\n` +
                    `Even the /myself endpoint failed, suggesting a service-wide issue.\n\n` +
                    `Status: ${error.response?.status}\n` +
                    `Error: ${error.response?.data?.errorMessage || error.message}\n` +
                    `Site URL: ${connection.siteUrl}\n\n` +
                    `Please check:\n` +
                    `1. JIRA Cloud status: https://status.atlassian.com/\n` +
                    `2. Your JIRA instance is accessible: ${connection.siteUrl}\n` +
                    `3. Token permissions and validity - try reconnecting JIRA`
                  );
                  enhancedError.response = error.response;
                  throw enhancedError;
                }
              }
              
              if (isRetryableError && attempt < maxRetries) {
                // Check for Retry-After header
                const retryAfter = error.response?.headers['retry-after'];
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : attempt * 3000; // Longer backoff: 3s, 6s
                console.log(`⚠️  JIRA service error (${error.response?.status}), retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
              
              // Not a retryable error or max retries reached
              throw error;
            }
          }
          
          if (!response) {
            throw lastError || new Error('Failed to get response from JIRA');
          }

          result = {
            issues: response.data.issues || [],
            total: response.data.total || 0,
            startAt: response.data.startAt || 0,
            maxResults: response.data.maxResults || 0,
          };
          break;
        }

        case 'jira_get_issue': {
          const { issueKey, fields, expand, updateHistory } = args;
          
          if (!issueKey) {
            throw new Error('issueKey is required for getting an issue');
          }
          
          const params = {};
          if (fields && fields.length > 0) {
            params.fields = fields.join(',');
          }
          if (expand) params.expand = expand;
          if (updateHistory !== undefined) params.updateHistory = updateHistory;

          const response = await axios.get(`${baseUrl}/issue/${issueKey}`, {
            headers: getHeaders(false), // GET request - no Content-Type
            params,
            timeout: 10000,
          });

          result = response.data;
          break;
        }

        case 'jira_create_issue': {
          const { project, summary, description, issueType, assignee, priority, labels, components, dueDate } = args;
          
          if (!project) {
            throw new Error('project is required for creating an issue');
          }
          
          if (!summary) {
            throw new Error('summary is required for creating an issue');
          }
          
          if (!issueType) {
            throw new Error('issueType is required for creating an issue');
          }
          
          const fields = {
              project: { key: project },
              summary,
            issuetype: { name: issueType },
          };

          // Add description if provided (convert to ADF format)
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

          // Add assignee if provided
          if (assignee) {
            if (assignee === '-1') {
              fields.assignee = null; // Unassign
            } else if (typeof assignee === 'string' && assignee.includes('@')) {
              // Email address
              fields.assignee = { emailAddress: assignee };
            } else {
              // Account ID
              fields.assignee = { accountId: assignee };
            }
          }

          // Add priority if provided
          if (priority) {
            fields.priority = { name: priority };
          }

          // Add labels if provided
          if (labels && labels.length > 0) {
            fields.labels = labels;
          }

          // Add components if provided
          if (components && components.length > 0) {
            fields.components = components.map(comp => ({ name: comp }));
          }

          // Add due date if provided
          if (dueDate) {
            fields.duedate = dueDate;
          }

          const response = await axios.post(`${baseUrl}/issue`, {
            fields
          }, {
            headers: getHeaders(true), // POST request - needs Content-Type
            timeout: 10000,
          });

          result = {
            id: response.data.id,
            key: response.data.key,
            self: response.data.self,
            message: 'Issue created successfully'
          };
          break;
        }

        case 'jira_update_issue': {
          const { issueKey, summary, description, assignee, priority, labels, dueDate } = args;
          
          if (!issueKey) {
            throw new Error('issueKey is required for updating an issue');
          }
          
          const fields = {};
          
          if (summary !== undefined) fields.summary = summary;
          
          if (description !== undefined) {
            if (description === null) {
              fields.description = null; // Remove description
            } else {
            fields.description = {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: description }]
              }]
            };
          }
          }

          if (assignee !== undefined) {
            if (assignee === '-1' || assignee === null) {
              fields.assignee = null; // Unassign
            } else if (assignee.includes('@')) {
              // Email address
              fields.assignee = { emailAddress: assignee };
            } else {
              // Account ID
              fields.assignee = { accountId: assignee };
            }
          }

          if (priority !== undefined) {
            if (priority === null) {
              fields.priority = null;
            } else {
              fields.priority = { name: priority };
            }
          }

          if (labels !== undefined) {
            fields.labels = labels;
          }

          if (dueDate !== undefined) {
            fields.duedate = dueDate; // Can be null to remove
          }

          await axios.put(`${baseUrl}/issue/${issueKey}`, { fields }, {
            headers: getHeaders(true), // PUT request - needs Content-Type
            timeout: 10000,
          });

          result = { 
            message: 'Issue updated successfully', 
            issueKey 
          };
          break;
        }

        case 'jira_add_comment': {
          const { issueKey, comment, visibility } = args;
          
          if (!issueKey) {
            throw new Error('issueKey is required for adding a comment');
          }
          
          if (!comment) {
            throw new Error('comment text is required');
          }
          
          const body = {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: comment }]
              }]
          };

          const payload = { body };
          if (visibility) {
            payload.visibility = visibility;
            }

          const response = await axios.post(`${baseUrl}/issue/${issueKey}/comment`, payload, {
            headers: getHeaders(true), // POST request - needs Content-Type
            timeout: 10000,
          });

          result = {
            id: response.data.id,
            author: response.data.author,
            body: response.data.body,
            created: response.data.created,
            message: 'Comment added successfully'
          };
          break;
        }

        case 'jira_transition_issue': {
          const { issueKey, transitionName, transitionId, fields, update } = args;
          
          if (!issueKey) {
            throw new Error('issueKey is required for transitioning an issue');
          }
          
          // If transitionName is provided, we need to find the transition ID
          let finalTransitionId = transitionId;
          
          if (transitionName && !transitionId) {
          // Get available transitions
          const transitionsResponse = await axios.get(`${baseUrl}/issue/${issueKey}/transitions`, {
            headers: getHeaders(false), // GET request - no Content-Type
            timeout: 10000,
          });
          
          const transition = transitionsResponse.data.transitions.find(
            t => t.name.toLowerCase() === transitionName.toLowerCase()
          );
          
          if (!transition) {
              const availableTransitions = transitionsResponse.data.transitions.map(t => ({
                id: t.id,
                name: t.name,
                to: t.to.name
              }));
              throw new Error(
                `Transition "${transitionName}" not found. Available transitions: ${JSON.stringify(availableTransitions, null, 2)}`
              );
            }
            
            finalTransitionId = transition.id;
          }

          if (!finalTransitionId) {
            throw new Error('Either transitionName or transitionId must be provided');
          }

          const payload = {
            transition: { id: finalTransitionId }
          };

          if (fields) payload.fields = fields;
          if (update) payload.update = update;
          
          await axios.post(`${baseUrl}/issue/${issueKey}/transitions`, payload, {
            headers: getHeaders(true), // POST request - needs Content-Type
            timeout: 10000,
          });
          
          result = { 
            message: `Issue transitioned successfully`, 
            issueKey,
            transitionId: finalTransitionId
          };
          break;
        }

        case 'jira_add_attachment': {
          const { issueKey, filePath, fileName } = args;
          
          if (!issueKey) {
            throw new Error('issueKey is required for adding an attachment');
          }
          
          if (!filePath) {
            throw new Error('filePath is required for adding an attachment');
          }
          
          const form = new FormData();
          
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
          }
          
          const fileStream = fs.createReadStream(filePath);
          const finalFileName = fileName || filePath.split('/').pop();
          form.append('file', fileStream, finalFileName);
          
          const response = await axios.post(`${baseUrl}/issue/${issueKey}/attachments`, form, {
            headers: {
              ...form.getHeaders(),
              Authorization: `Bearer ${accessToken}`,
              'X-Atlassian-Token': 'no-check',
            },
            timeout: 30000,
          });
          
          result = {
            attachments: response.data,
            message: 'Attachment added successfully'
          };
          break;
        }

        case 'jira_add_watcher': {
          const { issueKey, accountId, email } = args;
          
          if (!issueKey) {
            throw new Error('issueKey is required for adding a watcher');
          }
          
          if (!accountId && !email) {
            throw new Error('Either accountId or email must be provided');
          }
          
          // JIRA API expects just the accountId string, not an object
          const watcherId = accountId || email;
          
          await axios.post(`${baseUrl}/issue/${issueKey}/watchers`, `"${watcherId}"`, {
            headers: getHeaders(true), // POST request - needs Content-Type
            timeout: 10000,
          });
          
          result = { message: 'Watcher added successfully', issueKey };
          break;
        }

        case 'jira_assign_issue': {
          const { issueKey, assignee } = args;
          
          if (!issueKey) {
            throw new Error('issueKey is required for assigning an issue');
          }
          
          if (assignee === undefined) {
            throw new Error('assignee is required. Provide accountId, email, "-1" to unassign, or null for default assignee');
          }
          
          // JIRA API accepts { accountId: "..." }, { emailAddress: "..." }, or null
          let payload = null;
          if (assignee === '-1' || assignee === null) {
            payload = null; // Unassign
          } else if (typeof assignee === 'string' && assignee.includes('@')) {
            payload = { emailAddress: assignee };
          } else if (assignee) {
            payload = { accountId: assignee };
          }
          
          await axios.put(`${baseUrl}/issue/${issueKey}/assignee`, payload, {
            headers: getHeaders(true), // PUT request - needs Content-Type
            timeout: 10000,
          });
          
          result = { message: 'Issue assigned successfully', issueKey, assignee };
          break;
        }

        case 'jira_bulk_create_issues': {
          const { issues } = args;
          
          if (!issues || !Array.isArray(issues) || issues.length === 0) {
            throw new Error('issues array is required and must not be empty');
      }

          if (issues.length > 50) {
            throw new Error('Maximum 50 issues can be created per request');
          }
          
          const issuePayloads = issues.map(issue => {
            const fields = {
              project: { key: issue.project },
              summary: issue.summary,
              issuetype: { name: issue.issueType },
            };
            
            if (issue.description) {
              fields.description = {
                type: 'doc',
                version: 1,
        content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: issue.description }]
                }]
              };
            }
            
            if (issue.assignee) {
              if (issue.assignee === '-1') {
                fields.assignee = null;
              } else if (typeof issue.assignee === 'string' && issue.assignee.includes('@')) {
                fields.assignee = { emailAddress: issue.assignee };
              } else {
                fields.assignee = { accountId: issue.assignee };
              }
            }
            
            if (issue.priority) {
              fields.priority = { name: issue.priority };
            }
            
            if (issue.labels && issue.labels.length > 0) {
              fields.labels = issue.labels;
            }
            
            return { fields };
          });
          
          const response = await axios.post(`${baseUrl}/issue/bulk`, {
            issueUpdates: issuePayloads
          }, {
            headers: getHeaders(true), // POST request - needs Content-Type
            timeout: 30000,
          });
          
          result = {
            issues: response.data.issues || [],
            errors: response.data.errors || [],
            message: `Bulk create completed: ${response.data.issues?.length || 0} created, ${response.data.errors?.length || 0} errors`
          };
          break;
    }

        case 'jira_link_issues': {
          const { inwardIssue, outwardIssue, linkType, comment } = args;
          
          if (!inwardIssue) {
            throw new Error('inwardIssue is required for linking issues');
          }
          
          if (!outwardIssue) {
            throw new Error('outwardIssue is required for linking issues');
          }
          
          if (!linkType) {
            throw new Error('linkType is required for linking issues');
          }
          
          const payload = {
            type: { name: linkType },
            inwardIssue: { key: inwardIssue },
            outwardIssue: { key: outwardIssue }
          };
          
          if (comment) {
            payload.comment = {
              body: {
                type: 'doc',
                version: 1,
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: comment }]
                }]
              }
            };
          }
          
          const response = await axios.post(`${baseUrl}/issueLink`, payload, {
            headers: getHeaders(true), // POST request - needs Content-Type
            timeout: 10000,
          });
          
          result = {
            id: response.data.id,
            message: 'Issues linked successfully',
            inwardIssue,
            outwardIssue,
            linkType
          };
          break;
      }

        case 'jira_create_project': {
          const { key, name, projectTypeKey, leadAccountId, description, assigneeType, avatarId, issueSecurityScheme, permissionScheme, notificationScheme, categoryId } = args;
          
          if (!key) {
            throw new Error('key is required for creating a project');
          }
          
          if (!name) {
            throw new Error('name is required for creating a project');
          }
          
          if (!projectTypeKey) {
            throw new Error('projectTypeKey is required for creating a project');
          }
          
          if (!leadAccountId) {
            throw new Error('leadAccountId is required for creating a project');
          }
          
          const payload = {
            key,
            name,
            projectTypeKey,
            leadAccountId,
          };
          
          if (description) payload.description = description;
          if (assigneeType) payload.assigneeType = assigneeType;
          if (avatarId) payload.avatarId = avatarId;
          if (issueSecurityScheme) payload.issueSecurityScheme = issueSecurityScheme;
          if (permissionScheme) payload.permissionScheme = permissionScheme;
          if (notificationScheme) payload.notificationScheme = notificationScheme;
          if (categoryId) payload.categoryId = categoryId;
          
          const response = await axios.post(`${baseUrl}/project`, payload, {
            headers: getHeaders(true), // POST request - needs Content-Type
            timeout: 30000,
          });
          
          result = {
            id: response.data.id,
            key: response.data.key,
            name: response.data.name,
            message: 'Project created successfully'
          };
          break;
        }

        case 'jira_create_sprint': {
          const { boardId, name, goal, startDate, endDate } = args;
          
          if (!boardId) {
            throw new Error('boardId is required for creating a sprint');
          }
          
          if (!name) {
            throw new Error('name is required for creating a sprint');
          }
          
          const payload = {
            name,
          };
          
          if (goal) payload.goal = goal;
          if (startDate) payload.startDate = startDate;
          if (endDate) payload.endDate = endDate;
          
          const response = await axios.post(`${baseUrl}/board/${boardId}/sprint`, payload, {
            headers: getHeaders(true), // POST request - needs Content-Type
            timeout: 10000,
          });
          
          result = {
            id: response.data.id,
            name: response.data.name,
            message: 'Sprint created successfully'
          };
          break;
        }

        case 'jira_create_version': {
          const { project, name, description, released, archived, startDate, releaseDate } = args;
          
          if (!project) {
            throw new Error('project is required for creating a version');
          }
          
          if (!name) {
            throw new Error('name is required for creating a version');
          }
          
          const payload = {
            name,
            project,
    };

          if (description) payload.description = description;
          if (released !== undefined) payload.released = released;
          if (archived !== undefined) payload.archived = archived;
          if (startDate) payload.startDate = startDate;
          if (releaseDate) payload.releaseDate = releaseDate;
          
          const response = await axios.post(`${baseUrl}/version`, payload, {
            headers: getHeaders(true), // POST request - needs Content-Type
            timeout: 10000,
          });

          result = {
            id: response.data.id,
            name: response.data.name,
            message: 'Version created successfully'
          };
          break;
        }

        case 'jira_delete_comment': {
          const { issueKey, commentId } = args;
          
          if (!issueKey) {
            throw new Error('issueKey is required for deleting a comment');
          }
          
          if (!commentId) {
            throw new Error('commentId is required for deleting a comment');
          }
          
          await axios.delete(`${baseUrl}/issue/${issueKey}/comment/${commentId}`, {
            headers: getHeaders(false), // DELETE request - no Content-Type
            timeout: 10000,
          });
          
          result = { message: 'Comment deleted successfully', issueKey, commentId };
          break;
        }

        case 'jira_delete_issue': {
          const { issueKey, deleteSubtasks = false } = args;
          
          if (!issueKey) {
            throw new Error('issueKey is required for deleting an issue');
          }
          
          const params = {};
          if (deleteSubtasks) params.deleteSubtasks = 'true';
          
          await axios.delete(`${baseUrl}/issue/${issueKey}`, {
            headers: getHeaders(false), // DELETE request - no Content-Type
            params,
            timeout: 10000,
          });
          
          result = { message: 'Issue deleted successfully', issueKey };
          break;
        }

        case 'jira_delete_version': {
          const { versionId, moveAffectedIssuesTo, moveFixIssuesTo } = args;
          
          if (!versionId) {
            throw new Error('versionId is required for deleting a version');
          }
          
          const params = {};
          if (moveAffectedIssuesTo) params.moveAffectedIssuesTo = moveAffectedIssuesTo;
          if (moveFixIssuesTo) params.moveFixIssuesTo = moveFixIssuesTo;
          
          await axios.delete(`${baseUrl}/version/${versionId}`, {
            headers: getHeaders(false), // DELETE request - no Content-Type
            params,
            timeout: 10000,
          });
          
          result = { message: 'Version deleted successfully', versionId };
          break;
        }

        case 'jira_delete_worklog': {
          const { issueKey, worklogId, adjustEstimate, newEstimate, increaseBy, reduceBy } = args;
          
          if (!issueKey) {
            throw new Error('issueKey is required for deleting a worklog');
          }
          
          if (!worklogId) {
            throw new Error('worklogId is required for deleting a worklog');
          }
          
          const params = {};
          if (adjustEstimate) params.adjustEstimate = adjustEstimate;
          if (newEstimate) params.newEstimate = newEstimate;
          if (increaseBy) params.increaseBy = increaseBy;
          if (reduceBy) params.reduceBy = reduceBy;
          
          await axios.delete(`${baseUrl}/issue/${issueKey}/worklog/${worklogId}`, {
            headers: getHeaders(false), // DELETE request - no Content-Type
            params,
            timeout: 10000,
          });
          
          result = { message: 'Worklog deleted successfully', issueKey, worklogId };
          break;
        }

        case 'jira_find_users': {
          const { query, maxResults = 50, startAt = 0, includeActive = true, includeInactive = false } = args;
          
          const params = {
            query,
            maxResults: Math.min(maxResults, 1000),
            startAt,
            includeActive,
            includeInactive,
          };
          
          const response = await axios.get(`${baseUrl}/user/search`, {
            headers: getHeaders(false), // GET request - no Content-Type
            params,
            timeout: 10000,
          });
          
          result = {
            users: response.data || [],
            total: response.data?.length || 0,
          };
          break;
        }

        case 'jira_get_issue_type_schemes': {
          const { startAt = 0, maxResults = 50, id } = args;
          
          const params = {
            startAt,
            maxResults: Math.min(maxResults, 100),
          };
          
          if (id && id.length > 0) {
            params.id = id.join(',');
          }
          
          const response = await axios.get(`${baseUrl}/issuetypescheme`, {
            headers: getHeaders(false), // GET request - no Content-Type
            params,
            timeout: 10000,
          });
          
          result = {
            values: response.data.values || [],
            total: response.data.total || 0,
            startAt: response.data.startAt || 0,
            maxResults: response.data.maxResults || 0,
          };
          break;
        }

        case 'jira_get_issue_statuses': {
          const response = await axios.get(`${baseUrl}/status`, {
            headers: getHeaders(false), // GET request - no Content-Type
            timeout: 10000,
          });
          
          result = {
            statuses: response.data || [],
            total: response.data?.length || 0,
          };
          break;
        }

        case 'jira_get_all_users': {
          const { startAt = 0, maxResults = 50, includeActive = true, includeInactive = false } = args;
          
          const params = {
            startAt,
            maxResults: Math.min(maxResults, 1000),
            includeActive,
            includeInactive,
          };
          
          const response = await axios.get(`${baseUrl}/users/search`, {
            headers: getHeaders(false), // GET request - no Content-Type
            params,
            timeout: 10000,
          });
          
          result = {
            users: response.data || [],
            total: response.data?.length || 0,
            startAt,
            maxResults,
          };
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
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Response data:`, JSON.stringify(error.response?.data, null, 2));
      if (error.config) {
        console.error(`   Request URL: ${error.config.url || error.config.baseURL + error.config.url}`);
        console.error(`   Request method: ${error.config.method}`);
        console.error(`   Request params:`, JSON.stringify(error.config.params, null, 2));
        console.error(`   Request headers:`, JSON.stringify(error.config.headers, null, 2));
      } else {
        console.error(`   Request config not available (error may have been thrown manually)`);
      }
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        return this.buildOAuthResponse(connection);
      }

      // For 400 errors, provide more helpful error messages
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        let errorMessage = error.message;
        
        // Check if it's a temporary service unavailability (should have been retried already)
        const isTemporaryError = errorData?.errorMessage?.toLowerCase().includes('temporarily unavailable') ||
                                 errorData?.errorMessage?.toLowerCase().includes('service unavailable');
        
        if (isTemporaryError) {
          errorMessage = 'JIRA service is temporarily unavailable. This could be due to:\n' +
            '1. JIRA server maintenance or high load\n' +
            '2. Rate limiting - too many requests\n' +
            '3. Invalid JQL syntax (JIRA sometimes reports syntax errors as "temporarily unavailable")\n\n' +
            'Please try:\n' +
            '- Simplifying your JQL query\n' +
            '- Waiting a few moments and trying again\n' +
            '- Using a simpler query first to test connectivity';
        } else if (errorData?.errorMessages && errorData.errorMessages.length > 0) {
          errorMessage = `JIRA API error: ${errorData.errorMessages.join('; ')}`;
        } else if (errorData?.errors) {
          const errorDetails = Object.entries(errorData.errors)
            .map(([key, value]) => `${key}: ${value}`)
            .join('; ');
          errorMessage = `JIRA API error: ${errorDetails}`;
        }
        
        return {
          isError: true,
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: errorMessage,
              details: errorData,
              status: 400,
              jql: error.config?.params?.jql,
              suggestion: isTemporaryError ? 
                'Try using a simpler JQL query first (e.g., "ORDER BY updated DESC") to test if the API is working. If that works, the issue is likely with the JQL syntax.' : 
                'Check the JQL syntax - some functions may not be supported in REST API v3.',
            }, null, 2)
          }]
        };
      }

      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            details: error.response?.data || null,
            status: error.response?.status || null,
          }, null, 2)
        }]
      };
    }
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
        }, null, 2)
      }]
    };
  }
}

module.exports = JiraIntegration;
