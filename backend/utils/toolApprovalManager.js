const APPROVAL_TIMEOUT_MS = 45000; // 45 seconds to avoid hanging the stream

const pendingApprovals = new Map();

function safeParseArgs(rawArgs) {
  if (!rawArgs) return {};
  try {
    return JSON.parse(rawArgs);
  } catch (error) {
    return rawArgs;
  }
}

function createApprovalRequest(userId, conversationId, toolCalls) {
  const approvalId = `${conversationId}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const tools = toolCalls.map((toolCall) => ({
    id: toolCall.id,
    name: toolCall.function?.name || 'unknown_tool',
    args: safeParseArgs(toolCall.function?.arguments || '{}'),
    integration: safeParseArgs(toolCall.function?.arguments || '{}')?.integration || null,
  }));

  let resolver;
  const decisionPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingApprovals.delete(approvalId);
      resolve({ approved: false, reason: 'timeout' });
    }, APPROVAL_TIMEOUT_MS);

    resolver = (approved) => {
      clearTimeout(timeout);
      pendingApprovals.delete(approvalId);
      resolve({ approved });
    };
  });

  pendingApprovals.set(approvalId, {
    userId,
    conversationId,
    tools,
    resolve: resolver,
    createdAt: Date.now(),
  });

  return {
    approvalId,
    tools,
    waitForDecision: () => decisionPromise,
  };
}

function submitDecision(approvalId, approved) {
  const pending = pendingApprovals.get(approvalId);
  if (!pending) {
    return false;
  }

  pending.resolve(approved);
  return true;
}

module.exports = {
  createApprovalRequest,
  submitDecision,
};

