/**
 * Example: Token Usage Tracking & Quota Enforcement
 * 
 * This file demonstrates how the quota system works in practice.
 * Run this file to see the complete flow.
 */

const tokenUsageService = require('../db/services/tokenUsage');
const { checkUserQuota } = require('../middleware/quotaEnforcement');
const { getPlanLimit, getRemainingTokens, getUsagePercentage } = require('../config/planLimits');

/**
 * Example 1: Track token usage after an LLM call
 */
async function example1_trackUsage() {
  console.log('\n📊 Example 1: Track Token Usage\n');
  
  const userId = 'demo-user-123';
  const model = 'claude-sonnet-4';
  
  // Simulate LLM API response
  const llmResponse = {
    content: 'Hello! How can I help you today?',
    usage: {
      input_tokens: 150,
      output_tokens: 75,
    },
  };
  
  console.log('LLM Response:', llmResponse.content);
  console.log('Usage:', llmResponse.usage);
  
  // Track usage
  await tokenUsageService.trackUsage(
    userId,
    model,
    llmResponse.usage.input_tokens,
    llmResponse.usage.output_tokens
  );
  
  console.log('✅ Usage tracked successfully!');
  
  // Get current month's total
  const total = await tokenUsageService.getCurrentMonthTotal(userId);
  console.log('\nCurrent Month Total:');
  console.log(`  Input: ${total.inputTokens.toLocaleString()}`);
  console.log(`  Output: ${total.outputTokens.toLocaleString()}`);
  console.log(`  Total: ${total.totalTokens.toLocaleString()}`);
}

/**
 * Example 2: Check quota before making LLM call
 */
async function example2_checkQuota() {
  console.log('\n🛡️ Example 2: Check Quota Before LLM Call\n');
  
  const userId = 'demo-user-123';
  const userPlan = 'free'; // 200K tokens/month
  
  try {
    // Check if user has quota available
    const quotaCheck = await checkUserQuota(userId, userPlan);
    
    console.log('✅ Quota check passed!');
    console.log(`   Remaining: ${quotaCheck.remaining.toLocaleString()} tokens`);
    console.log(`   Used: ${quotaCheck.usage.toLocaleString()} / ${quotaCheck.limit.toLocaleString()}`);
    
    // Proceed with LLM call
    console.log('\n→ Making LLM API call...');
    // const result = await callLLM(message);
    
  } catch (error) {
    if (error.code === 'QUOTA_EXCEEDED') {
      console.log('❌ Quota exceeded!');
      console.log(`   Used: ${error.usage.used.toLocaleString()}`);
      console.log(`   Limit: ${error.usage.limit.toLocaleString()}`);
      console.log(`   Plan: ${error.usage.plan}`);
      console.log('\n→ Prompt user to upgrade plan');
    }
  }
}

/**
 * Example 3: Get usage statistics
 */
async function example3_getStats() {
  console.log('\n📈 Example 3: Get Usage Statistics\n');
  
  const userId = 'demo-user-123';
  const userPlan = 'pro'; // 1.25M tokens/month
  
  // Get current month total
  const total = await tokenUsageService.getCurrentMonthTotal(userId);
  const limit = getPlanLimit(userPlan);
  const remaining = getRemainingTokens(total.totalTokens, userPlan);
  const percentage = getUsagePercentage(total.totalTokens, userPlan);
  
  console.log('Current Month Usage:');
  console.log(`  Plan: ${userPlan}`);
  console.log(`  Used: ${total.totalTokens.toLocaleString()} tokens`);
  console.log(`  Limit: ${limit.toLocaleString()} tokens`);
  console.log(`  Remaining: ${remaining.toLocaleString()} tokens`);
  console.log(`  Percentage: ${percentage.toFixed(1)}%`);
  
  // Get usage by model
  const byModel = await tokenUsageService.getUsageByModel(userId);
  console.log('\nUsage by Model:');
  byModel.forEach(model => {
    const pct = ((model.totalTokens / total.totalTokens) * 100).toFixed(1);
    console.log(`  ${model.model}: ${model.totalTokens.toLocaleString()} tokens (${pct}%)`);
  });
}

/**
 * Example 4: Simulate reaching quota limit
 */
async function example4_simulateLimit() {
  console.log('\n⚠️  Example 4: Simulate Quota Limit\n');
  
  const userId = 'demo-user-quota-test';
  const userPlan = 'free'; // 200K limit
  const limit = getPlanLimit(userPlan);
  
  console.log(`Simulating usage for ${userPlan} plan (${limit.toLocaleString()} tokens)`);
  
  // Simulate heavy usage
  for (let i = 0; i < 5; i++) {
    await tokenUsageService.trackUsage(
      userId,
      'claude-sonnet-4',
      20000, // 20K input
      20000  // 20K output
    );
    
    const total = await tokenUsageService.getCurrentMonthTotal(userId);
    const percentage = getUsagePercentage(total.totalTokens, userPlan);
    const remaining = getRemainingTokens(total.totalTokens, userPlan);
    
    console.log(`  Request ${i + 1}: ${total.totalTokens.toLocaleString()} / ${limit.toLocaleString()} (${percentage.toFixed(1)}%) - ${remaining.toLocaleString()} remaining`);
    
    if (total.totalTokens >= limit) {
      console.log('\n❌ QUOTA EXCEEDED!');
      break;
    }
  }
  
  // Try to check quota
  try {
    await checkUserQuota(userId, userPlan);
  } catch (error) {
    if (error.code === 'QUOTA_EXCEEDED') {
      console.log('\n🚫 Subsequent requests blocked:');
      console.log(`   ${error.message}`);
      console.log(`   Usage: ${error.usage.percentage}% of ${error.usage.plan} plan`);
    }
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('═══════════════════════════════════════════════');
  console.log('   Token Usage & Quota Enforcement Examples');
  console.log('═══════════════════════════════════════════════');
  
  try {
    await example1_trackUsage();
    await example2_checkQuota();
    await example3_getStats();
    await example4_simulateLimit();
    
    console.log('\n═══════════════════════════════════════════════');
    console.log('   ✅ All examples completed successfully!');
    console.log('═══════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
  }
}

// Run examples if called directly
if (require.main === module) {
  runExamples()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { runExamples };

