#!/usr/bin/env node

/**
 * Test script to verify all AI models are working
 * 
 * Usage:
 *   node scripts/test-models.js
 *   node scripts/test-models.js --base-url http://localhost:3000
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const BASE_URL = process.argv.includes('--base-url') 
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : process.env.API_BASE_URL || 'http://localhost:3000';

const TEST_PROMPT = "Say 'Hello, I am working!' in exactly 5 words.";
const TIMEOUT_MS = 30000; // 30 seconds timeout per model

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Test a single model
 */
async function testModel(model, userId = 'test-user') {
  const startTime = Date.now();
  let result = {
    model: model,
    success: false,
    error: null,
    response: null,
    duration: 0,
    provider: model.provider || 'unknown',
  };

  try {
    console.log(`\n${colors.cyan}Testing: ${colors.reset}${model.name} (${model.id})`);
    console.log(`${colors.gray}Provider: ${model.provider || 'unknown'} | Tier: ${model.tier || 'unknown'}${colors.reset}`);

    // Make request to chat endpoint
    const response = await axios.post(
      `${BASE_URL}/api/chat`,
      {
        message: TEST_PROMPT,
        model: model.id,
        userId: userId,
        stream: false, // Use non-streaming for simpler testing
      },
      {
        timeout: TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const duration = Date.now() - startTime;
    result.duration = duration;

    // Check if we got a valid response
    if (response.data && response.data.message) {
      result.success = true;
      result.response = response.data.message;
      console.log(`${colors.green}✓ Success${colors.reset} (${duration}ms)`);
      console.log(`${colors.gray}Response: ${result.response.substring(0, 100)}${result.response.length > 100 ? '...' : ''}${colors.reset}`);
    } else {
      result.error = 'No message in response';
      console.log(`${colors.red}✗ Failed: ${result.error}${colors.reset}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    result.duration = duration;
    result.error = error.response?.data?.error || error.message || 'Unknown error';
    
    if (error.code === 'ECONNREFUSED') {
      result.error = `Cannot connect to ${BASE_URL}. Is the server running?`;
    } else if (error.code === 'ETIMEDOUT') {
      result.error = 'Request timed out';
    }

    console.log(`${colors.red}✗ Failed: ${result.error}${colors.reset}`);
    if (error.response?.data) {
      console.log(`${colors.gray}Details: ${JSON.stringify(error.response.data)}${colors.reset}`);
    }
  }

  return result;
}

/**
 * Parse streaming response (if stream is enabled)
 */
async function testModelStreaming(model, userId = 'test-user') {
  const startTime = Date.now();
  let result = {
    model: model,
    success: false,
    error: null,
    response: null,
    duration: 0,
    provider: model.provider || 'unknown',
  };

  try {
    console.log(`\n${colors.cyan}Testing (streaming): ${colors.reset}${model.name} (${model.id})`);
    console.log(`${colors.gray}Provider: ${model.provider || 'unknown'} | Tier: ${model.tier || 'unknown'}${colors.reset}`);

    const response = await axios.post(
      `${BASE_URL}/api/chat`,
      {
        message: TEST_PROMPT,
        model: model.id,
        userId: userId,
        stream: true,
      },
      {
        timeout: TIMEOUT_MS,
        responseType: 'stream',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    let fullMessage = '';
    let hasError = false;

    return new Promise((resolve) => {
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'content' && data.content) {
                fullMessage += data.content;
              } else if (data.type === 'done' && data.message) {
                fullMessage = data.message;
              } else if (data.type === 'error') {
                hasError = true;
                result.error = data.error;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      });

      response.data.on('end', () => {
        const duration = Date.now() - startTime;
        result.duration = duration;

        if (hasError || !fullMessage) {
          result.error = result.error || 'No response received';
          console.log(`${colors.red}✗ Failed: ${result.error}${colors.reset}`);
        } else {
          result.success = true;
          result.response = fullMessage;
          console.log(`${colors.green}✓ Success${colors.reset} (${duration}ms)`);
          console.log(`${colors.gray}Response: ${result.response.substring(0, 100)}${result.response.length > 100 ? '...' : ''}${colors.reset}`);
        }
        resolve(result);
      });

      response.data.on('error', (error) => {
        const duration = Date.now() - startTime;
        result.duration = duration;
        result.error = error.message;
        console.log(`${colors.red}✗ Failed: ${result.error}${colors.reset}`);
        resolve(result);
      });
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    result.duration = duration;
    result.error = error.response?.data?.error || error.message || 'Unknown error';
    
    if (error.code === 'ECONNREFUSED') {
      result.error = `Cannot connect to ${BASE_URL}. Is the server running?`;
    } else if (error.code === 'ETIMEDOUT') {
      result.error = 'Request timed out';
    }

    console.log(`${colors.red}✗ Failed: ${result.error}${colors.reset}`);
    return result;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║${colors.reset}        AI Model Testing Script                    ${colors.blue}║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\n${colors.gray}Base URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.gray}Test Prompt: "${TEST_PROMPT}"${colors.reset}`);
  console.log(`${colors.gray}Timeout: ${TIMEOUT_MS}ms per model${colors.reset}\n`);

  try {
    // Fetch all available models
    console.log(`${colors.cyan}Fetching available models...${colors.reset}`);
    const modelsResponse = await axios.get(`${BASE_URL}/api/models`, {
      timeout: 5000,
    });

    const models = modelsResponse.data;
    if (!Array.isArray(models) || models.length === 0) {
      console.log(`${colors.red}✗ No models found${colors.reset}`);
      return;
    }

    console.log(`${colors.green}✓ Found ${models.length} model(s)${colors.reset}\n`);

    // Group models by provider
    const modelsByProvider = {};
    models.forEach(model => {
      const provider = model.provider || 'unknown';
      if (!modelsByProvider[provider]) {
        modelsByProvider[provider] = [];
      }
      modelsByProvider[provider].push(model);
    });

    // Test each model
    const results = [];
    const useStreaming = process.argv.includes('--stream');

    for (const [provider, providerModels] of Object.entries(modelsByProvider)) {
      console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.blue}Provider: ${provider.toUpperCase()} (${providerModels.length} model(s))${colors.reset}`);
      console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

      for (const model of providerModels) {
        const result = useStreaming 
          ? await testModelStreaming(model)
          : await testModel(model);
        results.push(result);
        
        // Small delay between tests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Print summary
    console.log(`\n\n${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.blue}║${colors.reset}                    Test Summary                        ${colors.blue}║${colors.reset}`);
    console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Summary by provider
    const summaryByProvider = {};
    results.forEach(result => {
      const provider = result.provider;
      if (!summaryByProvider[provider]) {
        summaryByProvider[provider] = { total: 0, success: 0, failed: 0 };
      }
      summaryByProvider[provider].total++;
      if (result.success) {
        summaryByProvider[provider].success++;
      } else {
        summaryByProvider[provider].failed++;
      }
    });

    console.log(`${colors.cyan}Overall Results:${colors.reset}`);
    console.log(`  ${colors.green}✓ Successful: ${successful.length}${colors.reset}`);
    console.log(`  ${colors.red}✗ Failed: ${failed.length}${colors.reset}`);
    console.log(`  ${colors.blue}Total: ${results.length}${colors.reset}\n`);

    console.log(`${colors.cyan}By Provider:${colors.reset}`);
    for (const [provider, stats] of Object.entries(summaryByProvider)) {
      const successRate = ((stats.success / stats.total) * 100).toFixed(1);
      const statusColor = stats.failed === 0 ? colors.green : colors.yellow;
      console.log(`  ${provider}: ${statusColor}${stats.success}/${stats.total} (${successRate}%)${colors.reset}`);
    }

    // Detailed results
    if (failed.length > 0) {
      console.log(`\n${colors.red}Failed Models:${colors.reset}`);
      failed.forEach(result => {
        console.log(`  ${colors.red}✗${colors.reset} ${result.model.name} (${result.model.id})`);
        console.log(`    ${colors.gray}Error: ${result.error}${colors.reset}`);
      });
    }

    if (successful.length > 0) {
      console.log(`\n${colors.green}Successful Models:${colors.reset}`);
      successful.forEach(result => {
        const avgTime = result.duration < 1000 
          ? `${result.duration}ms`
          : `${(result.duration / 1000).toFixed(2)}s`;
        console.log(`  ${colors.green}✓${colors.reset} ${result.model.name} - ${avgTime}`);
      });
    }

    // Exit with appropriate code
    process.exit(failed.length > 0 ? 1 : 0);

  } catch (error) {
    console.error(`\n${colors.red}✗ Error: ${error.message}${colors.reset}`);
    if (error.code === 'ECONNREFUSED') {
      console.error(`${colors.yellow}⚠  Cannot connect to ${BASE_URL}${colors.reset}`);
      console.error(`${colors.yellow}   Make sure the server is running: npm run dev${colors.reset}`);
    }
    process.exit(1);
  }
}

// Run tests
runTests();

