/**
 * Parse AI response to detect internal reasoning vs final output
 * Returns { isInternal, thinking, action, toolCalls, response, data, originalContent }
 */
function parseAIResponse(content) {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        isInternal: parsed.internal === 0, // internal=0 means hidden (internal reasoning)
        thinking: parsed.thinking || '',
        action: parsed.action || '',
        toolCalls: parsed.toolCalls || [],
        response: parsed.response || '',
        data: parsed.data || null,
        originalContent: content
      };
    }
    
    // Try direct JSON parse
    const parsed = JSON.parse(content);
    if (typeof parsed.internal !== 'undefined') {
      return {
        isInternal: parsed.internal === 0, // internal=0 means hidden (internal reasoning)
        thinking: parsed.thinking || '',
        action: parsed.action || '',
        toolCalls: parsed.toolCalls || [],
        response: parsed.response || '',
        data: parsed.data || null,
        originalContent: content
      };
    }
  } catch (e) {
    // Not JSON, treat as regular message
  }
  
  // Regular text response (not internal reasoning)
  return {
    isInternal: false,
    thinking: '',
    action: '',
    toolCalls: [],
    response: content,
    data: null,
    originalContent: content
  };
}

module.exports = { parseAIResponse };

