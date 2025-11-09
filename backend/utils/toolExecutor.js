const mcpManager = require('../mcp/manager');
const { convertMCPToolsToOpenAI, getIntegrationInstructions } = require('../mcp/tools');
const toolContextService = require('../db/services/toolContext');

/**
 * Process tool results and format them for AI consumption
 * Returns results as-is without any modifications
 */
function formatToolResult(toolName, result) {
  // Return results as-is - no special formatting
  return typeof result === 'string' ? result : JSON.stringify(result);
}

/**
 * Extract key information from tool results for working memory (generic)
 * Extracts top-level keys and first items from arrays to create a lightweight context
 */
function extractToolContext(toolName, result) {
  try {
    // Parse result if it's a string
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    
    // Handle MCP result format (content array)
    const content = parsed.content || parsed;
    const textContent = Array.isArray(content) 
      ? content.find(c => c.type === 'text')?.text || content[0]?.text || JSON.stringify(content)
      : typeof content === 'string' ? content : JSON.stringify(content);
    
    const data = typeof textContent === 'string' ? JSON.parse(textContent) : textContent;
    
    // Generic extraction: extract top-level keys and first items from arrays
    const context = {};
    
    // If data is an array, extract first item's key fields
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      // Extract common fields from first item
      Object.keys(firstItem).forEach(key => {
        const value = firstItem[key];
        // Skip nested objects and arrays, keep simple values
        if (value !== null && value !== undefined && typeof value !== 'object') {
          context[key] = value;
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Extract simple nested values (e.g., owner.login)
          Object.keys(value).forEach(nestedKey => {
            const nestedValue = value[nestedKey];
            if (nestedValue !== null && nestedValue !== undefined && typeof nestedValue !== 'object') {
              context[`${key}_${nestedKey}`] = nestedValue;
            }
          });
        }
      });
      context.count = data.length;
    } else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      // If data is an object, extract top-level keys
      Object.keys(data).forEach(key => {
        const value = data[key];
        // Skip nested objects and arrays, keep simple values and first array items
        if (value !== null && value !== undefined) {
          if (typeof value !== 'object') {
            context[key] = value;
          } else if (Array.isArray(value) && value.length > 0) {
            // For arrays, extract count and first item's key fields
            context[`${key}_count`] = value.length;
            const firstItem = value[0];
            if (typeof firstItem === 'object' && firstItem !== null) {
              Object.keys(firstItem).forEach(itemKey => {
                const itemValue = firstItem[itemKey];
                if (itemValue !== null && itemValue !== undefined && typeof itemValue !== 'object') {
                  context[`${key}_${itemKey}`] = itemValue;
                }
              });
            }
          } else if (typeof value === 'object' && value !== null) {
            // Extract simple nested values
            Object.keys(value).forEach(nestedKey => {
              const nestedValue = value[nestedKey];
              if (nestedValue !== null && nestedValue !== undefined && typeof nestedValue !== 'object') {
                context[`${key}_${nestedKey}`] = nestedValue;
              }
            });
          }
        }
      });
    }
    
    // Only return context if we extracted something meaningful
    if (Object.keys(context).length > 0) {
      return context;
    }
    
    return null;
  } catch (error) {
    // If parsing fails, return null (don't break tool execution)
    return null;
  }
}

/**
 * Execute a single tool call
 */
async function executeToolCall(userId, toolCall, integrationType = null, conversationId = null) {
  try {
    const args = JSON.parse(toolCall.function.arguments);
    
    // Handle special list_tools meta-tool
    if (toolCall.function.name === 'list_tools') {
      const integrationType = args.integration;
      console.log(`🔍 AI requested tools for: ${integrationType}`);
      
      const mcpTools = await mcpManager.getToolsForIntegrations(userId, [integrationType]);
      const newTools = convertMCPToolsToOpenAI(mcpTools);
      
      // Get integration-specific instructions
      const integrationInstructions = getIntegrationInstructions(integrationType);
      
      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        name: toolCall.function.name,
        content: JSON.stringify({
          integration: integrationType,
          instructions: integrationInstructions,
          tools: mcpTools.map(t => ({
            name: t.name,
            description: t.description,
          })),
          count: mcpTools.length,
        }),
        newTools: newTools, // Return new tools to be added
      };
    } else {
      // Regular MCP tool call
      console.log(`🔧 Calling tool "${toolCall.function.name}" on ${integrationType || 'integration'}`);
      const result = await mcpManager.callUserTool(
        userId, 
        toolCall.function.name, 
        args
      );
      
      // Extract and store tool context in working memory
      if (conversationId) {
        const context = extractToolContext(toolCall.function.name, result);
        if (context) {
          try {
            await toolContextService.storeContext(
              conversationId,
              toolCall.function.name, // Use actual tool name (generic)
              {
                tool: toolCall.function.name,
                args,
                context,
                timestamp: new Date().toISOString(),
              }
            );
            console.log(`💾 Stored tool context for ${toolCall.function.name}:`, context);
          } catch (error) {
            console.error('Error storing tool context:', error);
            // Don't fail tool execution if context storage fails
          }
        }
      }
      
      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        name: toolCall.function.name,
        content: formatToolResult(toolCall.function.name, result),
      };
    }
  } catch (error) {
    console.error(`Error calling tool ${toolCall.function.name}:`, error);
    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      name: toolCall.function.name,
      content: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Execute multiple tool calls
 */
async function executeToolCalls(userId, toolCalls, integrationType = null, conversationId = null) {
  const results = [];
  let newTools = [];
  
  for (const toolCall of toolCalls) {
    const result = await executeToolCall(userId, toolCall, integrationType, conversationId);
    
    // Extract newTools before adding to results
    if (result.newTools) {
      newTools.push(...result.newTools);
      delete result.newTools; // Remove from result before sending to AI
    }
    
    results.push(result);
  }
  
  return { results, newTools };
}

module.exports = {
  executeToolCall,
  executeToolCalls,
  formatToolResult,
};

