const embeddingService = require('../ai-providers/embeddings');
const memoryService = require('../db/services/memory');
const conversationService = require('../db/services/conversation');

/**
 * Search for relevant memories based on user message
 */
async function searchRelevantMemories(userId, message, conversationId = null, limit = 3) {
  if (!embeddingService.isConfigured()) {
    return [];
  }

  try {
    console.log('🧠 Generating embedding for semantic memory search...');
    const embedding = await embeddingService.generateEmbedding(message);
    if (!embedding) {
      console.log('⚠️ Failed to generate embedding');
      return [];
    }

    console.log('✅ Embedding generated, searching for relevant memories...');
    const relevantMemories = await memoryService.searchSimilar(
      userId,
      embedding,
      limit,
      conversationId
    );

    if (relevantMemories.length > 0) {
      console.log(`💭 Found ${relevantMemories.length} relevant memories for context:`);
      relevantMemories.forEach((m, i) => {
        console.log(`   ${i + 1}. "${m.content.substring(0, 100)}..." (similarity: ${m.similarity?.toFixed(3)})`);
      });
    } else {
      console.log('💭 No relevant memories found');
    }

    return relevantMemories;
  } catch (error) {
    console.error('❌ Error fetching memories:', error);
    return [];
  }
}

/**
 * Format memory context for system prompt
 */
function formatMemoryContext(relevantMemories) {
  if (relevantMemories.length === 0) {
    return '';
  }

  return '\n\nRelevant context from previous conversations:\n' +
    relevantMemories.map((m, i) => `${i + 1}. ${m.content}`).join('\n');
}

/**
 * Store message as memory (async, non-blocking)
 */
function storeMessageAsMemory(userId, message, conversationId, messageId) {
  if (!embeddingService.isConfigured()) {
    return;
  }

  // Generate embedding and store asynchronously (don't wait)
  embeddingService.generateEmbedding(message)
    .then(embedding => {
      if (embedding) {
        return memoryService.storeMemory(
          userId,
          message,
          embedding,
          conversationId,
          messageId,
          { type: 'user_message' }
        );
      }
    })
    .catch(err => console.error('Error storing memory:', err));
}

module.exports = {
  searchRelevantMemories,
  formatMemoryContext,
  storeMessageAsMemory,
};

