const { google } = require('googleapis');

/**
 * Google Calendar Integration (Direct API)
 * Directly uses Google Calendar API v3 following best practices
 * Provides comprehensive calendar management, event creation, and scheduling
 * 
 * Based on Google Calendar API v3 documentation and best practices:
 * - Proper OAuth 2.0 scopes
 * - Efficient event management
 * - Recurring event support
 * - Attendee management with proper merging
 * - Conference data support (Google Meet)
 * - Error handling with rate limit awareness
 */
class GoogleCalendarIntegration {
  constructor() {
    this.name = 'Google Calendar';
    this.type = 'google-calendar';
    this.description = 'View events, create meetings, manage your calendar, and schedule appointments';
    this.icon = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png?20221106121915';
  }

  /**
   * Connect to Google Calendar API
   * @param {Object} config - Integration configuration
   * @param {string} config.token - Google access token
   * @param {string} config.refreshToken - Google refresh token
   * @returns {Promise<Object>} - Calendar client
   */
  async connect(config) {
    if (!config || !config.token || !config.refreshToken) {
      throw new Error('Google Calendar access token and refresh token are required');
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
      );
      
      oauth2Client.setCredentials({
        access_token: config.token,
        refresh_token: config.refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      // Test the connection
      await calendar.calendarList.list();
      
      return { calendar, oauth2Client };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disconnect from Google Calendar
   */
  async disconnect(connection) {
    // No cleanup needed for direct API integration
  }

  /**
   * Get available tools following Google Calendar API best practices
   */
  async getTools(connection) {
    return [
      {
        name: 'list_calendars',
        description: 'List all calendars accessible to the user including primary calendar and any shared calendars. Returns calendar ID, name, timezone, and access role.',
        inputSchema: {
          type: 'object',
          properties: {
            minAccessRole: {
              type: 'string',
              enum: ['freeBusyReader', 'reader', 'writer', 'owner'],
              description: 'Minimum access role required (optional). Default: returns all calendars user has access to.',
            },
          },
        }
      },
      {
        name: 'list_events',
        description: 'List events from a calendar with filtering options. Returns events with details like title, time, location, attendees, description, and links. Supports recurring events expansion.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID. Use "primary" for the user\'s main calendar, or a specific calendar ID from list_calendars. Default: "primary"',
              default: 'primary',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of events to return. Default: 10, Maximum: 2500',
              default: 10,
              minimum: 1,
              maximum: 2500,
            },
            timeMin: {
              type: 'string',
              description: 'Lower bound (exclusive) for event end time in RFC3339 format (e.g., "2024-01-01T00:00:00Z"). If not specified, defaults to current time.',
            },
            timeMax: {
              type: 'string',
              description: 'Upper bound (exclusive) for event start time in RFC3339 format (e.g., "2024-12-31T23:59:59Z").',
            },
            q: {
              type: 'string',
              description: 'Free text search query to find events matching terms in summary, description, or location fields.',
            },
            singleEvents: {
              type: 'boolean',
              description: 'Whether to expand recurring events into individual instances. Default: true. Set to false to get recurring event series.',
              default: true,
            },
            orderBy: {
              type: 'string',
              enum: ['startTime', 'updated'],
              description: 'Order results by start time or last updated time. Default: "startTime". Requires singleEvents=true.',
              default: 'startTime',
            },
          },
        }
      },
      {
        name: 'get_event',
        description: 'Get detailed information about a specific event by ID. Returns full event details including attendees, recurrence rules, reminders, and conference data.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID. Use "primary" for the user\'s main calendar. Default: "primary"',
              default: 'primary',
            },
            eventId: {
              type: 'string',
              description: 'The ID of the event to retrieve (required)',
            },
            timeZone: {
              type: 'string',
              description: 'Time zone used in the response (optional). Defaults to calendar timezone.',
            },
          },
          required: ['eventId'],
        }
      },
      {
        name: 'create_event',
        description: 'Create a new calendar event with attendees, location, reminders, and optional Google Meet conference. Use this when user wants to schedule a meeting, add an event, or create an appointment. IMPORTANT: start and end must be objects with dateTime (RFC3339 format like "2024-12-03T10:00:00") and timeZone (IANA timezone like "America/New_York"). If user specifies a duration (e.g., "30 minutes"), calculate end time by adding duration to start time.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID. Use "primary" for the user\'s main calendar. Default: "primary"',
              default: 'primary',
            },
            summary: {
              type: 'string',
              description: 'Event title/summary (required). Example: "30-minute call with John"',
            },
            description: {
              type: 'string',
              description: 'Event description/details in plain text or HTML',
            },
            start: {
              type: 'object',
              description: 'Event start time (required). MUST be an object with dateTime (RFC3339 format like "2024-12-03T10:00:00") and timeZone (IANA timezone like "America/New_York" or "Asia/Kolkata"). For all-day events, use date instead of dateTime.',
              properties: {
                dateTime: {
                  type: 'string',
                  description: 'RFC3339 datetime string in format "YYYY-MM-DDTHH:mm:ss" (e.g., "2024-12-03T10:00:00"). Do NOT include Z or timezone offset - use timeZone field instead.',
                },
                date: {
                  type: 'string',
                  description: 'Date string for all-day events in format "YYYY-MM-DD" (e.g., "2024-12-03"). Use this instead of dateTime for all-day events.',
                },
                timeZone: {
                  type: 'string',
                  description: 'IANA timezone identifier (REQUIRED for timed events). Examples: "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Kolkata", "Asia/Tokyo".',
                },
              },
            },
            end: {
              type: 'object',
              description: 'Event end time (required). MUST be an object with dateTime (RFC3339 format) and timeZone (same timezone as start). For all-day events, use date instead of dateTime.',
              properties: {
                dateTime: {
                  type: 'string',
                  description: 'RFC3339 datetime string in format "YYYY-MM-DDTHH:mm:ss" (e.g., "2024-12-03T10:30:00" for a 30-minute event starting at 10:00).',
                },
                date: {
                  type: 'string',
                  description: 'Date string for all-day events in format "YYYY-MM-DD".',
                },
                timeZone: {
                  type: 'string',
                  description: 'IANA timezone identifier (REQUIRED for timed events). Must match the timeZone used in start.',
                },
              },
            },
            location: {
              type: 'string',
              description: 'Event location/venue address or name',
            },
            attendees: {
              type: 'array',
              description: 'List of attendees to invite. Each attendee can be an email string or object with email and optional responseStatus.',
              items: {
                oneOf: [
                  {
                    type: 'string',
                    description: 'Email address as string',
                  },
                  {
                    type: 'object',
                    properties: {
                      email: {
                        type: 'string',
                        description: 'Email address of the attendee',
                      },
                      responseStatus: {
                        type: 'string',
                        enum: ['needsAction', 'declined', 'tentative', 'accepted'],
                        description: 'Response status (optional). Default: "needsAction"',
                      },
                    },
                    required: ['email'],
                  },
                ],
              },
            },
            reminders: {
              type: 'object',
              description: 'Event reminders configuration. If not specified, uses calendar default reminders.',
              properties: {
                useDefault: {
                  type: 'boolean',
                  description: 'Use calendar default reminders. Default: true',
                  default: true,
                },
                overrides: {
                  type: 'array',
                  description: 'Custom reminder overrides. If provided, useDefault must be false.',
                  items: {
                    type: 'object',
                    properties: {
                      method: {
                        type: 'string',
                        enum: ['email', 'popup'],
                        description: 'Reminder method: "email" sends email, "popup" shows notification',
                      },
                      minutes: {
                        type: 'number',
                        description: 'Minutes before event start time to trigger reminder',
                        minimum: 0,
                        maximum: 40320,
                      },
                    },
                    required: ['method', 'minutes'],
                  },
                },
              },
            },
            conferenceData: {
              type: 'object',
              description: 'Conference data for Google Meet. Set createRequest.type to "hangoutsMeet" to create a Google Meet link.',
              properties: {
                createRequest: {
                  type: 'object',
                  properties: {
                    requestId: {
                      type: 'string',
                      description: 'Unique request ID (auto-generated if not provided)',
                    },
                    conferenceSolutionKey: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['hangoutsMeet'],
                          description: 'Conference solution type. Use "hangoutsMeet" for Google Meet',
                        },
                      },
                    },
                  },
                },
              },
            },
            colorId: {
              type: 'string',
              description: 'Event color ID (1-11) for calendar color coding',
            },
            transparency: {
              type: 'string',
              enum: ['opaque', 'transparent'],
              description: 'Whether event shows as busy (opaque) or free (transparent). Default: "opaque"',
            },
            visibility: {
              type: 'string',
              enum: ['default', 'public', 'private', 'confidential'],
              description: 'Event visibility. Default: "default"',
            },
          },
          required: ['summary', 'start', 'end'],
        }
      },
      {
        name: 'update_event',
        description: 'Update an existing calendar event. Can modify time, title, location, attendees, reminders, etc. IMPORTANT: When updating attendees, new attendees are ADDED to existing ones (merged, not replaced). To add an attendee, pass them in the attendees array. To remove an attendee, you must pass the complete list of desired attendees.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID. Use "primary" for the user\'s main calendar. Default: "primary"',
              default: 'primary',
            },
            eventId: {
              type: 'string',
              description: 'The ID of the event to update (required)',
            },
            summary: {
              type: 'string',
              description: 'Updated event title/summary',
            },
            description: {
              type: 'string',
              description: 'Updated event description',
            },
            start: {
              type: 'object',
              description: 'Updated start time. Format: {"dateTime": "2024-12-03T10:00:00", "timeZone": "America/New_York"}',
              properties: {
                dateTime: { 
                  type: 'string',
                  description: 'RFC3339 datetime string (e.g., "2024-12-03T10:00:00")',
                },
                date: { 
                  type: 'string',
                  description: 'Date string for all-day events (e.g., "2024-12-03")',
                },
                timeZone: { 
                  type: 'string',
                  description: 'IANA timezone (e.g., "America/New_York", "Asia/Kolkata")',
                },
              },
            },
            end: {
              type: 'object',
              description: 'Updated end time. Format: {"dateTime": "2024-12-03T10:30:00", "timeZone": "America/New_York"}',
              properties: {
                dateTime: { 
                  type: 'string',
                  description: 'RFC3339 datetime string',
                },
                date: { 
                  type: 'string',
                  description: 'Date string for all-day events',
                },
                timeZone: { 
                  type: 'string',
                  description: 'IANA timezone',
                },
              },
            },
            location: {
              type: 'string',
              description: 'Updated location/venue',
            },
            attendees: {
              type: 'array',
              description: 'Attendees to ADD to the event (merged with existing, duplicates avoided). Pass complete list to replace all attendees. Can be array of email strings or objects with email property.',
              items: {
                oneOf: [
                  {
                    type: 'string',
                    description: 'Email address as string',
                  },
                  {
                    type: 'object',
                    properties: {
                      email: {
                        type: 'string',
                        description: 'Email address of the attendee',
                      },
                      responseStatus: {
                        type: 'string',
                        enum: ['needsAction', 'declined', 'tentative', 'accepted'],
                      },
                    },
                    required: ['email'],
                  },
                ],
              },
            },
            reminders: {
              type: 'object',
              description: 'Updated reminders configuration',
              properties: {
                useDefault: { type: 'boolean' },
                overrides: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      method: { type: 'string', enum: ['email', 'popup'] },
                      minutes: { type: 'number' },
                    },
                  },
                },
              },
            },
            sendUpdates: {
              type: 'string',
              enum: ['all', 'externalOnly', 'none'],
              description: 'Who to send update notifications to. "all" sends to all attendees, "externalOnly" to external attendees only, "none" sends no notifications. Default: "all"',
            },
          },
          required: ['eventId'],
        }
      },
      {
        name: 'delete_event',
        description: 'Delete a calendar event. For recurring events, specify whether to delete only this instance or the entire series.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID. Use "primary" for the user\'s main calendar. Default: "primary"',
              default: 'primary',
            },
            eventId: {
              type: 'string',
              description: 'The ID of the event to delete (required)',
            },
            sendUpdates: {
              type: 'string',
              enum: ['all', 'externalOnly', 'none'],
              description: 'Who to send cancellation notifications to. Default: "all"',
            },
          },
          required: ['eventId'],
        }
      },
      {
        name: 'search_events',
        description: 'Search for events by keywords, date range, or other criteria. Returns matching events sorted by start time.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID. Use "primary" for the user\'s main calendar. Default: "primary"',
              default: 'primary',
            },
            q: {
              type: 'string',
              description: 'Search query to find events matching terms in summary, description, or location',
            },
            timeMin: {
              type: 'string',
              description: 'Start of time range in RFC3339 format (e.g., "2024-01-01T00:00:00Z")',
            },
            timeMax: {
              type: 'string',
              description: 'End of time range in RFC3339 format (e.g., "2024-12-31T23:59:59Z")',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results. Default: 10, Maximum: 2500',
              default: 10,
              minimum: 1,
              maximum: 2500,
            },
            singleEvents: {
              type: 'boolean',
              description: 'Expand recurring events into instances. Default: true',
              default: true,
            },
          },
          required: ['calendarId'],
        }
      },
      {
        name: 'get_upcoming_events',
        description: 'Get upcoming events from now. Returns events sorted by start time. Useful for quick overview of what\'s coming up.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID. Use "primary" for the user\'s main calendar. Default: "primary"',
              default: 'primary',
            },
            maxResults: {
              type: 'number',
              description: 'Number of upcoming events to return. Default: 10, Maximum: 2500',
              default: 10,
              minimum: 1,
              maximum: 2500,
            },
            days: {
              type: 'number',
              description: 'Number of days ahead to look for events. Default: 7',
              default: 7,
              minimum: 1,
              maximum: 365,
            },
          },
        }
      },
    ];
  }

  /**
   * Call a tool with proper error handling
   */
  async callTool(connection, toolName, args) {
    const { calendar } = connection;
    if (!calendar) {
      throw new Error('Google Calendar not connected');
    }

    try {
      switch (toolName) {
        case 'list_calendars':
          return await this.handleListCalendars(connection, args);
        case 'list_events':
          return await this.handleListEvents(connection, args);
        case 'get_event':
          return await this.handleGetEvent(connection, args);
        case 'create_event':
          return await this.handleCreateEvent(connection, args);
        case 'update_event':
          return await this.handleUpdateEvent(connection, args);
        case 'delete_event':
          return await this.handleDeleteEvent(connection, args);
        case 'search_events':
          return await this.handleSearchEvents(connection, args);
        case 'get_upcoming_events':
          return await this.handleGetUpcomingEvents(connection, args);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`Error executing ${toolName}:`, error.message);
      
      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        errorMessage = `${error.message}: ${apiError.message || JSON.stringify(apiError)}`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: errorMessage,
              code: error.response?.status || error.code,
              details: error.response?.data?.error || null,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle list_calendars
   */
  async handleListCalendars(connection, args) {
    const { calendar } = connection;
    const { minAccessRole } = args;
    
    const params = {};
    if (minAccessRole) {
      params.minAccessRole = minAccessRole;
    }
    
    const response = await calendar.calendarList.list(params);
    const calendars = response.data.items || [];

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          calendars: calendars.map(cal => ({
            id: cal.id,
            summary: cal.summary,
            description: cal.description,
            timeZone: cal.timeZone,
            primary: cal.primary || false,
            accessRole: cal.accessRole,
            backgroundColor: cal.backgroundColor,
            foregroundColor: cal.foregroundColor,
            selected: cal.selected,
            summaryOverride: cal.summaryOverride,
          })),
          count: calendars.length,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle list_events with proper parameter handling
   */
  async handleListEvents(connection, args) {
    const { calendar } = connection;
    const { 
      calendarId = 'primary', 
      maxResults = 10, 
      timeMin, 
      timeMax, 
      q,
      singleEvents = true,
      orderBy = 'startTime'
    } = args;

    const params = {
      calendarId,
      maxResults: Math.min(maxResults, 2500),
      singleEvents,
    };

    if (orderBy && singleEvents) {
      params.orderBy = orderBy;
    }

    if (timeMin) {
      params.timeMin = timeMin;
    } else {
      // Default to now if no timeMin specified
      params.timeMin = new Date().toISOString();
    }
    
    if (timeMax) {
      params.timeMax = timeMax;
    }
    
    if (q) {
      params.q = q;
    }

    const response = await calendar.events.list(params);
    const events = response.data.items || [];

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          events: events.map(event => this.formatEvent(event)),
          count: events.length,
          timeZone: response.data.timeZone,
          nextPageToken: response.data.nextPageToken,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle get_event
   */
  async handleGetEvent(connection, args) {
    const { calendar } = connection;
    const { calendarId = 'primary', eventId, timeZone } = args;

    const params = {
      calendarId,
      eventId,
    };
    
    if (timeZone) {
      params.timeZone = timeZone;
    }

    const response = await calendar.events.get(params);
    const event = response.data;
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(this.formatEvent(event, true), null, 2)
      }]
    };
  }

  /**
   * Handle create_event with comprehensive validation
   */
  async handleCreateEvent(connection, args) {
    const { calendar } = connection;
    const { 
      calendarId = 'primary', 
      summary, 
      description, 
      start, 
      end, 
      location, 
      attendees,
      reminders,
      conferenceData,
      colorId,
      transparency,
      visibility
    } = args;

    if (!summary) {
      throw new Error('summary is required');
    }

    if (!start || !end) {
      throw new Error('start and end are required');
    }

    // Normalize and validate start/end times
    const normalizedStart = this.normalizeDateTime(start, 'start');
    const normalizedEnd = this.normalizeDateTime(end, 'end', normalizedStart.timeZone);

    // Validate end is after start
    if (normalizedStart.dateTime && normalizedEnd.dateTime) {
      const startTime = new Date(normalizedStart.dateTime);
      const endTime = new Date(normalizedEnd.dateTime);
      if (endTime <= startTime) {
        throw new Error('End time must be after start time');
      }
    }

    const event = {
      summary,
      description,
      start: normalizedStart,
      end: normalizedEnd,
      location,
    };

    // Handle attendees
    if (attendees && Array.isArray(attendees) && attendees.length > 0) {
      event.attendees = attendees.map(attendee => {
        let email;
        
        if (typeof attendee === 'string') {
          email = attendee.trim();
        } else if (attendee && typeof attendee === 'object' && attendee.email) {
          email = String(attendee.email).trim();
        } else {
          throw new Error(`Invalid attendee format: ${JSON.stringify(attendee)}. Must be an email string or object with email property.`);
        }
        
        // Validate email format
        if (!this.isValidEmail(email)) {
          throw new Error(`Invalid email format: ${email}`);
        }
        
        return {
          email,
          responseStatus: attendee?.responseStatus || 'needsAction',
        };
      }).filter(att => {
        // Filter out any invalid emails that might have passed through
        return att.email && this.isValidEmail(att.email);
      });
    }

    // Handle reminders
    if (reminders) {
      event.reminders = reminders;
    } else {
      // Default reminders
      event.reminders = {
        useDefault: true,
      };
    }

    // Handle conference data (Google Meet)
    if (conferenceData) {
      event.conferenceData = {
        createRequest: {
          requestId: conferenceData.createRequest?.requestId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            type: conferenceData.createRequest?.conferenceSolutionKey?.type || 'hangoutsMeet',
          },
        },
      };
    }

    // Handle optional fields
    if (colorId) {
      event.colorId = colorId;
    }
    if (transparency) {
      event.transparency = transparency;
    }
    if (visibility) {
      event.visibility = visibility;
    }

    try {
      const response = await calendar.events.insert({
        calendarId,
        resource: event,
        conferenceDataVersion: conferenceData ? 1 : 0,
        sendUpdates: attendees && attendees.length > 0 ? 'all' : undefined,
      });

      const createdEvent = response.data;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...this.formatEvent(createdEvent, true),
            message: 'Event created successfully',
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error(`Failed to create event: ${error.message}. ${error.response?.data?.error?.message || ''}`);
    }
  }

  /**
   * Handle update_event with proper attendee merging
   */
  async handleUpdateEvent(connection, args) {
    const { calendar } = connection;
    const { calendarId = 'primary', eventId, attendees, sendUpdates = 'all', ...updates } = args;

    if (!eventId) {
      throw new Error('eventId is required');
    }

    // First get the existing event
    let existingEvent;
    try {
      const getResponse = await calendar.events.get({
        calendarId,
        eventId,
      });
      existingEvent = getResponse.data;
    } catch (error) {
      throw new Error(`Failed to get event: ${error.message}`);
    }

    // Merge updates with existing event
    const updatedEvent = {
      ...existingEvent,
      ...updates,
    };

    // Handle attendees - merge with existing attendees if new ones are provided
    if (attendees !== undefined) {
      const existingAttendees = (existingEvent.attendees || []).map(att => ({
        email: att.email,
        displayName: att.displayName,
        responseStatus: att.responseStatus,
        organizer: att.organizer,
      }));
      
      // Filter out the organizer from existing attendees (organizer shouldn't be in attendees array)
      const existingEmails = new Set(
        existingAttendees
          .filter(a => !a.organizer) // Exclude organizer
          .map(a => (a.email || '').toLowerCase())
      );

      // Normalize new attendees - handle various input formats
      let newAttendees = [];
      
      // If attendees is a string, try to parse it as JSON first
      if (typeof attendees === 'string') {
        try {
          const parsed = JSON.parse(attendees);
          newAttendees = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          // If not JSON, treat as email string
          newAttendees = [attendees];
        }
      } else {
        newAttendees = Array.isArray(attendees) ? attendees : [attendees];
      }

      const normalizedNewAttendees = newAttendees.map(attendee => {
        // Handle string email
        if (typeof attendee === 'string') {
          const email = attendee.trim();
          if (!this.isValidEmail(email)) {
            throw new Error(`Invalid email format: ${email}`);
          }
          return { email, responseStatus: 'needsAction' };
        }
        
        // Handle object with email property
        if (attendee && typeof attendee === 'object') {
          if (attendee.email) {
            const email = String(attendee.email).trim();
            if (!this.isValidEmail(email)) {
              throw new Error(`Invalid email format: ${email}`);
            }
            return {
              email,
              responseStatus: attendee.responseStatus || 'needsAction',
            };
          } else {
            throw new Error(`Invalid attendee object: missing email property. Got: ${JSON.stringify(attendee)}`);
          }
        }
        
        throw new Error(`Invalid attendee format: ${JSON.stringify(attendee)}. Must be an email string or object with email property.`);
      });

      // Merge: keep existing attendees (excluding organizer) and add new ones (avoid duplicates)
      const mergedAttendees = existingAttendees.filter(a => !a.organizer);
      
      for (const newAttendee of normalizedNewAttendees) {
        const emailLower = (newAttendee.email || '').toLowerCase();
        // Don't add if it's the organizer's email
        if (emailLower === (existingEvent.organizer?.email || '').toLowerCase()) {
          continue;
        }
        // Don't add if already exists
        if (!existingEmails.has(emailLower)) {
          mergedAttendees.push(newAttendee);
          existingEmails.add(emailLower);
        }
      }

      updatedEvent.attendees = mergedAttendees;
    }

    // Normalize start/end if provided
    if (updates.start) {
      updatedEvent.start = this.normalizeDateTime(updates.start, 'start', updatedEvent.start?.timeZone);
    }

    if (updates.end) {
      updatedEvent.end = this.normalizeDateTime(updates.end, 'end', updatedEvent.end?.timeZone || updatedEvent.start?.timeZone);
    }

    try {
      const response = await calendar.events.update({
        calendarId,
        eventId,
        resource: updatedEvent,
        sendUpdates,
      });

      const event = response.data;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...this.formatEvent(event, true),
            message: 'Event updated successfully',
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error(`Failed to update event: ${error.message}. ${error.response?.data?.error?.message || ''}`);
    }
  }

  /**
   * Handle delete_event
   */
  async handleDeleteEvent(connection, args) {
    const { calendar } = connection;
    const { calendarId = 'primary', eventId, sendUpdates = 'all' } = args;

    if (!eventId) {
      throw new Error('eventId is required');
    }

    try {
      await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Event deleted successfully',
            eventId,
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error(`Failed to delete event: ${error.message}. ${error.response?.data?.error?.message || ''}`);
    }
  }

  /**
   * Handle search_events
   */
  async handleSearchEvents(connection, args) {
    const { calendar } = connection;
    const { calendarId = 'primary', q, timeMin, timeMax, maxResults = 10, singleEvents = true } = args;

    const params = {
      calendarId,
      maxResults: Math.min(maxResults, 2500),
      singleEvents,
      orderBy: 'startTime',
    };

    if (q) {
      params.q = q;
    }
    
    if (timeMin) {
      params.timeMin = timeMin;
    } else {
      params.timeMin = new Date().toISOString();
    }
    
    if (timeMax) {
      params.timeMax = timeMax;
    }

    const response = await calendar.events.list(params);
    const events = response.data.items || [];

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          events: events.map(event => this.formatEvent(event)),
          count: events.length,
          query: q,
          timeRange: {
            from: params.timeMin,
            to: params.timeMax || 'unlimited',
          },
        }, null, 2)
      }]
    };
  }

  /**
   * Handle get_upcoming_events
   */
  async handleGetUpcomingEvents(connection, args) {
    const { calendar } = connection;
    const { calendarId = 'primary', maxResults = 10, days = 7 } = args;

    const now = new Date();
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: Math.min(maxResults, 2500),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          events: events.map(event => this.formatEvent(event)),
          count: events.length,
          timeRange: {
            from: now.toISOString(),
            to: timeMax.toISOString(),
            days,
          },
        }, null, 2)
      }]
    };
  }

  /**
   * Normalize datetime input to proper format
   */
  normalizeDateTime(dateTimeInput, fieldName, defaultTimeZone = 'UTC') {
    if (typeof dateTimeInput === 'string') {
      try {
        const date = new Date(dateTimeInput);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date format');
        }
        return {
          dateTime: date.toISOString().replace(/\.\d{3}Z$/, ''),
          timeZone: defaultTimeZone,
        };
      } catch (e) {
        throw new Error(`Invalid ${fieldName} format: ${e.message}. ${fieldName} must be an object with dateTime and timeZone properties.`);
      }
    } else if (typeof dateTimeInput === 'object' && dateTimeInput !== null) {
      if (!dateTimeInput.dateTime && !dateTimeInput.date) {
        throw new Error(`${fieldName} object must have either dateTime or date property`);
      }
      
      if (dateTimeInput.dateTime && !dateTimeInput.timeZone) {
        return {
          ...dateTimeInput,
          timeZone: defaultTimeZone,
        };
      }
      
      return dateTimeInput;
    } else {
      throw new Error(`${fieldName} must be an object with dateTime (or date) and timeZone properties`);
    }
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Format event for response (consistent formatting)
   */
  formatEvent(event, includeDetails = false) {
    const formatted = {
      id: event.id,
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      htmlLink: event.htmlLink,
    };

    if (includeDetails || event.attendees) {
      formatted.attendees = (event.attendees || []).map(att => ({
        email: att.email,
        displayName: att.displayName,
        responseStatus: att.responseStatus,
        organizer: att.organizer,
      }));
    }

    if (includeDetails) {
      formatted.organizer = event.organizer;
      formatted.status = event.status;
      formatted.hangoutLink = event.hangoutLink;
      formatted.conferenceData = event.conferenceData;
      formatted.recurrence = event.recurrence;
      formatted.recurringEventId = event.recurringEventId;
      formatted.reminders = event.reminders;
      formatted.created = event.created;
      formatted.updated = event.updated;
      formatted.colorId = event.colorId;
      formatted.transparency = event.transparency;
      formatted.visibility = event.visibility;
    }

    return formatted;
  }
}

module.exports = GoogleCalendarIntegration;
