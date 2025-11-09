const { parseAIResponse } = require('./responseParser');

/**
 * Format AI response for UI consumption
 */
function formatAIResponse(aiResponse, allToolCalls = [], relevantMemories = []) {
  const parsed = parseAIResponse(aiResponse.content);
  
  // Determine what message to send to UI
  let messageToSend = parsed.response || aiResponse.content;
  
  // If this is internal reasoning only (no final response), create a helpful message
  if (parsed.isInternal && (!parsed.response || parsed.response.trim() === '')) {
    messageToSend = allToolCalls.length > 0
      ? `Processing your request using ${allToolCalls.length} tool${allToolCalls.length > 1 ? 's' : ''}...`
      : `Thinking...`;
  }
  
  return {
    message: messageToSend,
    thinking: {
      isInternal: parsed.isInternal,
      thinking: parsed.thinking || (allToolCalls.length > 0 ? `Used tools to process your request` : ''),
      action: parsed.action || 'Processing',
      toolCalls: allToolCalls, // Use actual tools called, not AI's claimed list
      data: parsed.data,
      memoryUsed: relevantMemories.length > 0,
      memoryCount: relevantMemories.length,
    }
  };
}

/**
 * Create message payload for database storage
 */
function createMessagePayload(parsed, model, usage, toolCalls = []) {
  return {
    model: model,
    usage: usage,
    tool_calls: toolCalls,
    toolsUsed: toolCalls.map(tc => tc.function?.name || tc).filter(Boolean),
    thinking: parsed.thinking || undefined,
    action: parsed.action || undefined,
    data: parsed.data || undefined,
  };
}

module.exports = {
  formatAIResponse,
  createMessagePayload,
};

